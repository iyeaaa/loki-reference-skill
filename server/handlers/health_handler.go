package handlers

import (
	"net/http"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
)

// HealthResponse represents a structured health check response
type HealthResponse struct {
	Status string      `json:"status"`
	Time   time.Time   `json:"time"`
	Memory MemoryStats `json:"memory"`
	CPU    CPUStats    `json:"cpu"`
}

// MemoryStats represents memory usage statistics
type MemoryStats struct {
	Alloc      uint64 `json:"alloc"`
	TotalAlloc uint64 `json:"totalAlloc"`
	Sys        uint64 `json:"sys"`
	NumGC      uint64 `json:"numGC"`
}

// CPUStats represents CPU statistics
type CPUStats struct {
	NumCPU int `json:"numCPU"`
}

// HandleHealth godoc
// @Summary Health check
// @Description Simple health check endpoint that returns the service status
// @Tags Health
// @Accept json
// @Produce json
// @Success 200 {object} HealthResponse
// @Router /health [get]
func (h *Handler) HandleHealth(c *gin.Context) {
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	healthResponse := HealthResponse{
		Status: "healthy",
		Time:   time.Now(),
		Memory: MemoryStats{
			Alloc:      memStats.Alloc,
			TotalAlloc: memStats.TotalAlloc,
			Sys:        memStats.Sys,
			NumGC:      uint64(memStats.NumGC),
		},
		CPU: CPUStats{
			NumCPU: runtime.NumCPU(),
		},
	}

	c.JSON(http.StatusOK, healthResponse)
} 