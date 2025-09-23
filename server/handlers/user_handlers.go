package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	db "server/db/sqlc"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// Helper function to convert sql.NullTime to *time.Time
func nullTimeToPtr(nt sql.NullTime) *time.Time {
	if !nt.Valid {
		return nil
	}
	return &nt.Time
}

// Helper function to parse JSON language data
func parseLanguagesJSON(data interface{}) []LanguageInfo {
	if data == nil {
		return []LanguageInfo{}
	}

	var languages []LanguageInfo
	
	// Try different type assertions based on what sqlc might return
	switch v := data.(type) {
	case json.RawMessage:
		if len(v) == 0 {
			return []LanguageInfo{}
		}
		if err := json.Unmarshal(v, &languages); err != nil {
			return []LanguageInfo{}
		}
	case []byte:
		if len(v) == 0 {
			return []LanguageInfo{}
		}
		if err := json.Unmarshal(v, &languages); err != nil {
			return []LanguageInfo{}
		}
	case string:
		if v == "" {
			return []LanguageInfo{}
		}
		if err := json.Unmarshal([]byte(v), &languages); err != nil {
			return []LanguageInfo{}
		}
	default:
		// Try to marshal then unmarshal as last resort
		if jsonBytes, err := json.Marshal(v); err == nil {
			json.Unmarshal(jsonBytes, &languages)
		}
	}
	
	return languages
}

type LanguageInfo struct {
	ID         string `json:"id"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	NativeName string `json:"native_name"`
	IsActive   bool   `json:"is_active"`
}

type UserResponse struct {
	ID              string          `json:"id"`
	Username        string          `json:"username"`
	Email           string          `json:"email"`
	UserRole        db.UserRoleEnum `json:"user_role"`
	IsActive        bool            `json:"is_active"`
	DepartmentID    string          `json:"department_id"`
	EmployeeID      string          `json:"employee_id"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	LastLoginAt     *time.Time      `json:"last_login_at"`
	DepartmentName  string          `json:"department_name,omitempty"`
	DepartmentCode  string          `json:"department_code,omitempty"`
	EditLanguages   []LanguageInfo  `json:"edit_languages"`
	ReviewLanguages []LanguageInfo  `json:"review_languages"`
}

type CreateUserRequest struct {
	Username        string          `json:"username" binding:"required,min=3,max=50"`
	Email           string          `json:"email" binding:"required,email"`
	Password        string          `json:"password" binding:"required,min=6"`
	UserRole        db.UserRoleEnum `json:"user_role" binding:"required"`
	IsActive        *bool           `json:"is_active"`
	DepartmentID    string          `json:"department_id" binding:"required"`
	EmployeeID      string          `json:"employee_id" binding:"required,min=1,max=20"`
	EditLanguages   []string        `json:"edit_languages"`
	ReviewLanguages []string        `json:"review_languages"`
}

type UpdateUserRequest struct {
	Username        string          `json:"username" binding:"required,min=3,max=50"`
	Email           string          `json:"email" binding:"required,email"`
	UserRole        db.UserRoleEnum `json:"user_role" binding:"required"`
	IsActive        *bool           `json:"is_active"`
	DepartmentID    string          `json:"department_id" binding:"required"`
	EmployeeID      string          `json:"employee_id" binding:"required,min=1,max=20"`
	EditLanguages   []string        `json:"edit_languages"`
	ReviewLanguages []string        `json:"review_languages"`
}

type UpdatePasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type ListUsersResponse struct {
	Users      []UserResponse `json:"users"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"total_pages"`
}

func (h *Handler) GetUserByIdWithManagement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.queries.GetUser(c.Request.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		h.logger.Error("Failed to get user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve user"})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		ID:              user.ID.String(),
		Username:        user.Username,
		Email:           user.Email,
		UserRole:        user.UserRole,
		IsActive:        user.IsActive,
		DepartmentID:    user.DepartmentID.String(),
		EmployeeID:      user.EmployeeID,
		CreatedAt:       user.CreatedAt,
		UpdatedAt:       user.UpdatedAt,
		LastLoginAt:     nullTimeToPtr(user.LastLoginAt),
		DepartmentName:  user.DepartmentName,
		DepartmentCode:  user.DepartmentCode,
		EditLanguages:   parseLanguagesJSON(user.EditLanguages),
		ReviewLanguages: parseLanguagesJSON(user.ReviewLanguages),
	})
}

