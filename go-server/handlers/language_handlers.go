package handlers

import (
	"database/sql"
	"net/http"

	db "server/db/sqlc"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type LanguageResponse struct {
	ID         string `json:"id"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	NativeName string `json:"native_name"`
	IsActive   bool   `json:"is_active"`
}

type LanguagesListResponse struct {
	Languages []LanguageResponse `json:"languages"`
}

func (h *Handler) GetLanguages(c *gin.Context) {
	// Get only active languages by default
	activeOnly := c.DefaultQuery("active_only", "true") == "true"
	
	var languages []db.Language
	var err error
	
	if activeOnly {
		languages, err = h.queries.ListActiveLanguages(c.Request.Context())
	} else {
		languages, err = h.queries.ListLanguages(c.Request.Context())
	}
	
	if err != nil {
		h.logger.Error("Failed to get languages", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve languages"})
		return
	}

	languageResponses := make([]LanguageResponse, len(languages))
	for i, lang := range languages {
		languageResponses[i] = LanguageResponse{
			ID:         lang.ID.String(),
			Code:       lang.Code,
			Name:       lang.Name,
			NativeName: lang.NativeName.String,
			IsActive:   lang.IsActive.Bool,
		}
	}

	response := LanguagesListResponse{
		Languages: languageResponses,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetLanguageById(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid language ID"})
		return
	}

	language, err := h.queries.GetLanguage(c.Request.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Language not found"})
			return
		}
		h.logger.Error("Failed to get language", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve language"})
		return
	}

	response := LanguageResponse{
		ID:         language.ID.String(),
		Code:       language.Code,
		Name:       language.Name,
		NativeName: language.NativeName.String,
		IsActive:   language.IsActive.Bool,
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetLanguageByCode(c *gin.Context) {
	code := c.Param("code")
	
	language, err := h.queries.GetLanguageByCode(c.Request.Context(), code)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Language not found"})
			return
		}
		h.logger.Error("Failed to get language", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve language"})
		return
	}

	response := LanguageResponse{
		ID:         language.ID.String(),
		Code:       language.Code,
		Name:       language.Name,
		NativeName: language.NativeName.String,
		IsActive:   language.IsActive.Bool,
	}

	c.JSON(http.StatusOK, response)
}