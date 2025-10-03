# 데이터베이스 백업 가이드

## 📦 백업 스크립트

### 자동 백업 설정

#### 1. **수동 백업 실행**

**Docker 환경 (운영 서버 권장):**
```bash
# Docker를 사용한 백업 (pg_dump 설치 불필요)
./scripts/docker-backup-db.sh

# 또는 npm 스크립트 사용
bun run db:backup
```

**로컬 환경 (PostgreSQL 클라이언트 설치된 경우):**
```bash
# 로컬 pg_dump 사용
./scripts/backup-db.sh

# 또는 npm 스크립트 사용
bun run db:backup:local
```

백업 파일은 `./backups/db/` 디렉토리에 저장됩니다.

#### 2. **Systemd Timer를 사용한 자동 백업 (Amazon Linux / Ubuntu)**

**운영 서버에서 자동 백업 설정:**
```bash
# Setup 스크립트 실행 (root 권한 필요)
sudo ./scripts/setup-backup-timer.sh
```

이 스크립트는 다음을 자동으로 설정합니다:
- 매일 새벽 2시에 자동 백업
- Systemd service와 timer 생성
- 백업 로그를 `logs/backup.log`에 기록

**유용한 명령어:**
```bash
# Timer 상태 확인
systemctl status db-backup.timer

# 다음 실행 시간 확인
systemctl list-timers db-backup.timer

# 즉시 백업 실행
sudo systemctl start db-backup.service

# 백업 로그 확인
tail -f ~/send-grid-test/elysia-server/logs/backup.log

# Timer 중지
sudo systemctl stop db-backup.timer

# Timer 비활성화
sudo systemctl disable db-backup.timer
```

#### 3. **Cron을 사용한 자동 백업 (Mac / Linux with cron)**

매일 새벽 2시에 자동 백업:
```bash
# crontab 편집
crontab -e

# 다음 라인 추가 (매일 새벽 2시)
0 2 * * * cd ~/send-grid-test/elysia-server && ./scripts/docker-backup-db.sh >> ./logs/backup.log 2>&1

# 또는 매주 일요일 새벽 3시
0 3 * * 0 cd ~/send-grid-test/elysia-server && ./scripts/docker-backup-db.sh >> ./logs/backup.log 2>&1
```

#### 3. **package.json 스크립트 추가**

`package.json`에 다음 스크립트 추가:
```json
{
  "scripts": {
    "db:backup": "./scripts/backup-db.sh",
    "db:restore": "./scripts/restore-db.sh"
  }
}
```

사용:
```bash
bun run db:backup
bun run db:restore ./backups/db/backup_20251003_143000.sql.gz
```

---

## 🔄 백업 복원

### 백업 파일 복원
```bash
# 특정 백업 파일 복원
./scripts/restore-db.sh ./backups/db/backup_20251003_143000.sql.gz

# 또는 npm 스크립트 사용
bun run db:restore ./backups/db/backup_20251003_143000.sql.gz
```

⚠️ **주의**: 복원 시 현재 데이터베이스의 모든 데이터가 덮어씌워집니다!

---

## 📊 백업 관리

### 백업 파일 위치
```
elysia-server/
├── backups/
│   └── db/
│       ├── backup_20251003_020000.sql.gz
│       ├── backup_20251004_020000.sql.gz
│       └── backup_20251005_020000.sql.gz
```

### 자동 정리
- 30일 이상 된 백업 파일은 자동으로 삭제됩니다
- 필요시 `backup-db.sh`의 `mtime +30` 값을 수정하여 보관 기간 조정

---

## 🚀 추가 옵션

### 1. **AWS S3에 백업 업로드** (선택사항)

`backup-db.sh`에 다음 추가:
```bash
# AWS S3 업로드 (AWS CLI 필요)
if command -v aws &> /dev/null; then
  aws s3 cp "$BACKUP_FILE" s3://your-bucket/db-backups/
  echo "☁️  Backup uploaded to S3"
fi
```

### 2. **슬랙 알림** (선택사항)

백업 완료 시 슬랙으로 알림:
```bash
# 슬랙 웹훅 URL 설정
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 백업 완료 후 알림
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d "{\"text\":\"✅ Database backup completed: $BACKUP_FILE\"}"
```

### 3. **Docker Compose 환경**

`docker-compose.yml`에 백업 서비스 추가:
```yaml
services:
  db-backup:
    image: postgres:15
    depends_on:
      - db
    volumes:
      - ./backups:/backups
      - ./scripts/backup-db.sh:/backup.sh
    command: /bin/bash -c "while true; do /backup.sh; sleep 86400; done"
    environment:
      - DB_HOST=db
      - DB_USER=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=postgres
```

---

## 📝 Cron 스케줄 예시

```bash
# 매일 새벽 2시
0 2 * * * /path/to/backup-db.sh

# 매주 일요일 새벽 3시
0 3 * * 0 /path/to/backup-db.sh

# 매달 1일 새벽 4시
0 4 1 * * /path/to/backup-db.sh

# 6시간마다
0 */6 * * * /path/to/backup-db.sh

# 평일 매일 새벽 2시
0 2 * * 1-5 /path/to/backup-db.sh
```

---

## ✅ 백업 테스트

백업이 제대로 작동하는지 테스트:
```bash
# 1. 백업 생성
./scripts/backup-db.sh

# 2. 테스트 DB 생성
createdb -h localhost -U postgres test_restore

# 3. 백업 복원 테스트
PGPASSWORD=postgres pg_restore \
  -h localhost \
  -U postgres \
  -d test_restore \
  ./backups/db/backup_*.sql.gz

# 4. 테스트 DB 삭제
dropdb -h localhost -U postgres test_restore
```

---

## 🔐 보안 고려사항

1. **백업 파일 암호화** (추천)
   ```bash
   # 백업 후 암호화
   gpg --symmetric --cipher-algo AES256 backup_file.sql.gz
   ```

2. **백업 디렉토리 권한 설정**
   ```bash
   chmod 700 ./backups
   ```

3. **`.gitignore`에 백업 폴더 추가**
   ```
   backups/
   *.sql
   *.sql.gz
   ```

---

## 📞 문제 해결

### pg_dump를 찾을 수 없음
```bash
# PostgreSQL 클라이언트 설치
# Mac
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client
```

### 권한 오류
```bash
# 스크립트 실행 권한 부여
chmod +x ./scripts/backup-db.sh
chmod +x ./scripts/restore-db.sh
```

### 디스크 공간 부족
```bash
# 오래된 백업 수동 삭제
find ./backups/db -name "*.sql.gz" -mtime +7 -delete
```
