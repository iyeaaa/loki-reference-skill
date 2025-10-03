#!/bin/bash

# 색상 정의 (GitHub Actions 스타일)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

# 로깅 함수들 (GitHub Actions, CircleCI 스타일 참고)
log_group_start() {
  echo -e "${CYAN}▼${NC} ${BOLD}$1${NC}"
}

log_group_end() {
  echo ""
}

log_step() {
  echo -e "${BLUE}→${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_info() {
  echo -e "${GRAY}ℹ${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_skip() {
  echo -e "${GRAY}⊘${NC} $1"
}

# 진행 상황 스피너 (백그라운드 프로세스용)
show_spinner() {
  local pid=$1
  local message=$2
  local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  local i=0

  while kill -0 $pid 2>/dev/null; do
    i=$(( (i+1) %10 ))
    printf "\r${BLUE}${spin:$i:1}${NC} $message"
    sleep 0.1
  done
  printf "\r"
}

# 사용법 출력
usage() {
  echo -e "${BOLD}Usage:${NC} ./ci.sh [option] [flags]"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  fast    - Lint + Type check only (5-10초)"
  echo "  full    - Lint + Type check + Build (1-2분)"
  echo "  (none)  - Same as 'full' (default)"
  echo ""
  echo -e "${BOLD}Flags:${NC}"
  echo "  --only-changed  - Check only changed projects (staged files)"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./ci.sh                      # 전체 빌드"
  echo "  ./ci.sh fast                 # 빠른 검사"
  echo "  ./ci.sh fast --only-changed  # 변경된 프로젝트만 빠른 검사"
  echo "  ./ci.sh full --only-changed  # 변경된 프로젝트만 빌드"
}

# 옵션 파싱
MODE=${1:-full}
ONLY_CHANGED=false

if [ "$MODE" = "--only-changed" ]; then
  MODE="full"
  ONLY_CHANGED=true
elif [ "$MODE" != "fast" ] && [ "$MODE" != "full" ]; then
  log_error "Invalid option: $MODE"
  echo ""
  usage
  exit 1
fi

if [ "$2" = "--only-changed" ]; then
  ONLY_CHANGED=true
elif [ ! -z "$2" ]; then
  log_error "Invalid flag: $2"
  echo ""
  usage
  exit 1
fi

# 임시 파일 디렉토리
TEMP_DIR=$(mktemp -d)
ADMIN_RESULT="$TEMP_DIR/admin.result"
SERVER_RESULT="$TEMP_DIR/server.result"
ADMIN_LOG="$TEMP_DIR/admin.log"
SERVER_LOG="$TEMP_DIR/server.log"

# 시작 시간
START_TIME=$(date +%s)

# 헤더 출력 (SendCI 브랜딩)
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  SendCI ${NC}${GRAY}v1.0 (2025.10.04)${NC}"
echo -e "${GRAY}  Continuous Integration by Grinda AI${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log_info "Mode: ${BOLD}$MODE${NC}"
log_info "Only changed: ${BOLD}$ONLY_CHANGED${NC}"
echo ""

# 변경된 파일 확인
SKIP_ADMIN=false
SKIP_SERVER=false

if [ "$ONLY_CHANGED" = true ]; then
  log_group_start "Detecting Changes"

  ADMIN_CHANGED=$(git diff --cached --name-only | grep "^admin/" | wc -l | tr -d ' ')
  SERVER_CHANGED=$(git diff --cached --name-only | grep "^elysia-server/" | wc -l | tr -d ' ')

  if [ "$ADMIN_CHANGED" -eq 0 ]; then
    SKIP_ADMIN=true
    log_skip "Admin (no changes detected)"
  else
    log_info "Admin ($ADMIN_CHANGED files changed)"
  fi

  if [ "$SERVER_CHANGED" -eq 0 ]; then
    SKIP_SERVER=true
    log_skip "Elysia-server (no changes detected)"
  else
    log_info "Elysia-server ($SERVER_CHANGED files changed)"
  fi

  log_group_end
