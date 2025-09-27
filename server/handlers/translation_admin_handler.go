package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	db "server/db/sqlc"
	pkgredis "server/internal/pkg/redis"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
	"go.uber.org/zap"
)

// TranslationResponse represents a translation data response
type TranslationResponse struct {
	ID                      string                 `json:"id"`
	SourceText              string                 `json:"source_text"`
	TargetLanguage          string                 `json:"target_language"`
	TranslatedText          string                 `json:"translated_text"`
	TranslationEngine       string                 `json:"translation_engine"`
	RedisKey                string                 `json:"redis_key"`
	ElementContext          map[string]interface{} `json:"element_context,omitempty"`
	QualityConfidenceScore  *int32                 `json:"quality_confidence_score,omitempty"`
	CreatedBy               *string                `json:"created_by,omitempty"`
	CreatedAt               string                 `json:"created_at"`
	UpdatedAt               string                 `json:"updated_at"`
	ReviewStatus            string                 `json:"review_status,omitempty"`
}

// ListTranslationsResponse represents paginated translations response
type ListTranslationsResponse struct {
	Translations []TranslationResponse `json:"translations"`
	Total        int64                 `json:"total"`
	Page         int                   `json:"page"`
	Limit        int                   `json:"limit"`
	TotalPages   int                   `json:"total_pages"`
}

// ListTranslationsAdmin handles GET /api/v1/admin/translations
func (h *Handler) ListTranslationsAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}

	offset := (page - 1) * limit

	// Get filter parameters
	targetLang := c.Query("target_language")
	search := c.Query("search")
	engine := c.Query("engine")
	reviewStatus := c.Query("review_status")

	h.logger.Info("Listing translations",
		zap.Int("page", page),
		zap.Int("limit", limit),
		zap.String("target_language", targetLang),
		zap.String("search", search),
		zap.String("engine", engine),
		zap.String("review_status", reviewStatus),
	)

	var translations []db.TranslationDatum
	var total int64
	var err error

	// Use the new multi-filter query when any filters are present
	if search != "" || targetLang != "" || engine != "" || reviewStatus != "" {
		// Use the new multiple filters query
		translations, err = h.queries.ListTranslationsWithMultipleFilters(c.Request.Context(), db.ListTranslationsWithMultipleFiltersParams{
			Column1: search,
			Column2: targetLang,
			Column3: engine,
			Column4: reviewStatus,
			Limit:   int32(limit),
			Offset:  int32(offset),
		})
		if err != nil {
			h.logger.Error("Failed to list translations with multiple filters", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve translations"})
			return
		}

		// Count with multiple filters
		total, err = h.queries.CountTranslationsWithMultipleFilters(c.Request.Context(), db.CountTranslationsWithMultipleFiltersParams{
			Column1: search,
			Column2: targetLang,
			Column3: engine,
			Column4: reviewStatus,
		})
		if err != nil {
			h.logger.Error("Failed to count translations with multiple filters", zap.Error(err))
			total = int64(len(translations))
		}
	} else {
		// List all translations when no filters
		translations, err = h.queries.ListTranslations(c.Request.Context(), db.ListTranslationsParams{
			Limit:  int32(limit),
			Offset: int32(offset),
		})
		if err != nil {
			h.logger.Error("Failed to list translations", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve translations"})
			return
		}
		// Count all translations
		total, err = h.queries.CountAllTranslations(c.Request.Context())
		if err != nil {
			h.logger.Error("Failed to count all translations", zap.Error(err))
			total = int64(len(translations))
		}
	}

	// Convert to response format
	translationResponses := make([]TranslationResponse, 0, len(translations))
	for _, t := range translations {
		// Parse element context
		var elementContext map[string]interface{}
		if t.ElementContext.Valid && len(t.ElementContext.RawMessage) > 0 {
			if err := json.Unmarshal(t.ElementContext.RawMessage, &elementContext); err != nil {
				h.logger.Warn("Failed to unmarshal element context", zap.Error(err))
			}
		}

		// Get review status if exists
		reviewStatus := "pending"
		reviewRow, err := h.queries.GetTranslationReviewStatus(c.Request.Context(), t.ID)
		if err == nil && reviewRow.Valid {
			reviewStatus = string(reviewRow.ReviewStatusEnum)
		}

		resp := TranslationResponse{
			ID:                     t.ID.String(),
			SourceText:             t.SourceText,
			TargetLanguage:         t.TargetLanguage,
			TranslatedText:         t.TranslatedText,
			TranslationEngine:      t.TranslationEngine.String,
			RedisKey:               t.RedisKey.String,
			ElementContext:         elementContext,
			QualityConfidenceScore: func() *int32 {
			if t.QualityConfidenceScore.Valid {
				return &t.QualityConfidenceScore.Int32
			}
			return nil
		}(),
			CreatedAt:              t.CreatedAt.Time.UTC().Format(time.RFC3339),
			UpdatedAt:              t.UpdatedAt.Time.UTC().Format(time.RFC3339),
			ReviewStatus:           reviewStatus,
		}

		if t.CreatedBy.Valid {
			createdBy := t.CreatedBy.UUID.String()
			resp.CreatedBy = &createdBy
		}

		translationResponses = append(translationResponses, resp)
	}

	response := ListTranslationsResponse{
		Translations: translationResponses,
		Total:        total,
		Page:         page,
		Limit:        limit,
		TotalPages:   int((total + int64(limit) - 1) / int64(limit)),
	}

	c.JSON(http.StatusOK, response)
}

// GetTranslationAdmin handles GET /api/v1/admin/translations/:id
func (h *Handler) GetTranslationAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid translation ID"})
		return
	}

	translation, err := h.queries.GetTranslation(c.Request.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Translation not found"})
			return
		}
		h.logger.Error("Failed to get translation", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve translation"})
		return
	}

	// Parse element context
	var elementContext map[string]interface{}
	if translation.ElementContext.Valid && len(translation.ElementContext.RawMessage) > 0 {
		if err := json.Unmarshal(translation.ElementContext.RawMessage, &elementContext); err != nil {
			h.logger.Warn("Failed to unmarshal element context", zap.Error(err))
		}
	}

	// Get review status
	reviewStatus := "pending"
	reviewRow, err := h.queries.GetTranslationReviewStatus(c.Request.Context(), translation.ID)
	if err == nil && reviewRow.Valid {
		reviewStatus = string(reviewRow.ReviewStatusEnum)
	}

	resp := TranslationResponse{
		ID:                     translation.ID.String(),
		SourceText:             translation.SourceText,
		TargetLanguage:         translation.TargetLanguage,
		TranslatedText:         translation.TranslatedText,
		TranslationEngine:      translation.TranslationEngine.String,
		RedisKey:               translation.RedisKey.String,
		ElementContext:         elementContext,
		QualityConfidenceScore: func() *int32 {
			if translation.QualityConfidenceScore.Valid {
				return &translation.QualityConfidenceScore.Int32
			}
			return nil
		}(),
		CreatedAt:              translation.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:              translation.UpdatedAt.Time.UTC().Format(time.RFC3339),
		ReviewStatus:           reviewStatus,
	}

	if translation.CreatedBy.Valid {
		createdBy := translation.CreatedBy.UUID.String()
		resp.CreatedBy = &createdBy
	}

	c.JSON(http.StatusOK, resp)
}

