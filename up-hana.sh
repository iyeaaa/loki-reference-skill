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
log "스크립트 시작"

SSH_HOST="hana"
REMOTE_DIR="~/data/sw_package/grinda"
log "변수 설정 완료"

# 현재 디렉토리 저장
CURRENT_DIR=$(pwd)
log "현재 디렉토리: $CURRENT_DIR"

# 현재 프로젝트 디렉토리 사용
cd /Users/macminim4pro/Github/1_Projects/vite-hana-lang-connect

log "프로젝트 파일 복사 시작"
# 원격 서버에 디렉토리가 없으면 생성 (에러 무시)
ssh $SSH_HOST "mkdir -p $REMOTE_DIR" 2>/dev/null || true

rsync -avz --delete ./ $SSH_HOST:$REMOTE_DIR \
    --exclude .git \
    --exclude .DS_Store \
    --exclude node_modules \
    --exclude __pycache__ \
    --exclude "*.pyc" \
    --exclude "*.pyo" \
    --exclude "*.pyd" \
    --exclude .pytest_cache \
    --exclude .coverage \
    --exclude htmlcov \
    --exclude .tox \
    --exclude .eggs \
    --exclude "*.egg-info" \
    --exclude "*.egg" \
    --exclude venv \
    --exclude .venv \
    --exclude dist \
    --exclude build \
    --exclude client/node_modules \
    --exclude client/.next \
    --exclude client/dist \
    --exclude client/build \
    --exclude admin/node_modules \
    --exclude admin/.next \
    --exclude admin/dist \
    --exclude admin/build \
    --exclude csv-tools
# sshpass -p "$SSH_PASS" rsync -avz ./ $SSH_HOST:$REMOTE_DIR 
log "프로젝트 파일 복사 완료"

log "Hana 서버에 SSH 접속 시작"
ssh $SSH_HOST << EOF
    cd ~/data/sw_package/grinda

    cp configs/server/.env.hana server/.env
    cp configs/admin/.env.hana admin/.env
    cp docker-compose.hana.yml docker-compose.yml
    
    # Docker Compose 실행
    sudo docker compose up -d --build
    
    # 컨테이너 상태 확인
    sudo docker compose ps

    # 4가지 작업 병렬로 처리
    docker save grinda-admin:latest -o grinda-admin.tar
    aws s3 cp ./grinda-admin.tar s3://langconnect/grinda-admin.tar

    docker save grinda-server:latest -o grinda-server.tar
    aws s3 cp ./grinda-server.tar s3://langconnect/grinda-server.tar

    docker save grinda-client-spring:latest -o grinda-client-spring.tar
    aws s3 cp ./grinda-client-spring.tar s3://langconnect/grinda-client-spring.tar

EOF
log "Hana 서버 SSH 접속 및 Docker Compose 실행 완료"

# curl -X GET http://15.165.2.108:9888/api/v1/public/departments 
# curl -X GET http://localhost:9888/api/v1/public/departments 