fi

# 작업 시작
log_group_start "Running Jobs"

# Admin 검사
if [ "$SKIP_ADMIN" = true ]; then
  echo "0" > "$ADMIN_RESULT"
else
  if [ "$MODE" = "fast" ]; then
    log_step "Admin: lint + type-check"
    (cd admin && yarn lint > "$ADMIN_LOG" 2>&1 && yarn type-check >> "$ADMIN_LOG" 2>&1 && echo "0" > "$ADMIN_RESULT" || echo "1" > "$ADMIN_RESULT") &
  else
    log_step "Admin: build"
    (cd admin && yarn build > "$ADMIN_LOG" 2>&1 && echo "0" > "$ADMIN_RESULT" || echo "1" > "$ADMIN_RESULT") &
  fi
  ADMIN_PID=$!
fi

# Elysia-server 검사
if [ "$SKIP_SERVER" = true ]; then
  echo "0" > "$SERVER_RESULT"
else
  if [ "$MODE" = "fast" ]; then
    log_step "Elysia-server: lint + type-check"
    (cd elysia-server && bun lint > "$SERVER_LOG" 2>&1 && bun type-check >> "$SERVER_LOG" 2>&1 && echo "0" > "$SERVER_RESULT" || echo "1" > "$SERVER_RESULT") &
  else
    log_step "Elysia-server: build"
    (cd elysia-server && bun run build > "$SERVER_LOG" 2>&1 && echo "0" > "$SERVER_RESULT" || echo "1" > "$SERVER_RESULT") &
  fi
  SERVER_PID=$!
fi

log_group_end

# 진행 상황 표시
if [ ! -z "$ADMIN_PID" ] || [ ! -z "$SERVER_PID" ]; then
  log_info "Jobs running in parallel..."
  echo ""
fi

# 모든 작업 완료 대기
if [ ! -z "$ADMIN_PID" ]; then
  wait $ADMIN_PID
fi

if [ ! -z "$SERVER_PID" ]; then
  wait $SERVER_PID
fi

# 결과 확인
ADMIN_EXIT=$(cat "$ADMIN_RESULT")
SERVER_EXIT=$(cat "$SERVER_RESULT")

# 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 결과 출력 (GitHub Actions 스타일)
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Results${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Admin 결과
if [ "$SKIP_ADMIN" = true ]; then
  log_skip "Admin (skipped)"
elif [ "$ADMIN_EXIT" = "0" ]; then
  log_success "Admin passed"
else
  log_error "Admin failed"
  echo ""
  echo -e "${RED}╭─ Admin Error Details${NC}"
  while IFS= read -r line; do
    echo -e "${RED}│${NC} $line"
  done < "$ADMIN_LOG"
  echo -e "${RED}╰─${NC}"
  echo ""
fi

# Server 결과
if [ "$SKIP_SERVER" = true ]; then
  log_skip "Elysia-server (skipped)"
elif [ "$SERVER_EXIT" = "0" ]; then
  log_success "Elysia-server passed"
else
  log_error "Elysia-server failed"
  echo ""
  echo -e "${RED}╭─ Elysia-server Error Details${NC}"
  while IFS= read -r line; do
    echo -e "${RED}│${NC} $line"
  done < "$SERVER_LOG"
  echo -e "${RED}╰─${NC}"
  echo ""
fi

echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 임시 파일 정리
rm -rf "$TEMP_DIR"

# 최종 결과
echo ""
if [ "$ADMIN_EXIT" = "0" ] && [ "$SERVER_EXIT" = "0" ]; then
  echo -e "${GREEN}${BOLD}✓ All checks passed${NC} ${GRAY}(${DURATION}s)${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}✗ Some checks failed${NC} ${GRAY}(${DURATION}s)${NC}"
  exit 1
fi
