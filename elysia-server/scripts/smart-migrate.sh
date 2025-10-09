#!/bin/sh
# Smart migration script for Drizzle ORM
# Handles both fresh databases and existing schemas

set -e

echo "[+] Checking database state..."

# Check if migration tracking table exists AND has records
MIGRATION_COUNT=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
  -h "${DB_HOST:-localhost}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USER:-postgres}" \
  -d "${DB_NAME:-postgres}" \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '__drizzle_migrations'" 2>/dev/null || echo "0")

MIGRATION_COUNT=$(echo $MIGRATION_COUNT | tr -d ' ')

if [ "$MIGRATION_COUNT" = "0" ]; then
  echo "[+] No migration tracking found - checking if schema exists..."

  # Check if any core tables exist
  TABLE_COUNT=$(PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
    -h "${DB_HOST:-localhost}" \
    -p "${DB_PORT:-5432}" \
    -U "${DB_USER:-postgres}" \
    -d "${DB_NAME:-postgres}" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'workspaces', 'emails', 'leads')" 2>/dev/null || echo "0")

  TABLE_COUNT=$(echo $TABLE_COUNT | tr -d ' ')

  if [ "$TABLE_COUNT" -gt "0" ]; then
    echo "[!] Existing schema detected without migration tracking"
    echo "[+] Initializing migration history..."

    # Create migration table and mark current migration as applied
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
      -h "${DB_HOST:-localhost}" \
      -p "${DB_PORT:-5432}" \
      -U "${DB_USER:-postgres}" \
      -d "${DB_NAME:-postgres}" \
      -c "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);"

    # Mark current migration as completed (timestamp from _journal.json)
    PGPASSWORD="${DB_PASSWORD:-postgres}" psql \
      -h "${DB_HOST:-localhost}" \
      -p "${DB_PORT:-5432}" \
      -U "${DB_USER:-postgres}" \
      -d "${DB_NAME:-postgres}" \
      -c "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('0000_tan_santa_claus', 1760029328030) ON CONFLICT DO NOTHING;"

    echo "[+] Migration history initialized - schema already in sync"
    echo "[+] Migrations completed successfully"
    exit 0
  else
    echo "[+] Fresh database detected - will apply migrations"
  fi
fi

# Run migrations
echo "[+] Running database migrations..."
bun run db:migrate

echo "[+] Migrations completed successfully"
