package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type DepartmentResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// GetDepartments returns all departments
// @Summary Get all departments
// @Description Get list of all departments (public endpoint)
// @Tags Departments
// @Accept json
// @Produce json
// @Success 200 {object} map[string][]DepartmentResponse
// @Failure 500 {object} map[string]string
// @Router /api/public/departments [get]
func (h *Handler) GetDepartments(c *gin.Context) {
	departments, err := h.queries.ListDepartments(c.Request.Context())
	if err != nil {
		h.logger.Error("Failed to list departments", zap.Error(err))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve departments"})
		return
	}

	response := make([]DepartmentResponse, len(departments))
	for i, dept := range departments {
		var description *string
		if dept.Description.Valid {
			description = &dept.Description.String
		}
		
		response[i] = DepartmentResponse{
			ID:          dept.ID.String(),
			Name:        dept.Name,
			Code:        dept.Code,
			Description: description,
			IsActive:    dept.IsActive.Bool,
			CreatedAt:   dept.CreatedAt.Time,
			UpdatedAt:   dept.UpdatedAt.Time,
		}
	}

	c.JSON(http.StatusOK, gin.H{"departments": response})
}