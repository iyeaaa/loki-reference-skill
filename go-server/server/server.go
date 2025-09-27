package server

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Server struct {
	router *gin.Engine
	logger *zap.Logger
	addr   string
}

func New(router *gin.Engine, logger *zap.Logger, addr string) *Server {
	return &Server{
		router: router,
		logger: logger,
		addr:   addr,
	}
}

func (s *Server) Run() error {
	if s.logger == nil {
		s.logger, _ = zap.NewProduction()
	}
	srv := &http.Server{
		Addr:    s.addr,
		Handler: s.router,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			s.logger.Fatal("listen: %s\n", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	s.logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		s.logger.Fatal("Server forced to shutdown:", zap.Error(err))
	}

	s.logger.Info("Server exiting")
	return nil
}