// CreateTranslationRequest represents the request to create a new translation
type CreateTranslationRequest struct {
	SourceText             string                 `json:"source_text" binding:"required"`
	TargetLanguage         string                 `json:"target_language" binding:"required"`
	TranslatedText         string                 `json:"translated_text" binding:"required"`
	TranslationEngine      string                 `json:"translation_engine"`
	ElementContext         map[string]interface{} `json:"element_context"`
	QualityConfidenceScore *int32                 `json:"quality_confidence_score"`
}

// UpdateTranslationRequest represents the request to update a translation
type UpdateTranslationRequest struct {
	TranslatedText         string                 `json:"translated_text" binding:"required"`
	TranslationEngine      string                 `json:"translation_engine"`
	ElementContext         map[string]interface{} `json:"element_context"`
	QualityConfidenceScore *int32                 `json:"quality_confidence_score"`
}

// CreateTranslationAdmin handles POST /api/v1/admin/translations
func (h *Handler) CreateTranslationAdmin(c *gin.Context) {
	var req CreateTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert element context to JSONB
	var contextJSON pqtype.NullRawMessage
	if req.ElementContext != nil {
		jsonBytes, err := json.Marshal(req.ElementContext)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid element context"})
			return
		}
		contextJSON = pqtype.NullRawMessage{
			RawMessage: jsonBytes,
			Valid:      true,
		}
	}

	// Get user ID from context if available
	var createdBy uuid.NullUUID
	if userID, exists := c.Get("user_id"); exists {
		if uid, ok := userID.(uuid.UUID); ok {
			createdBy = uuid.NullUUID{
				UUID:  uid,
				Valid: true,
			}
		}
	}

	// Create translation
	translation, err := h.queries.CreateTranslation(c.Request.Context(), db.CreateTranslationParams{
		SourceText:       req.SourceText,
		TargetLanguage:   req.TargetLanguage,
		TranslatedText:   req.TranslatedText,
		TranslationEngine: sql.NullString{
			String: req.TranslationEngine,
			Valid:  req.TranslationEngine != "",
		},
		RedisKey:       sql.NullString{},
		ElementContext: contextJSON,
		QualityConfidenceScore: func() sql.NullInt32 {
			if req.QualityConfidenceScore != nil {
				return sql.NullInt32{
					Int32: *req.QualityConfidenceScore,
					Valid: true,
				}
			}
			return sql.NullInt32{Valid: false}
		}(),
		CreatedBy: createdBy,
	})
	if err != nil {
		// Check if it's a duplicate key error
		if strings.Contains(err.Error(), "duplicate key") || strings.Contains(err.Error(), "translation_data_source_target_idx") {
			h.logger.Warn("Attempted to create duplicate translation", 
				zap.String("source_text", req.SourceText),
				zap.String("target_language", req.TargetLanguage))
			c.JSON(http.StatusConflict, gin.H{"error": "Translation already exists for this source text and target language"})
			return
		}
		h.logger.Error("Failed to create translation", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create translation"})
		return
	}

	// Create translation review record
	err = h.queries.CreateTranslationReview(c.Request.Context(), db.CreateTranslationReviewParams{
		TranslationID: translation.ID,
		ReviewStatus:  db.NullReviewStatusEnum{
			ReviewStatusEnum: db.ReviewStatusEnumPending,
			Valid:           true,
		},
		Priority: sql.NullInt32{
			Int32: 3,
			Valid: true,
		},
	})
	if err != nil {
		h.logger.Warn("Failed to create translation review record", zap.Error(err))
	}

	// Parse element context for response
	var elementContext map[string]interface{}
	if translation.ElementContext.Valid && len(translation.ElementContext.RawMessage) > 0 {
		if err := json.Unmarshal(translation.ElementContext.RawMessage, &elementContext); err != nil {
			h.logger.Warn("Failed to unmarshal element context", zap.Error(err))
		}
	}

	resp := TranslationResponse{
		ID:                     translation.ID.String(),
		SourceText:             translation.SourceText,
		TargetLanguage:         translation.TargetLanguage,
		TranslatedText:         translation.TranslatedText,
		TranslationEngine:      translation.TranslationEngine.String,
		RedisKey:               translation.RedisKey.String,
		ElementContext:         elementContext,
		QualityConfidenceScore: func() *int32 {
			if translation.QualityConfidenceScore.Valid {
				return &translation.QualityConfidenceScore.Int32
			}
			return nil
		}(),
		CreatedAt:    translation.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:    translation.UpdatedAt.Time.UTC().Format(time.RFC3339),
		ReviewStatus: "pending",
	}

	if translation.CreatedBy.Valid {
		createdBy := translation.CreatedBy.UUID.String()
		resp.CreatedBy = &createdBy
	}

	c.JSON(http.StatusCreated, resp)
}

