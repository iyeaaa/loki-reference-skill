package handlers

import (
	"encoding/json"
	"net/http"
	"server/dto"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// HandlePosts godoc
// @Summary Get posts
// @Description Fetch posts from external API and return them
// @Tags Posts
// @Accept json
// @Produce json
// @Success 200 {object} dto.PostsResponse
// @Failure 500 {object} map[string]interface{}
// @Router /api/posts [get]
func (h *Handler) HandlePosts(c *gin.Context) {
	// Fetch data from external API
	resp, err := http.Get("https://koreandummyjson.site/api/posts")
	if err != nil {
		h.logger.Error("Failed to fetch posts", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch posts",
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		h.logger.Error("External API returned non-OK status", zap.Int("status", resp.StatusCode))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "external API error",
		})
		return
	}

	// Parse the response
	var externalData struct {
		Posts []dto.Post `json:"posts"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&externalData); err != nil {
		h.logger.Error("Failed to decode response", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to decode response",
		})
		return
	}

	// Create response
	response := dto.PostsResponse{
		Message: "OK",
		Code:    http.StatusOK,
		Data: dto.PostsData{
			Posts: externalData.Posts,
		},
	}

	c.JSON(http.StatusOK, response)
}
