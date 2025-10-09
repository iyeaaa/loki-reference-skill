#!/bin/sh
set -e

echo "[+] Waiting for PostgreSQL to be ready..."

# Wait for PostgreSQL to be ready
until pg_isready -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" > /dev/null 2>&1; do
  echo "    Waiting for database connection..."
  sleep 2
done

echo "[+] PostgreSQL is ready!"

# Run database migrations
echo "[+] Running database migrations..."
bun run db:push

echo "[+] Migrations completed successfully!"

# Start the application
echo "[+] Starting elysia-server..."
exec bun run start
