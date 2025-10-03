#!/bin/bash

# 데이터베이스 백업 스크립트
# 사용법: ./scripts/backup-db.sh

set -e

# 환경 변수 로드
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# 백업 디렉토리 설정
BACKUP_DIR="./backups/db"
mkdir -p "$BACKUP_DIR"

# 백업 파일명 (날짜_시간 형식)
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

# 데이터베이스 정보
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

echo "🔄 Starting database backup..."
echo "📂 Backup file: $BACKUP_FILE"

# pg_dump를 사용하여 백업 (버전 호환성 문제 해결)
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -F c \
  --no-sync \
  -f "$BACKUP_FILE" 2>&1 | grep -v "server version" || true

# 백업 파일 압축
gzip "$BACKUP_FILE"
BACKUP_FILE="$BACKUP_FILE.gz"

echo "✅ Backup completed: $BACKUP_FILE"
echo "📊 File size: $(du -h "$BACKUP_FILE" | cut -f1)"

# 30일 이상 된 백업 파일 삭제
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
echo "🗑️  Old backups (30+ days) cleaned up"

echo "✨ Backup process finished successfully!"
