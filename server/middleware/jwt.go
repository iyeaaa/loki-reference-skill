package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"go.uber.org/zap"
)

type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type JWTMiddleware struct {
	secret string
	logger *zap.Logger
}

func NewJWTMiddleware(secret string, logger *zap.Logger) *JWTMiddleware {
	return &JWTMiddleware{
		secret: secret,
		logger: logger,
	}
}

func (m *JWTMiddleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		m.logger.Info("JWT Auth Check", zap.String("path", c.Request.URL.Path), zap.String("method", c.Request.Method))

		if authHeader == "" {
			m.logger.Warn("Missing Authorization header")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			m.logger.Warn("Invalid authorization header format", zap.String("header", authHeader))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			// Make sure token method conforms to "SigningMethodHMAC"
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(m.secret), nil
		})
		if err != nil {
			m.logger.Error("JWT validation failed", zap.Error(err))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		claims, ok := token.Claims.(*JWTClaims)
		if !ok || !token.Valid {
			m.logger.Warn("Invalid token claims", zap.Bool("claims_ok", ok), zap.Bool("token_valid", token.Valid))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Set user information in context
		m.logger.Info("JWT Auth Success",
			zap.String("user_id", claims.UserID),
			zap.String("email", claims.Email),
			zap.String("role", claims.Role))

		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

func (m *JWTMiddleware) RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found in context"})
			c.Abort()
			return
		}

		if userRole != requiredRole {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient privileges"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (m *JWTMiddleware) RequireAdminRole() gin.HandlerFunc {
	return func(c *gin.Context) {
		m.logger.Info("Admin Role Check", zap.String("path", c.Request.URL.Path))

		userRole, exists := c.Get("user_role")
		if !exists {
			m.logger.Warn("User role not found in context")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found in context"})
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			m.logger.Warn("Invalid user role format", zap.Any("role", userRole))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user role format"})
			c.Abort()
			return
		}

		m.logger.Info("Checking admin role", zap.String("user_role", roleStr))

		// Allow admin role only (from our new schema)
		if roleStr != "admin" {
			m.logger.Warn("Insufficient privileges", zap.String("user_role", roleStr), zap.String("required", "admin"))
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin role required"})
			c.Abort()
			return
		}

		m.logger.Info("Admin role check passed", zap.String("user_role", roleStr))
		c.Next()
	}
}

func (m *JWTMiddleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.Next()
			return
		}

		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(m.secret), nil
		})

		if err == nil {
			if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
				c.Set("user_id", claims.UserID)
				c.Set("user_email", claims.Email)
				c.Set("user_role", claims.Role)
			}
		}

		c.Next()
	}
}