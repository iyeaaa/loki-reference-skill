#!/bin/bash

# 로그 파일 경로 설정
LOG_FILE="./deployment.log"

# 로그 파일이 없으면 생성하고 권한 설정
touch "$LOG_FILE" 2>/dev/null || true
chmod 664 "$LOG_FILE" 2>/dev/null || true

# 로그 함수 정의: 콘솔과 파일에 동시에 로그 출력
log() {
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$message"
    echo "$message" >> "$LOG_FILE" 2>/dev/null || true
}

START_TIME=$(date +%s.%N)
log "SendGrid Webhook 배포 스크립트 시작"

SSH_HOST="hana"
REMOTE_DIR="~/data/sw_package/sendgrid-webhook"
log "변수 설정 완료"

# 현재 디렉토리 저장
CURRENT_DIR=$(pwd)
log "현재 디렉토리: $CURRENT_DIR"

log "프로젝트 파일 복사 시작"
# 원격 서버에 디렉토리가 없으면 생성
ssh $SSH_HOST "mkdir -p $REMOTE_DIR" 2>/dev/null || true

# rsync로 파일 복사 (불필요한 파일 제외)
rsync -avz --delete ./ $SSH_HOST:$REMOTE_DIR \
    --exclude .git \
    --exclude .DS_Store \
    --exclude node_modules \
    --exclude logs \
    --exclude "*.log" \
    --exclude deployment.log

log "프로젝트 파일 복사 완료"

log "Hana 서버에 SSH 접속 및 Docker 빌드 시작"
ssh $SSH_HOST << 'EOF'
    cd ~/data/sw_package/sendgrid-webhook

    # .env 파일 생성 (없으면)
    if [ ! -f .env ]; then
        cp .env.example .env
        echo ".env 파일 생성 완료"
    fi

    # 기존 컨테이너가 있으면 정지 및 제거
    sudo docker compose down 2>/dev/null || true

    # Docker Compose 실행
    echo "Docker Compose 빌드 및 실행 시작..."
    sudo docker compose up -d --build

    # 컨테이너 상태 확인
    echo ""
    echo "=== 컨테이너 상태 ==="
    sudo docker compose ps

    # 로그 확인 (최근 20줄)
    echo ""
    echo "=== 최근 로그 ==="
    sudo docker compose logs --tail=20 sendgrid-webhook
EOF

log "Hana 서버 배포 완료"

# 배포 시간 계산
END_TIME=$(date +%s.%N)
ELAPSED_TIME=$(echo "$END_TIME - $START_TIME" | bc)
log "총 실행 시간: ${ELAPSED_TIME}초"

log "배포 완료. 웹훅 URL: http://15.165.2.108:3000/webhook/inbound"