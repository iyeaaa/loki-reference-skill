package router

import (
	"database/sql"
	"net/http"
	"os"
	sqlc "server/db/sqlc"
	"server/handlers"
	"server/middleware"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	"go.uber.org/zap"

	_ "server/docs"
)

type Router struct {
	engine        *gin.Engine
	handler       *handlers.Handler
	jwtMiddleware *middleware.JWTMiddleware
}

func New(db *sql.DB, queries *sqlc.Queries, logger *zap.Logger) *Router {
	handler := handlers.New(db, queries, logger)
	engine := gin.Default()

	// Initialize JWT middleware
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "hana-lang-connect-jwt-secret-key"
		logger.Warn("JWT_SECRET environment variable not set, using fallback")
	}
	jwtMiddleware := middleware.NewJWTMiddleware(jwtSecret, logger)

	r := &Router{
		engine:        engine,
		handler:       handler,
		jwtMiddleware: jwtMiddleware,
	}

	// Configure CORS
	config := cors.DefaultConfig()

	// Get allowed origins from environment or use defaults
	allowedOrigins := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowedOrigins != "" {
		// Parse comma-separated origins from environment
		origins := []string{}
		for _, origin := range strings.Split(allowedOrigins, ",") {
			origins = append(origins, strings.TrimSpace(origin))
		}
		config.AllowOrigins = origins
	} else {
		// Allow all origins
		config.AllowAllOrigins = true
	}

	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"}
	config.AllowHeaders = []string{"Accept", "Authorization", "Content-Type", "X-Requested-With", "Origin", "Cache-Control", "Pragma", "Expires"}
	config.ExposeHeaders = []string{"Link", "X-Total-Count"}
	config.AllowCredentials = true
	config.MaxAge = 86400 // 24 hours

	r.engine.Use(cors.New(config))

	// Handle 405 Method Not Allowed
	r.engine.NoMethod(func(c *gin.Context) {
		c.JSON(405, gin.H{"error": "Method not allowed"})
	})

	// Handle 404 Not Found
	r.engine.NoRoute(func(c *gin.Context) {
		c.JSON(404, gin.H{"error": "Route not found"})
	})

	r.setupRoutes()
	return r
}

func (r *Router) setupRoutes() {
	r.setupHealthCheckRoute()
	r.setupAPIRoutes()
	r.setupSwaggerRoute()
}

func (r *Router) setupHealthCheckRoute() {
	r.engine.GET("/health", r.handler.HandleHealth)
}

func (r *Router) setupAPIRoutes() {
	// API v1 routes
	apiV1 := r.engine.Group("/api/v1")
	{
		// Posts
		apiV1.GET("/posts", r.handler.HandlePosts)

		// Todos
		apiV1.GET("/todos", r.handler.HandleTodos)

		// Translation (public - no authentication required)
		apiV1.POST("/translate", r.handler.HandleTranslate)
	}

	// Authentication routes (public)
	authV1 := apiV1.Group("/auth")
	{
		authV1.POST("/login", r.handler.EmailLogin)                                         // Admin login
		authV1.POST("/signup", r.handler.Signup)                                            // User signup (public)
		authV1.POST("/verify", r.jwtMiddleware.RequireAuth(), r.handler.VerifyToken)        // Verify token
		authV1.POST("/refresh", r.jwtMiddleware.RequireAuth(), r.handler.RefreshToken)      // Refresh token
		authV1.GET("/admin-check", r.jwtMiddleware.RequireAuth(), r.handler.CheckAdminRole) // Check admin role
	}

	// Public routes (no authentication required)
	publicV1 := apiV1.Group("/public")
	{
		publicV1.GET("/departments", r.handler.GetDepartments) // Get departments (public)
	}

	// Admin API routes (protected - requires admin role)
	adminAPI := r.engine.Group("/api/v1/admin")
	adminAPI.Use(r.jwtMiddleware.RequireAuth())
	adminAPI.Use(r.jwtMiddleware.RequireAdminRole())
	{
		// User Management
		users := adminAPI.Group("/users")
		{
			users.GET("", r.handler.ListUsersWithManagement)           // List users with filters
			users.GET("/:id", r.handler.GetUserByIdWithManagement)     // Get user by ID
			users.POST("", r.handler.CreateUserWithManagement)         // Create user
			users.PUT("/:id", r.handler.UpdateUserWithManagement)      // Update user
			users.DELETE("/:id", r.handler.DeleteUserWithManagement)   // Delete user
			users.POST("/:id/password", r.handler.ChangeUserPassword)  // Change user password
			users.PUT("/bulk/status", r.handler.BulkUpdateUsersStatus) // Bulk update user status
			users.PUT("/bulk/role", r.handler.BulkUpdateUsersRole)     // Bulk update user role
		}

		// Translation Management
		translations := adminAPI.Group("/translations")
		{
			translations.GET("", r.handler.ListTranslationsAdmin)                           // List translations with filters
			translations.GET("/matrix", r.handler.ListTranslationsMatrixAdmin)              // List translations in matrix view
			translations.GET("/:id", r.handler.GetTranslationAdmin)                         // Get translation by ID
			translations.POST("", r.handler.CreateTranslationAdmin)                         // Create translation
			translations.PUT("/:id", r.handler.UpdateTranslationAdmin)                      // Update translation
			translations.DELETE("/:id", r.handler.DeleteTranslationAdmin)                   // Delete translation
			translations.PUT("/:id/review-status", r.handler.UpdateTranslationReviewStatus) // Update review status
			translations.DELETE("/redis-cache", r.handler.ClearRedisCache)                  // Clear Redis cache
		}

		// Support endpoints
		adminAPI.GET("/departments", r.handler.GetDepartments) // Get departments
		adminAPI.GET("/languages", r.handler.GetLanguages)     // Get languages
		adminAPI.GET("/users/stats", r.handler.GetUserStats)   // Get user statistics
	}

	// Custom /docs route for Scalar API Reference
	r.engine.GET("/api/docs", func(c *gin.Context) {
		c.Header("Content-Type", "text/html")
		c.String(http.StatusOK, `<!doctype html>
<html>
  <head>
    <title>API Reference</title>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/swagger/doc.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`)
	})
}

func (r *Router) setupSwaggerRoute() {
	r.engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
}

func (r *Router) Engine() *gin.Engine {
	return r.engine
}
