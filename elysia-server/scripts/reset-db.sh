#!/bin/bash

# Database Reset Script
# Drops and recreates the public schema

set -e

SCRIPT_DIR="$(dirname "$0")"
ENV_FILE="$SCRIPT_DIR/../.env"

# Load only database-related variables from .env
if [ -f "$ENV_FILE" ]; then
  DB_HOST=$(grep -E '^DB_HOST=' "$ENV_FILE" | cut -d '=' -f2-)
  DB_PORT=$(grep -E '^DB_PORT=' "$ENV_FILE" | cut -d '=' -f2-)
  DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2-)
  DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | cut -d '=' -f2-)
  DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2-)
fi

# Use defaults if not set
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

DB_URL="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "Resetting database schema..."

node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: '$DB_URL' });

(async () => {
  const client = await pool.connect();
  try {
    // Drop all custom schemas
    await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    // Drop all custom types
    const types = await client.query(\"SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'\");
    for (const t of types.rows) {
      await client.query('DROP TYPE IF EXISTS public.' + t.typname + ' CASCADE');
    }

    console.log('Database wiped clean!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
"
