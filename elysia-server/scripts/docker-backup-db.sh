#!/bin/bash

# Docker를 사용한 데이터베이스 백업 스크립트
# 사용법: ./scripts/docker-backup-db.sh

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
BACKUP_FILE="backup_$TIMESTAMP.sql"

# 데이터베이스 정보
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

echo "🔄 Starting database backup using Docker..."
echo "📂 Backup file: $BACKUP_DIR/$BACKUP_FILE.gz"

# Docker Compose 네트워크 이름 가져오기
COMPOSE_NETWORK=$(docker network ls --filter name=send-grid-test --format "{{.Name}}" | head -n 1)

if [ -z "$COMPOSE_NETWORK" ]; then
  COMPOSE_NETWORK="send-grid-test_default"
  echo "⚠️  Using default network: $COMPOSE_NETWORK"
fi

echo "🔗 Using Docker network: $COMPOSE_NETWORK"

# Docker를 사용하여 백업 (PostgreSQL 17 컨테이너 사용)
docker run --rm \
  -e PGPASSWORD="$DB_PASSWORD" \
  --network "$COMPOSE_NETWORK" \
  postgres:17 \
  pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -F c \
    --no-sync | gzip > "$BACKUP_DIR/$BACKUP_FILE.gz"

echo "✅ Backup completed: $BACKUP_DIR/$BACKUP_FILE.gz"
echo "📊 File size: $(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)"

# 30일 이상 된 백업 파일 삭제
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +30 -delete
echo "🗑️  Old backups (30+ days) cleaned up"

echo "✨ Backup process finished successfully!"
