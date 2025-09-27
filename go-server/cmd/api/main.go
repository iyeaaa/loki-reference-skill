package main

import (
	"log"

	"server/config"
	"server/db"
	sqlc "server/db/sqlc"
	"server/internal/pkg/redis"
	"server/router"
	"server/server"

	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env 파일을 찾을 수 없습니다. 기본 환경 변수를 사용합니다.", err)
	}

	logger, err := config.InitLogger()
	if err != nil {
		log.Fatalf("can't initialize zap logger: %v", err)
	}
	defer func() {
		_ = logger.Sync() // Ignore sync errors on stdout/stderr
	}()

	// Set global logger for packages that use zap.L()
	zap.ReplaceGlobals(logger)

	// Redis 연결 초기화
	_, err = redis.Connect()
	if err != nil {
		logger.Warn("Redis connection failed. Translation caching will be disabled.", zap.Error(err))
	}

	// Database connection (optional for now, we'll just pass nil)
	dbConn, err := db.Connect(logger)
	if err != nil {
		logger.Warn("Database connection failed. Using in-memory data.", zap.Error(err))
		// Continue without database for now
	}

	var queries *sqlc.Queries
	if dbConn != nil {
		queries = sqlc.New(dbConn)
		defer func() {
			if err := dbConn.Close(); err != nil {
				logger.Error("Failed to close database connection", zap.Error(err))
			}
		}()
	}

	r := router.New(dbConn, queries, logger)

	srv := server.New(r.Engine(), logger, ":9888")
	logger.Info("Starting server on :9888")
	if err := srv.Run(); err != nil {
		logger.Fatal("cannot start server", zap.Error(err))
	}
}