func (h *Handler) ListUsersWithManagement(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit
	
	// Check for multi-filter parameters first
	rolesStr := c.Query("roles")
	isActiveStr := c.Query("is_active")
	departmentIdsStr := c.Query("department_ids")
	search := c.Query("search")
	
	// If multi-filters are provided, use ListUsersWithMultiFilters
	if rolesStr != "" || departmentIdsStr != "" || (isActiveStr != "" && strings.Contains(isActiveStr, ",")) {
		// Use multi-filter query
		h.logger.Debug("Using multi-filter query",
			zap.String("roles", rolesStr),
			zap.String("is_active", isActiveStr),
			zap.String("department_ids", departmentIdsStr),
			zap.String("search", search),
		)
		
		users, err := h.queries.ListUsersWithMultiFilters(c.Request.Context(), db.ListUsersWithMultiFiltersParams{
			Limit:  int32(limit),
			Offset: int32(offset),
			Column3: rolesStr,      // roles parameter (can be empty string)
			Column4: isActiveStr,   // is_active parameter (can be empty string)
			Column5: departmentIdsStr, // department_ids parameter (can be empty string)
			Column6: search,        // search parameter (can be empty string)
		})
		if err != nil {
			h.logger.Error("Failed to list users with multi filters", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
			return
		}
		
		total, err := h.queries.CountUsersWithMultiFilters(c.Request.Context(), db.CountUsersWithMultiFiltersParams{
			Column1: rolesStr,         // roles parameter
			Column2: isActiveStr,      // is_active parameter
			Column3: departmentIdsStr, // department_ids parameter
			Column4: search,           // search parameter
		})
		if err != nil {
			h.logger.Error("Failed to count users with multi filters", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count users"})
			return
		}
		
		userResponses := make([]UserResponse, 0, len(users))
		for _, user := range users {
			userResponses = append(userResponses, UserResponse{
				ID:              user.ID.String(),
				Username:        user.Username,
				Email:           user.Email,
				UserRole:        user.UserRole,
				IsActive:        user.IsActive,
				DepartmentID:    user.DepartmentID.String(),
				EmployeeID:      user.EmployeeID,
				CreatedAt:       user.CreatedAt,
				UpdatedAt:       user.UpdatedAt,
				LastLoginAt:     nullTimeToPtr(user.LastLoginAt),
				DepartmentName:  user.DepartmentName,
				DepartmentCode:  user.DepartmentCode,
				EditLanguages:   parseLanguagesJSON(user.EditLanguages),
				ReviewLanguages: parseLanguagesJSON(user.ReviewLanguages),
			})
		}
		
		response := ListUsersResponse{
			Users:      userResponses,
			Total:      total,
			Page:       page,
			Limit:      limit,
			TotalPages: int((total + int64(limit) - 1) / int64(limit)),
		}
		
		c.JSON(http.StatusOK, response)
		return
	}
	
	// Otherwise, use single filter query for backward compatibility
	roleStr := c.Query("role")
	
	// Build nullable parameters
	var roleParam db.NullUserRoleEnum
	if roleStr != "" {
		roleParam = db.NullUserRoleEnum{
			UserRoleEnum: db.UserRoleEnum(roleStr),
			Valid:        true,
		}
	}

	var isActiveParam sql.NullBool
	if isActiveStr != "" {
		if parsedActive, err := strconv.ParseBool(isActiveStr); err == nil {
			isActiveParam = sql.NullBool{
				Bool:  parsedActive,
				Valid: true,
			}
		}
	}

	var searchParam sql.NullString
	if search != "" {
		searchParam = sql.NullString{
			String: search,
			Valid:  true,
		}
	}

	users, err := h.queries.ListUsersWithFilters(c.Request.Context(), db.ListUsersWithFiltersParams{
		Limit:    int32(limit),
		Offset:   int32(offset),
		Role:     roleParam,
		IsActive: isActiveParam,
		Search:   searchParam,
	})
	if err != nil {
		h.logger.Error("Failed to list users", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve users"})
		return
	}

	total, err := h.queries.CountUsersWithFilters(c.Request.Context(), db.CountUsersWithFiltersParams{
		Role:     roleParam,
		IsActive: isActiveParam,
		Search:   searchParam,
	})
	if err != nil {
		h.logger.Error("Failed to count users", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count users"})
		return
	}

	userResponses := make([]UserResponse, 0, len(users))
	for i, user := range users {
		// Debug logging for first user
		if i == 0 {
			h.logger.Debug("Raw language data from DB",
				zap.Any("edit_languages_raw", user.EditLanguages),
				zap.Any("review_languages_raw", user.ReviewLanguages),
				zap.String("edit_languages_type", fmt.Sprintf("%T", user.EditLanguages)),
				zap.String("review_languages_type", fmt.Sprintf("%T", user.ReviewLanguages)),
			)
		}
		
		editLangs := parseLanguagesJSON(user.EditLanguages)
		reviewLangs := parseLanguagesJSON(user.ReviewLanguages)
		
		if i == 0 {
			h.logger.Debug("Parsed language data",
				zap.Int("edit_languages_count", len(editLangs)),
				zap.Int("review_languages_count", len(reviewLangs)),
				zap.Any("edit_languages", editLangs),
				zap.Any("review_languages", reviewLangs),
			)
		}
		
		userResponses = append(userResponses, UserResponse{
			ID:              user.ID.String(),
			Username:        user.Username,
			Email:           user.Email,
			UserRole:        user.UserRole,
			IsActive:        user.IsActive,
			DepartmentID:    user.DepartmentID.String(),
			EmployeeID:      user.EmployeeID,
			CreatedAt:       user.CreatedAt,
			UpdatedAt:       user.UpdatedAt,
			LastLoginAt:     nullTimeToPtr(user.LastLoginAt),
			DepartmentName:  user.DepartmentName,
			DepartmentCode:  user.DepartmentCode,
			EditLanguages:   editLangs,
			ReviewLanguages: reviewLangs,
		})
	}

	response := ListUsersResponse{
		Users:      userResponses,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: int((total + int64(limit) - 1) / int64(limit)),
	}
	
	// Log response data for debugging
	h.logger.Info("Sending user list response",
		zap.Int("user_count", len(userResponses)),
		zap.Int64("total", total),
		zap.Int("page", page),
		zap.Int("limit", limit),
		zap.Int("total_pages", response.TotalPages),
		zap.Any("first_user", func() interface{} {
			if len(userResponses) > 0 {
				return map[string]interface{}{
					"id": userResponses[0].ID,
					"username": userResponses[0].Username,
					"edit_languages_count": len(userResponses[0].EditLanguages),
					"review_languages_count": len(userResponses[0].ReviewLanguages),
				}
			}
			return nil
		}()),
	)
	
	c.JSON(http.StatusOK, response)
}

func (h *Handler) CreateUserWithManagement(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	deptID, err := uuid.Parse(req.DepartmentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid department ID"})
		return
	}

	user, err := h.queries.CreateUser(c.Request.Context(), db.CreateUserParams{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: sql.NullString{String: string(hashedPassword), Valid: true},
		UserRole:     req.UserRole,
		IsActive:     isActive,
		DepartmentID: deptID,
		EmployeeID:   req.EmployeeID,
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "Username or email already exists"})
			return
		}
		h.logger.Error("Failed to create user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Save language permissions
	for _, langCode := range req.EditLanguages {
		err = h.queries.AddUserEditLanguage(c.Request.Context(), db.AddUserEditLanguageParams{
			UserID: user.ID,
			Code:   langCode,
		})
		if err != nil {
			h.logger.Error("Failed to add edit language permission", zap.Error(err), zap.String("language", langCode))
		}
	}

	for _, langCode := range req.ReviewLanguages {
		err = h.queries.AddUserReviewLanguage(c.Request.Context(), db.AddUserReviewLanguageParams{
			UserID: user.ID,
			Code:   langCode,
		})
		if err != nil {
			h.logger.Error("Failed to add review language permission", zap.Error(err), zap.String("language", langCode))
		}
	}

	// Fetch the created user with language permissions to avoid multiple queries
	createdUser, err := h.queries.GetUser(c.Request.Context(), user.ID)
	if err != nil {
		h.logger.Error("Failed to fetch created user", zap.Error(err))
		// Fallback to basic response without language info
		c.JSON(http.StatusCreated, UserResponse{
			ID:              user.ID.String(),
			Username:        user.Username,
			Email:           user.Email,
			UserRole:        user.UserRole,
			IsActive:        user.IsActive,
			DepartmentID:    user.DepartmentID.String(),
			EmployeeID:      user.EmployeeID,
			CreatedAt:       user.CreatedAt,
			UpdatedAt:       user.UpdatedAt,
			EditLanguages:   []LanguageInfo{},
			ReviewLanguages: []LanguageInfo{},
		})
		return
	}

	c.JSON(http.StatusCreated, UserResponse{
		ID:              createdUser.ID.String(),
		Username:        createdUser.Username,
		Email:           createdUser.Email,
		UserRole:        createdUser.UserRole,
		IsActive:        createdUser.IsActive,
		DepartmentID:    createdUser.DepartmentID.String(),
		EmployeeID:      createdUser.EmployeeID,
		CreatedAt:       createdUser.CreatedAt,
		UpdatedAt:       createdUser.UpdatedAt,
		LastLoginAt:     nullTimeToPtr(createdUser.LastLoginAt),
		DepartmentName:  createdUser.DepartmentName,
		DepartmentCode:  createdUser.DepartmentCode,
		EditLanguages:   parseLanguagesJSON(createdUser.EditLanguages),
		ReviewLanguages: parseLanguagesJSON(createdUser.ReviewLanguages),
	})
}

func (h *Handler) UpdateUserWithManagement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	deptID, err := uuid.Parse(req.DepartmentID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid department ID"})
		return
	}

	user, err := h.queries.UpdateUser(c.Request.Context(), db.UpdateUserParams{
		ID:           id,
		Username:     req.Username,
		Email:        req.Email,
		UserRole:     req.UserRole,
		IsActive:     isActive,
		DepartmentID: deptID,
		EmployeeID:   req.EmployeeID,
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		if strings.Contains(err.Error(), "duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "Username or email already exists"})
			return
		}
		h.logger.Error("Failed to update user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	// Update language permissions
	// First, remove all existing permissions
	err = h.queries.RemoveAllUserEditLanguages(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to remove edit languages", zap.Error(err))
	}

	err = h.queries.RemoveAllUserReviewLanguages(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to remove review languages", zap.Error(err))
	}

	// Then add new permissions
	for _, langCode := range req.EditLanguages {
		err = h.queries.AddUserEditLanguage(c.Request.Context(), db.AddUserEditLanguageParams{
			UserID: id,
			Code:   langCode,
		})
		if err != nil {
			h.logger.Error("Failed to add edit language permission", zap.Error(err), zap.String("language", langCode))
		}
	}

	for _, langCode := range req.ReviewLanguages {
		err = h.queries.AddUserReviewLanguage(c.Request.Context(), db.AddUserReviewLanguageParams{
			UserID: id,
			Code:   langCode,
		})
		if err != nil {
			h.logger.Error("Failed to add review language permission", zap.Error(err), zap.String("language", langCode))
		}
	}

	// Fetch the updated user with language permissions to avoid multiple queries
	updatedUser, err := h.queries.GetUser(c.Request.Context(), user.ID)
	if err != nil {
		h.logger.Error("Failed to fetch updated user", zap.Error(err))
		// Fallback to basic response without language info
		c.JSON(http.StatusOK, UserResponse{
			ID:              user.ID.String(),
			Username:        user.Username,
			Email:           user.Email,
			UserRole:        user.UserRole,
			IsActive:        user.IsActive,
			DepartmentID:    user.DepartmentID.String(),
			EmployeeID:      user.EmployeeID,
			CreatedAt:       user.CreatedAt,
			UpdatedAt:       user.UpdatedAt,
			EditLanguages:   []LanguageInfo{},
			ReviewLanguages: []LanguageInfo{},
		})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		ID:              updatedUser.ID.String(),
		Username:        updatedUser.Username,
		Email:           updatedUser.Email,
		UserRole:        updatedUser.UserRole,
		IsActive:        updatedUser.IsActive,
		DepartmentID:    updatedUser.DepartmentID.String(),
		EmployeeID:      updatedUser.EmployeeID,
		CreatedAt:       updatedUser.CreatedAt,
		UpdatedAt:       updatedUser.UpdatedAt,
		LastLoginAt:     nullTimeToPtr(updatedUser.LastLoginAt),
		DepartmentName:  updatedUser.DepartmentName,
		DepartmentCode:  updatedUser.DepartmentCode,
		EditLanguages:   parseLanguagesJSON(updatedUser.EditLanguages),
		ReviewLanguages: parseLanguagesJSON(updatedUser.ReviewLanguages),
	})
}

func (h *Handler) DeleteUserWithManagement(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	_, err = h.queries.GetUser(c.Request.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		h.logger.Error("Failed to check user existence", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	err = h.queries.DeleteUser(c.Request.Context(), id)
	if err != nil {
		h.logger.Error("Failed to delete user", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user"})
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

func (h *Handler) ChangeUserPassword(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		h.logger.Error("Failed to hash password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	user, err := h.queries.UpdateUserPassword(c.Request.Context(), db.UpdateUserPasswordParams{
		ID:           id,
		PasswordHash: sql.NullString{String: string(hashedPassword), Valid: true},
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		h.logger.Error("Failed to update password", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, UserResponse{
		ID:       user.ID.String(),
		Username: user.Username,
		Email:    user.Email,
		UserRole: user.UserRole,
		IsActive: user.IsActive,
	})
}

func (h *Handler) GetUserStats(c *gin.Context) {
	total, err := h.queries.CountUsers(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to count total users", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user statistics"})
		return
	}

	activeCount, err := h.queries.CountUsersWithFilters(c.Request.Context(), db.CountUsersWithFiltersParams{
		IsActive: sql.NullBool{Bool: true, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to count active users", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user statistics"})
		return
	}

	inactiveCount := total - activeCount

	adminCount, err := h.queries.CountUsersWithFilters(c.Request.Context(), db.CountUsersWithFiltersParams{
		Role: db.NullUserRoleEnum{UserRoleEnum: db.UserRoleEnumAdmin, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to count admin users", zap.Error(err))
		adminCount = 0
	}

	userCount, err := h.queries.CountUsersWithFilters(c.Request.Context(), db.CountUsersWithFiltersParams{
		Role: db.NullUserRoleEnum{UserRoleEnum: db.UserRoleEnumUser, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to count regular users", zap.Error(err))
		userCount = 0
	}

	internalReviewerCount, err := h.queries.CountUsersWithFilters(c.Request.Context(), db.CountUsersWithFiltersParams{
		Role: db.NullUserRoleEnum{UserRoleEnum: db.UserRoleEnumInternalReviewer, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to count internal reviewer users", zap.Error(err))
		internalReviewerCount = 0
	}

	externalReviewerCount, err := h.queries.CountUsersWithFilters(c.Request.Context(), db.CountUsersWithFiltersParams{
		Role: db.NullUserRoleEnum{UserRoleEnum: db.UserRoleEnumExternalReviewer, Valid: true},
	})
	if err != nil {
		h.logger.Error("Failed to count external reviewer users", zap.Error(err))
		externalReviewerCount = 0
	}

	stats := map[string]interface{}{
		"total":    total,
		"active":   activeCount,
		"inactive": inactiveCount,
		"by_role": map[string]interface{}{
			"admin":             adminCount,
			"user":              userCount,
			"internal_reviewer": internalReviewerCount,
			"external_reviewer": externalReviewerCount,
		},
	}

	c.JSON(http.StatusOK, stats)
}

func (h *Handler) BulkUpdateUsersStatus(c *gin.Context) {
	var req struct {
		UserIDs  []string `json:"user_ids" binding:"required"`
		IsActive bool     `json:"is_active"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Starting bulk status update",
		zap.Int("user_count", len(req.UserIDs)),
		zap.Bool("is_active", req.IsActive),
	)

	updated := 0
	failed := 0
	for _, userIDStr := range req.UserIDs {
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			h.logger.Error("Invalid user ID in bulk update", 
				zap.String("user_id", userIDStr),
				zap.Error(err))
			failed++
			continue
		}

		currentUser, err := h.queries.GetUser(c.Request.Context(), userID)
		if err != nil {
			h.logger.Error("Failed to get user for bulk update", 
				zap.String("user_id", userIDStr),
				zap.Error(err))
			failed++
			continue
		}

		_, err = h.queries.UpdateUser(c.Request.Context(), db.UpdateUserParams{
			ID:           userID,
			Username:     currentUser.Username,
			Email:        currentUser.Email,
			UserRole:     currentUser.UserRole,
			IsActive:     req.IsActive,
			DepartmentID: currentUser.DepartmentID,
			EmployeeID:   currentUser.EmployeeID,
		})
		if err != nil {
			h.logger.Error("Failed to update user status", 
				zap.String("user_id", userIDStr),
				zap.String("username", currentUser.Username),
				zap.Error(err))
			failed++
			continue
		}
		updated++
		h.logger.Debug("Updated user status",
			zap.String("user_id", userIDStr),
			zap.String("username", currentUser.Username),
			zap.Bool("is_active", req.IsActive),
		)
	}

	h.logger.Info("Bulk status update completed",
		zap.Int("updated", updated),
		zap.Int("failed", failed),
		zap.Int("total", len(req.UserIDs)),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk status update completed",
		"updated": updated,
		"failed":  failed,
		"total":   len(req.UserIDs),
	})
}

func (h *Handler) BulkUpdateUsersRole(c *gin.Context) {
	var req struct {
		UserIDs  []string        `json:"user_ids" binding:"required"`
		UserRole db.UserRoleEnum `json:"user_role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info("Starting bulk role update",
		zap.Int("user_count", len(req.UserIDs)),
		zap.String("new_role", string(req.UserRole)),
	)

	updated := 0
	failed := 0
	for _, userIDStr := range req.UserIDs {
		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			h.logger.Error("Invalid user ID in bulk update", 
				zap.String("user_id", userIDStr),
				zap.Error(err))
			failed++
			continue
		}

		currentUser, err := h.queries.GetUser(c.Request.Context(), userID)
		if err != nil {
			h.logger.Error("Failed to get user for bulk update", 
				zap.String("user_id", userIDStr),
				zap.Error(err))
			failed++
			continue
		}

		_, err = h.queries.UpdateUser(c.Request.Context(), db.UpdateUserParams{
			ID:           userID,
			Username:     currentUser.Username,
			Email:        currentUser.Email,
			UserRole:     req.UserRole,
			IsActive:     currentUser.IsActive,
			DepartmentID: currentUser.DepartmentID,
			EmployeeID:   currentUser.EmployeeID,
		})
		if err != nil {
			h.logger.Error("Failed to update user role", 
				zap.String("user_id", userIDStr),
				zap.String("username", currentUser.Username),
				zap.Error(err))
			failed++
			continue
		}
		updated++
		h.logger.Debug("Updated user role",
			zap.String("user_id", userIDStr),
			zap.String("username", currentUser.Username),
			zap.String("new_role", string(req.UserRole)),
		)
	}

	h.logger.Info("Bulk role update completed",
		zap.Int("updated", updated),
		zap.Int("failed", failed),
		zap.Int("total", len(req.UserIDs)),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk role update completed",
		"updated": updated,
		"failed":  failed,
		"total":   len(req.UserIDs),
	})
}
