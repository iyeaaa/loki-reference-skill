package handlers

import (
	"encoding/json"
	"net/http"
	"server/dto"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// HandleTodos godoc
// @Summary Get todos
// @Description Fetch todos from external API and return them
// @Tags Todos
// @Accept json
// @Produce json
// @Success 200 {object} dto.TodosResponse
// @Failure 500 {object} map[string]interface{}
// @Router /api/todos [get]
func (h *Handler) HandleTodos(c *gin.Context) {
	// Fetch data from external API
	resp, err := http.Get("https://koreandummyjson.site/api/todos")
	if err != nil {
		h.logger.Error("Failed to fetch todos", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to fetch todos",
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
		Todos []dto.Todo `json:"todos"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&externalData); err != nil {
		h.logger.Error("Failed to decode response", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to decode response",
		})
		return
	}

	// Create response
	response := dto.TodosResponse{
		Message: "OK",
		Code:    http.StatusOK,
		Data: dto.TodosData{
			Todos: externalData.Todos,
		},
	}

	c.JSON(http.StatusOK, response)
}
