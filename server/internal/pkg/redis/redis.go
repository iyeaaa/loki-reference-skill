package redis

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/rs/zerolog/log"
)

var client *redis.Client

// Connect initializes Redis connection
func Connect() (*redis.Client, error) {
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost"
	}

	redisPort := os.Getenv("REDIS_PORT")
	if redisPort == "" {
		redisPort = "6379"
	}

	redisPassword := os.Getenv("REDIS_PASSWORD")
	redisDB := 0 // 기본 DB

	client = redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", redisHost, redisPort),
		Password: redisPassword,
		DB:       redisDB,
	})

	// 연결 테스트
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := client.Ping(ctx).Result()
	if err != nil {
		log.Error().Err(err).Msg("Failed to connect to Redis")
		return nil, fmt.Errorf("redis connection failed: %w", err)
	}

	log.Info().
		Str("host", redisHost).
		Str("port", redisPort).
		Msg("Successfully connected to Redis")

	return client, nil
}

// GetClient returns the Redis client instance
func GetClient() *redis.Client {
	return client
}
