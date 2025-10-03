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

# 로깅 함수들
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

# 사용법 출력
usage() {
  echo -e "${BOLD}Usage:${NC} ./ci-admin.sh [option]"
  echo ""
  echo -e "${BOLD}Options:${NC}"
  echo "  fast    - Lint + Type check only (3-5초)"
  echo "  full    - Lint + Type check + Build (30-60초)"
  echo "  (none)  - Same as 'full' (default)"
  echo ""
  echo -e "${BOLD}Examples:${NC}"
  echo "  ./ci-admin.sh       # 전체 빌드"
  echo "  ./ci-admin.sh fast  # 빠른 검사"
  echo "  ./ci-admin.sh full  # 전체 빌드"
}

# 옵션 파싱
MODE=${1:-full}

if [ "$MODE" != "fast" ] && [ "$MODE" != "full" ]; then
  log_error "Invalid option: $MODE"
  echo ""
  usage
  exit 1
fi

# 시작 시간
START_TIME=$(date +%s)

# 헤더 출력
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  SendCI ${NC}${GRAY}v1.0${NC} ${BOLD}• Admin (Frontend)${NC}"
echo -e "${GRAY}  Continuous Integration by Grinda AI${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
log_info "Mode: ${BOLD}$MODE${NC}"
echo ""

cd admin

if [ "$MODE" = "fast" ]; then
  log_group_start "Lint"
  log_step "Running biome check..."
  yarn lint
  LINT_EXIT=$?
  if [ $LINT_EXIT -eq 0 ]; then
    log_success "Lint passed"
  else
    log_error "Lint failed"
  fi
  log_group_end

  log_group_start "Type Check"
  log_step "Running tsc --noEmit..."
  yarn type-check
  TYPE_EXIT=$?
  if [ $TYPE_EXIT -eq 0 ]; then
    log_success "Type check passed"
  else
    log_error "Type check failed"
  fi
  log_group_end

  EXIT_CODE=$((LINT_EXIT + TYPE_EXIT))
else
  log_group_start "Build"
  log_step "Running full build (lint + type-check + vite build)..."
  yarn build
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 0 ]; then
    log_success "Build passed"
  else
    log_error "Build failed"
  fi
  log_group_end
fi

# 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 최종 결과
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}${BOLD}✓ Admin checks passed${NC} ${GRAY}(${DURATION}s)${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}✗ Admin checks failed${NC} ${GRAY}(${DURATION}s)${NC}"
  exit 1
fi