// UpdateTranslationAdmin handles PUT /api/v1/admin/translations/:id
func (h *Handler) UpdateTranslationAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid translation ID"})
		return
	}

	var req UpdateTranslationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert element context to JSONB
	var contextJSON pqtype.NullRawMessage
	if req.ElementContext != nil {
		jsonBytes, err := json.Marshal(req.ElementContext)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid element context"})
			return
		}
		contextJSON = pqtype.NullRawMessage{
			RawMessage: jsonBytes,
			Valid:      true,
		}
	}

	// Update translation
	translation, err := h.queries.UpdateTranslation(c.Request.Context(), db.UpdateTranslationParams{
		ID:             id,
		TranslatedText: req.TranslatedText,
		TranslationEngine: sql.NullString{
			String: req.TranslationEngine,
			Valid:  req.TranslationEngine != "",
		},
		ElementContext: contextJSON,
		QualityConfidenceScore: func() sql.NullInt32 {
			if req.QualityConfidenceScore != nil {
				return sql.NullInt32{
					Int32: *req.QualityConfidenceScore,
					Valid: true,
				}
			}
			return sql.NullInt32{Valid: false}
		}(),
	})
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Translation not found"})
			return
		}
		h.logger.Error("Failed to update translation", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update translation"})
		return
	}

	// Parse element context for response
	var elementContext map[string]interface{}
	if translation.ElementContext.Valid && len(translation.ElementContext.RawMessage) > 0 {
		if err := json.Unmarshal(translation.ElementContext.RawMessage, &elementContext); err != nil {
			h.logger.Warn("Failed to unmarshal element context", zap.Error(err))
		}
	}

	resp := TranslationResponse{
		ID:                     translation.ID.String(),
		SourceText:             translation.SourceText,
		TargetLanguage:         translation.TargetLanguage,
		TranslatedText:         translation.TranslatedText,
		TranslationEngine:      translation.TranslationEngine.String,
		RedisKey:               translation.RedisKey.String,
		ElementContext:         elementContext,
		QualityConfidenceScore: func() *int32 {
			if translation.QualityConfidenceScore.Valid {
				return &translation.QualityConfidenceScore.Int32
			}
			return nil
		}(),
		CreatedAt:              translation.CreatedAt.Time.UTC().Format(time.RFC3339),
		UpdatedAt:              translation.UpdatedAt.Time.UTC().Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, resp)
}

