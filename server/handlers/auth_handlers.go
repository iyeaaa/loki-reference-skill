package handlers

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strings"
	"time"

	db "server/db/sqlc"
	"server/middleware"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

type EmailLoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type User struct {
	ID             string  `json:"id"`
	Username       string  `json:"username"`
	Email          string  `json:"email"`
	UserRole       string  `json:"user_role"`
	IsActive       bool    `json:"is_active"`
	DepartmentID   string  `json:"department_id"`
	EmployeeID     string  `json:"employee_id"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
	LastLoginAt    *string `json:"last_login_at"`
	DepartmentName string  `json:"department_name"`
	DepartmentCode string  `json:"department_code"`
}

func (h *Handler) EmailLogin(c *gin.Context) {
	var req EmailLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Email login attempt", zap.String("email", req.Email))

	user, err := h.queries.GetUserByEmail(context.Background(), req.Email)
	if err != nil {
		if err == sql.ErrNoRows {
			h.logger.Warn("User not found", zap.String("email", req.Email))
			c.JSON(http.StatusUnauthorized, gin.H{"error": "이메일 또는 비밀번호가 올바르지 않습니다."})
			return
		}
		h.logger.Error("Failed to get user by email", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."})
		return
	}

	// Check if user has password hash
	if !user.PasswordHash.Valid {
		h.logger.Warn("User has no password set", zap.String("email", req.Email))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "이메일 또는 비밀번호가 올바르지 않습니다."})
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash.String), []byte(req.Password))
	if err != nil {
		h.logger.Warn("Invalid password", zap.String("email", req.Email))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "이메일 또는 비밀번호가 올바르지 않습니다."})
		return
	}

	// Check if user is active
	if !user.IsActive {
		h.logger.Warn("User is not active", zap.String("email", req.Email))
		c.JSON(http.StatusUnauthorized, gin.H{"error": "계정이 비활성화 상태입니다. 관리자의 승인이 필요합니다. 관리자에게 계정 활성화를 요청하세요."})
		return
	}

	// Check if user has allowed role
	allowedRoles := []string{"admin", "internal_reviewer", "external_reviewer"}
	roleAllowed := false
	for _, role := range allowedRoles {
		if string(user.UserRole) == role {
			roleAllowed = true
			break
		}
	}
	if !roleAllowed {
		h.logger.Warn("User does not have allowed role", zap.String("email", req.Email), zap.String("role", string(user.UserRole)))
		c.JSON(http.StatusForbidden, gin.H{"error": "접근 권한이 없습니다. 관리자(admin), 내부 검수자(internal_reviewer) 또는 외부 검수자(external_reviewer) 권한이 필요합니다. 관리자에게 권한 변경을 요청하세요."})
		return
	}

	// Update last login
	err = h.queries.UpdateLastLogin(context.Background(), user.ID)
	if err != nil {
		h.logger.Error("Failed to update last login", zap.Error(err))
		// Continue anyway, this is not critical
	}

	// Generate JWT token
	token, err := h.generateJWT(user.ID, user.Email, string(user.UserRole))
	if err != nil {
		h.logger.Error("Failed to generate JWT token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "인증 토큰 생성에 실패했습니다. 잠시 후 다시 시도해주세요."})
		return
	}

	h.logger.Info("Login successful", zap.String("email", req.Email), zap.String("user_id", user.ID.String()))

	// Convert to response format
	var lastLoginStr *string
	if user.LastLoginAt.Valid {
		formatted := user.LastLoginAt.Time.Format("2006-01-02T15:04:05Z")
		lastLoginStr = &formatted
	}
	
	responseUser := User{
		ID:             user.ID.String(),
		Username:       user.Username,
		Email:          user.Email,
		UserRole:       string(user.UserRole),
		IsActive:       user.IsActive,
		DepartmentID:   user.DepartmentID.String(),
		EmployeeID:     user.EmployeeID,
		CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		LastLoginAt:    lastLoginStr,
		DepartmentName: user.DepartmentName,
		DepartmentCode: user.DepartmentCode,
	}

	c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  responseUser,
	})
}

func (h *Handler) VerifyToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	user, err := h.queries.GetUser(context.Background(), userUUID)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		h.logger.Error("Failed to get user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	var lastLoginStr *string
	if user.LastLoginAt.Valid {
		formatted := user.LastLoginAt.Time.Format("2006-01-02T15:04:05Z")
		lastLoginStr = &formatted
	}
	
	responseUser := User{
		ID:             user.ID.String(),
		Username:       user.Username,
		Email:          user.Email,
		UserRole:       string(user.UserRole),
		IsActive:       user.IsActive,
		DepartmentID:   user.DepartmentID.String(),
		EmployeeID:     user.EmployeeID,
		CreatedAt:      user.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:      user.UpdatedAt.Format("2006-01-02T15:04:05Z"),
		LastLoginAt:    lastLoginStr,
		DepartmentName: user.DepartmentName,
		DepartmentCode: user.DepartmentCode,
	}

	c.JSON(http.StatusOK, gin.H{"user": responseUser})
}

func (h *Handler) RefreshToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userEmail, exists := c.Get("user_email")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User email not found"})
		return
	}

	userRole, exists := c.Get("user_role")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
		return
	}

	// Generate new JWT token
	userIDStr, ok := userID.(string)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	token, err := h.generateJWT(userUUID, userEmail.(string), userRole.(string))
	if err != nil {
		h.logger.Error("Failed to generate refresh token", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refresh authentication token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token})
}

func (h *Handler) CheckAdminRole(c *gin.Context) {
	userRole, exists := c.Get("user_role")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
		return
	}

	isAdmin := userRole.(string) == "admin"
	c.JSON(http.StatusOK, gin.H{"is_admin": isAdmin})
}

func (h *Handler) generateJWT(userID uuid.UUID, email, role string) (string, error) {
	// Get JWT secret from environment variable with fallback
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "hana-lang-connect-jwt-secret-key" // Fallback for development
		h.logger.Warn("JWT_SECRET environment variable not set, using fallback")
	}

	claims := middleware.JWTClaims{
		UserID: userID.String(),
		Email:  email,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "hana-lang-connect-admin",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

type SignupRequest struct {
	Username     string `json:"username" binding:"required,min=3,max=50"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=6"`
	DepartmentID string `json:"department_id" binding:"required"`
	EmployeeID   string `json:"employee_id" binding:"required,min=1,max=20"`
}

