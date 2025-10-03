#!/bin/bash

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 사용법 출력
usage() {
  echo "Usage: ./ci.sh [option] [flags]"
  echo ""
  echo "Options:"
  echo "  fast    - Lint + Type check only (5-10초)"
  echo "  full    - Lint + Type check + Build (1-2분)"
  echo "  (none)  - Same as 'full' (default)"
  echo ""
  echo "Flags:"
  echo "  --only-changed  - Check only changed projects (staged files)"
  echo ""
  echo "Examples:"
  echo "  ./ci.sh                      # 전체 빌드"
  echo "  ./ci.sh fast                 # 빠른 검사"
  echo "  ./ci.sh fast --only-changed  # 변경된 프로젝트만 빠른 검사"
  echo "  ./ci.sh full --only-changed  # 변경된 프로젝트만 빌드"
}

# 옵션 파싱
MODE=${1:-full}
ONLY_CHANGED=false

# 첫 번째 인자가 옵션이 아니면 full로 간주
if [ "$MODE" = "--only-changed" ]; then
  MODE="full"
  ONLY_CHANGED=true
elif [ "$MODE" != "fast" ] && [ "$MODE" != "full" ]; then
  echo -e "${RED}❌ Invalid option: $MODE${NC}"
  usage
  exit 1
fi

# 두 번째 인자 확인
if [ "$2" = "--only-changed" ]; then
  ONLY_CHANGED=true
elif [ ! -z "$2" ]; then
  echo -e "${RED}❌ Invalid flag: $2${NC}"
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

# 변경된 파일 확인 (only-changed 모드일 때만)
SKIP_ADMIN=false
SKIP_SERVER=false

if [ "$ONLY_CHANGED" = true ]; then
  echo -e "${BLUE}🔍 Checking staged files...${NC}"
  ADMIN_CHANGED=$(git diff --cached --name-only | grep "^admin/" | wc -l | tr -d ' ')
  SERVER_CHANGED=$(git diff --cached --name-only | grep "^elysia-server/" | wc -l | tr -d ' ')

  if [ "$ADMIN_CHANGED" -eq 0 ]; then
    SKIP_ADMIN=true
    echo "⏭️  Skipping admin (no changes)"
  fi

  if [ "$SERVER_CHANGED" -eq 0 ]; then
    SKIP_SERVER=true
    echo "⏭️  Skipping elysia-server (no changes)"
  fi
  echo ""
fi

echo -e "${BLUE}🔍 Starting checks in parallel...${NC}"
echo ""

# Admin 검사
if [ "$SKIP_ADMIN" = true ]; then
  echo "0" > "$ADMIN_RESULT"
else
  if [ "$MODE" = "fast" ]; then
    echo -e "${YELLOW}📝 Checking admin (lint + type-check)...${NC}"
    (cd admin && yarn lint && yarn type-check > "$ADMIN_LOG" 2>&1 && echo "0" > "$ADMIN_RESULT" || echo "1" > "$ADMIN_RESULT") &
  else
    echo -e "${YELLOW}📦 Building admin (lint + type-check + build)...${NC}"
    (cd admin && yarn build > "$ADMIN_LOG" 2>&1 && echo "0" > "$ADMIN_RESULT" || echo "1" > "$ADMIN_RESULT") &
  fi
  ADMIN_PID=$!
fi

# Elysia-server 검사
if [ "$SKIP_SERVER" = true ]; then
  echo "0" > "$SERVER_RESULT"
else
  if [ "$MODE" = "fast" ]; then
    echo -e "${YELLOW}📝 Checking elysia-server (lint + type-check)...${NC}"
    (cd elysia-server && bun lint && bun type-check > "$SERVER_LOG" 2>&1 && echo "0" > "$SERVER_RESULT" || echo "1" > "$SERVER_RESULT") &
  else
    echo -e "${YELLOW}📦 Building elysia-server (lint + type-check + build)...${NC}"
    (cd elysia-server && bun run build > "$SERVER_LOG" 2>&1 && echo "0" > "$SERVER_RESULT" || echo "1" > "$SERVER_RESULT") &
  fi
  SERVER_PID=$!
fi

# 진행 상황 표시
echo ""
echo -e "${BLUE}⏳ Waiting for checks to complete...${NC}"

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

echo ""
echo "═══════════════════════════════════════"

# 결과 출력
if [ "$ADMIN_EXIT" = "0" ]; then
  echo -e "${GREEN}✅ Admin passed${NC}"
else
  echo -e "${RED}❌ Admin failed${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  cat "$ADMIN_LOG"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

if [ "$SERVER_EXIT" = "0" ]; then
  echo -e "${GREEN}✅ Elysia-server passed${NC}"
else
  echo -e "${RED}❌ Elysia-server failed${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  cat "$SERVER_LOG"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo "═══════════════════════════════════════"

# 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 임시 파일 정리
rm -rf "$TEMP_DIR"

# 최종 결과
echo ""
if [ "$ADMIN_EXIT" = "0" ] && [ "$SERVER_EXIT" = "0" ]; then
  echo -e "${GREEN}✨ All checks passed! (${DURATION}s)${NC}"
  exit 0
else
  echo -e "${RED}💥 Some checks failed! (${DURATION}s)${NC}"
  exit 1
fi
