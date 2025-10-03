#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 사용법 출력
usage() {
  echo "Usage: ./check-server.sh [option]"
  echo ""
  echo "Options:"
  echo "  fast    - Lint + Type check only (2-4초)"
  echo "  full    - Lint + Type check + Build (30-60초)"
  echo "  (none)  - Same as 'fast' (default)"
  echo ""
  echo "Examples:"
  echo "  ./check-server.sh       # 빠른 검사"
  echo "  ./check-server.sh fast  # 빠른 검사"
  echo "  ./check-server.sh full  # 전체 검사 (빌드 포함)"
}

# 옵션 파싱
MODE=${1:-full}

if [ "$MODE" != "fast" ] && [ "$MODE" != "full" ]; then
  echo -e "${RED}❌ Invalid option: $MODE${NC}"
  usage
  exit 1
fi

# 시작 시간
START_TIME=$(date +%s)

echo -e "${BLUE}🔍 Checking Elysia-server (Backend)...${NC}"
echo ""

cd elysia-server

if [ "$MODE" = "fast" ]; then
  echo -e "${YELLOW}📝 Running lint...${NC}"
  bun lint
  LINT_EXIT=$?

  echo ""
  echo -e "${YELLOW}📝 Running type-check...${NC}"
  bun type-check
  TYPE_EXIT=$?

  EXIT_CODE=$((LINT_EXIT + TYPE_EXIT))
else
  echo -e "${YELLOW}📦 Running full build (lint + type-check + bun build)...${NC}"
  bun run build
  EXIT_CODE=$?
fi

# 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "═══════════════════════════════════════"

# 최종 결과
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✨ Elysia-server checks passed! (${DURATION}s)${NC}"
  exit 0
else
  echo -e "${RED}💥 Elysia-server checks failed! (${DURATION}s)${NC}"
  exit 1
fi