func (h *Handler) Signup(c *gin.Context) {
	var req SignupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Signup attempt", zap.String("email", req.Email))

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "비밀번호 처리에 실패했습니다."})
		return
	}

	// Parse department ID
	deptID, err := uuid.Parse(req.DepartmentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "유효하지 않은 부서 ID입니다."})
		return
	}

	// Create user with default "user" role and inactive status
	user, err := h.queries.CreateUser(context.Background(), db.CreateUserParams{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: sql.NullString{String: string(hashedPassword), Valid: true},
		UserRole:     db.UserRoleEnumUser, // Default role for new signups
		IsActive:     false, // Require admin approval
		DepartmentID: deptID,
		EmployeeID:   req.EmployeeID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			if strings.Contains(err.Error(), "email") {
				c.JSON(http.StatusConflict, gin.H{"error": "이미 사용 중인 이메일입니다."})
			} else if strings.Contains(err.Error(), "username") {
				c.JSON(http.StatusConflict, gin.H{"error": "이미 사용 중인 사용자명입니다."})
			} else {
				c.JSON(http.StatusConflict, gin.H{"error": "이미 존재하는 사용자입니다."})
			}
			return
		}
		h.logger.Error("Failed to create user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "사용자 생성에 실패했습니다."})
		return
	}

	h.logger.Info("User registered successfully", zap.String("email", req.Email), zap.String("user_id", user.ID.String()))

	c.JSON(http.StatusCreated, gin.H{
		"message": "회원가입이 완료되었습니다. 관리자 승인 후 사용할 수 있습니다.",
		"user": gin.H{
			"id":       user.ID.String(),
			"username": user.Username,
			"email":    user.Email,
		},
	})
}

