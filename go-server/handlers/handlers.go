package handlers

import (
	"database/sql"
	db "server/db/sqlc"

	"go.uber.org/zap"
)

// Handler represents the main handler struct with explicit field types
type Handler struct {
	db      *sql.DB
	queries *db.Queries
	logger  *zap.Logger
}

// New creates a new Handler instance with properly typed fields
func New(db *sql.DB, queries *db.Queries, logger *zap.Logger) *Handler {
	return &Handler{
		db:      db,
		queries: queries,
		logger:  logger,
	}
}