// DeleteTranslationAdmin handles DELETE /api/v1/admin/translations/:id
func (h *Handler) DeleteTranslationAdmin(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid translation ID"})
		return
	}

	err = h.queries.DeleteTranslation(c.Request.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Translation not found"})
			return
		}
		h.logger.Error("Failed to delete translation", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete translation"})
		return
	}

	// Return a JSON response instead of StatusNoContent
	c.JSON(http.StatusOK, gin.H{"message": "Translation deleted successfully"})
}

// UpdateReviewStatusRequest represents the request to update review status
type UpdateReviewStatusRequest struct {
	ReviewStatus string `json:"review_status" binding:"required,oneof=pending external_review internal_review approved rejected revision_required"`
}

// UpdateTranslationReviewStatus handles PUT /api/v1/admin/translations/:id/review-status
func (h *Handler) UpdateTranslationReviewStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid translation ID"})
		return
	}

	var req UpdateReviewStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Map string to enum
	var reviewStatus db.ReviewStatusEnum
	switch req.ReviewStatus {
	case "pending":
		reviewStatus = db.ReviewStatusEnumPending
	case "external_review":
		reviewStatus = db.ReviewStatusEnumExternalReview
	case "internal_review":
		reviewStatus = db.ReviewStatusEnumInternalReview
	case "approved":
		reviewStatus = db.ReviewStatusEnumApproved
	case "rejected":
		reviewStatus = db.ReviewStatusEnumRejected
	case "revision_required":
		reviewStatus = db.ReviewStatusEnumRevisionRequired
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid review status"})
		return
	}

	// Update review status
	err = h.queries.UpdateTranslationReviewStatus(c.Request.Context(), db.UpdateTranslationReviewStatusParams{
		TranslationID: id,
		ReviewStatus: db.NullReviewStatusEnum{
			ReviewStatusEnum: reviewStatus,
			Valid:            true,
		},
	})
	if err != nil {
		h.logger.Error("Failed to update review status", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update review status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Review status updated successfully"})
}

// ClearRedisCache handles DELETE /api/v1/admin/translations/redis-cache
func (h *Handler) ClearRedisCache(c *gin.Context) {
	redisClient := pkgredis.GetClient()
	if redisClient == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Redis client not available"})
		return
	}

	// FlushDB clears all keys in the current database
	err := redisClient.FlushDB(c.Request.Context()).Err()
	if err != nil {
		h.logger.Error("Failed to clear Redis cache", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear Redis cache"})
		return
	}

	h.logger.Info("Redis cache cleared successfully")
	c.JSON(http.StatusOK, gin.H{"message": "Redis cache cleared successfully"})
}

// MatrixTranslationGroup represents a group of translations for a single source text
type MatrixTranslationGroup struct {
	SourceText   string                         `json:"source_text"`
	Translations map[string]TranslationResponse `json:"translations"`
}

// ListTranslationsMatrixResponse represents matrix view response
type ListTranslationsMatrixResponse struct {
	Groups       []MatrixTranslationGroup `json:"groups"`
	Languages    []string                 `json:"languages"`
	TotalSources int64                    `json:"total_sources"`
	Page         int                      `json:"page"`
	Limit        int                      `json:"limit"`
	TotalPages   int                      `json:"total_pages"`
}

// ListTranslationsMatrixAdmin handles GET /api/v1/admin/translations/matrix
func (h *Handler) ListTranslationsMatrixAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}

	offset := (page - 1) * limit

	// Get filter parameters
	targetLang := c.Query("target_language")
	search := c.Query("search")
	engine := c.Query("engine")
	reviewStatus := c.Query("review_status")

	h.logger.Info("Listing translations in matrix view",
		zap.Int("page", page),
		zap.Int("limit", limit),
		zap.String("target_language", targetLang),
		zap.String("search", search),
		zap.String("engine", engine),
		zap.String("review_status", reviewStatus),
	)

	// Get unique source texts with pagination
	uniqueSources, err := h.queries.ListUniqueSourceTextsWithFilters(c.Request.Context(), db.ListUniqueSourceTextsWithFiltersParams{
		Column1: search,
		Column2: targetLang,
		Column3: engine,
		Column4: reviewStatus,
		Limit:   int32(limit),
		Offset:  int32(offset),
	})
	if err != nil {
		h.logger.Error("Failed to list unique source texts", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve translations"})
		return
	}

	// Count total unique source texts
	totalSources, err := h.queries.CountUniqueSourceTextsWithFilters(c.Request.Context(), db.CountUniqueSourceTextsWithFiltersParams{
		Column1: search,
		Column2: targetLang,
		Column3: engine,
		Column4: reviewStatus,
	})
	if err != nil {
		h.logger.Error("Failed to count unique source texts", zap.Error(err))
		totalSources = int64(len(uniqueSources))
	}

	// Extract source texts
	sourceTexts := make([]string, 0, len(uniqueSources))
	for _, source := range uniqueSources {
		sourceTexts = append(sourceTexts, source.SourceText)
	}

	// Get all translations for these source texts
	var translations []db.GetTranslationsBySourceTextsRow
	if len(sourceTexts) > 0 {
		translations, err = h.queries.GetTranslationsBySourceTexts(c.Request.Context(), sourceTexts)
		if err != nil {
			h.logger.Error("Failed to get translations by source texts", zap.Error(err))
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve translations"})
			return
		}
	}

	// Group translations by source text
	groups := make([]MatrixTranslationGroup, 0)
	languageSet := make(map[string]bool)
	
	for _, sourceText := range sourceTexts {
		group := MatrixTranslationGroup{
			SourceText:   sourceText,
			Translations: make(map[string]TranslationResponse),
		}

		for _, t := range translations {
			if t.SourceText == sourceText {
				// Add language to set
				languageSet[t.TargetLanguage] = true

				// Parse element context
				var elementContext map[string]interface{}
				if t.ElementContext.Valid && len(t.ElementContext.RawMessage) > 0 {
					if err := json.Unmarshal(t.ElementContext.RawMessage, &elementContext); err != nil {
						h.logger.Warn("Failed to unmarshal element context", zap.Error(err))
					}
				}

				// Handle review status
				reviewStatusStr := "pending"
				if t.ReviewStatus != nil {
					if status, ok := t.ReviewStatus.(string); ok && status != "" {
						reviewStatusStr = status
					}
				}

				resp := TranslationResponse{
					ID:                     t.ID.String(),
					SourceText:             t.SourceText,
					TargetLanguage:         t.TargetLanguage,
					TranslatedText:         t.TranslatedText,
					TranslationEngine:      t.TranslationEngine.String,
					RedisKey:               t.RedisKey.String,
					ElementContext:         elementContext,
					QualityConfidenceScore: func() *int32 {
						if t.QualityConfidenceScore.Valid {
							return &t.QualityConfidenceScore.Int32
						}
						return nil
					}(),
					CreatedAt:    t.CreatedAt.Time.UTC().Format(time.RFC3339),
					UpdatedAt:    t.UpdatedAt.Time.UTC().Format(time.RFC3339),
					ReviewStatus: reviewStatusStr,
				}

				if t.CreatedBy.Valid {
					createdBy := t.CreatedBy.UUID.String()
					resp.CreatedBy = &createdBy
				}

				group.Translations[t.TargetLanguage] = resp
			}
		}

		groups = append(groups, group)
	}

	// Convert language set to sorted slice
	languages := make([]string, 0, len(languageSet))
	for lang := range languageSet {
		languages = append(languages, lang)
	}
	// Sort languages alphabetically
	sort.Strings(languages)

	response := ListTranslationsMatrixResponse{
		Groups:       groups,
		Languages:    languages,
		TotalSources: totalSources,
		Page:         page,
		Limit:        limit,
		TotalPages:   int((totalSources + int64(limit) - 1) / int64(limit)),
	}

	c.JSON(http.StatusOK, response)
}