#!/bin/bash

# 데이터베이스 복원 스크립트
# 사용법: ./scripts/restore-db.sh <backup_file.sql.gz>

set -e

if [ -z "$1" ]; then
  echo "❌ Error: Backup file not specified"
  echo "Usage: ./scripts/restore-db.sh <backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# 환경 변수 로드
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# 데이터베이스 정보
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

echo "🔄 Starting database restore..."
echo "📂 Backup file: $BACKUP_FILE"
echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Restore cancelled"
  exit 1
fi

# 압축 해제된 임시 파일
TEMP_FILE="/tmp/restore_$(date +%s).sql"

if [[ $BACKUP_FILE == *.gz ]]; then
  echo "📦 Decompressing backup file..."
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
else
  TEMP_FILE="$BACKUP_FILE"
fi

echo "🗄️  Restoring database..."
PGPASSWORD="$DB_PASSWORD" pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  "$TEMP_FILE"

# 임시 파일 삭제
if [[ $BACKUP_FILE == *.gz ]]; then
  rm -f "$TEMP_FILE"
fi

echo "✅ Database restored successfully!"
