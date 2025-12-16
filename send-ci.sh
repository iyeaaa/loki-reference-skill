#!/bin/bash

# Ensure yarn is available (needed for git hooks where PATH may be limited)
if ! command -v yarn &> /dev/null; then
  # Try loading nvm if available
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# 색상 정의 (Docker 스타일)
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
MAGENTA=$'\033[0;35m'
CYAN=$'\033[0;36m'
GRAY=$'\033[0;90m'
WHITE=$'\033[0;37m'
BOLD=$'\033[1m'
NC=$'\033[0m'

# 프로젝트별 색상 정의 (Docker Compose 스타일)
ADMIN_COLOR=$CYAN
SERVER_COLOR=$MAGENTA

# 로깅 함수들 (Docker 스타일)
log_prefix() {
  local project=$1
  local color=$2
  local width=12
  printf "${color}%-${width}s${NC} |" "[$project]"
}

log_admin() {
  printf "%s\n" "$(log_prefix "admin" "$ADMIN_COLOR") $1"
}

log_server() {
  printf "%s\n" "$(log_prefix "elysia-server" "$SERVER_COLOR") $1"
}

log_system() {
  printf "%s\n" "$(log_prefix "sendci" "$YELLOW") $1"
}

log_success() {
  printf "%s\n" "${GREEN}✓${NC} $1"
}

log_error() {
  printf "%s\n" "${RED}✗${NC} $1"
}

log_info() {
  printf "%s\n" "${GRAY}→${NC} $1"
}

log_skip() {
  printf "%s\n" "${GRAY}⊘${NC} $1"
}

# 실시간 로그 출력 함수
stream_logs() {
  local project=$1
  local color=$2
  shift 2

  # 임시 파일에 exit code 저장
  local tmp_exit=$(mktemp)

  {
    "$@" 2>&1
    echo $? > "$tmp_exit"
  } | while IFS= read -r line; do
    printf "%s\n" "$(log_prefix "$project" "$color") ${GRAY}$line${NC}"
  done

  local exit_code=$(cat "$tmp_exit")
  rm -f "$tmp_exit"
  return $exit_code
}

# 사용법 출력
usage() {
  printf "%s\n" "${BOLD}Usage:${NC} ./send-ci.sh [option] [flags]"
  echo ""
  printf "%s\n" "${BOLD}Options:${NC}"
  echo "  fast    - Lint + Type check only (5-10초)"
  echo "  full    - Lint + Type check + Build (1-2분)"
  echo "  (none)  - Same as 'full' (default)"
  echo ""
  printf "%s\n" "${BOLD}Flags:${NC}"
  echo "  --only-changed  - Check only changed projects (staged files)"
  echo "  --quiet         - Minimal output (no banner)"
  echo ""
  printf "%s\n" "${BOLD}Examples:${NC}"
  echo "  ./send-ci.sh                      # 전체 빌드"
  echo "  ./send-ci.sh fast                 # 빠른 검사"
  echo "  ./send-ci.sh fast --only-changed  # 변경된 프로젝트만 빠른 검사"
  echo "  ./send-ci.sh full --only-changed  # 변경된 프로젝트만 빌드"
  echo "  ./send-ci.sh fast --quiet         # 최소 출력"
}

# 옵션 파싱
MODE=${1:-full}
ONLY_CHANGED=false
QUIET=false

# 인자 파싱
for arg in "$@"; do
  case $arg in
    --only-changed)
      ONLY_CHANGED=true
      ;;
    --quiet)
      QUIET=true
      ;;
    fast|full)
      MODE=$arg
      ;;
    *)
      if [ "$arg" != "$MODE" ]; then
        log_error "Invalid flag: $arg"
        echo ""
        usage
        exit 1
      fi
      ;;
  esac
done

# MODE 검증
if [ "$MODE" != "fast" ] && [ "$MODE" != "full" ]; then
  log_error "Invalid option: $MODE"
  echo ""
  usage
  exit 1
fi

# 임시 파일 디렉토리
TEMP_DIR=$(mktemp -d)
ADMIN_RESULT="$TEMP_DIR/admin.result"
SERVER_RESULT="$TEMP_DIR/server.result"

# 시작 시간
START_TIME=$(date +%s)

# 작업 설명 생성
if [ "$MODE" = "fast" ]; then
  JOB_DESC="lint+types"
else
  JOB_DESC="build"
fi

# 헤더 출력 (Docker 스타일)
if [ "$QUIET" = false ]; then
  echo ""
  log_system "${GREEN}Starting SendCI v1.0${NC}"

  if [ "$MODE" = "fast" ]; then
    log_system "Mode: ${WHITE}fast${NC} ${GRAY}(lint + type-check)${NC}"
  else
    log_system "Mode: ${WHITE}full${NC} ${GRAY}(lint + type-check + build)${NC}"
  fi

  [ "$ONLY_CHANGED" = true ] && log_system "Scope: ${WHITE}changed files only${NC}"
  echo ""
fi

# 변경된 파일 확인
SKIP_ADMIN=false
SKIP_SERVER=false
STAGED_ADMIN_FILES=""
STAGED_SERVER_FILES=""

if [ "$ONLY_CHANGED" = true ]; then
  # staged 파일이 있으면 그것을 사용 (pre-commit용)
  # 없으면 원격과 비교 (pre-push용)
  STAGED_FILES=$(git diff --cached --name-only 2>/dev/null)

  if [ -z "$STAGED_FILES" ]; then
    # pre-push: 원격과 비교 (없으면 HEAD와 비교)
    REMOTE_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
    if [ -z "$REMOTE_BRANCH" ]; then
      # 원격 브랜치가 없으면 HEAD와 비교
      ADMIN_CHANGED=$(git diff HEAD --name-only | grep "^admin/" | wc -l | tr -d ' ')
      SERVER_CHANGED=$(git diff HEAD --name-only | grep "^elysia-server/" | wc -l | tr -d ' ')
    else
      # 원격 브랜치와 비교
      ADMIN_CHANGED=$(git diff $REMOTE_BRANCH --name-only | grep "^admin/" | wc -l | tr -d ' ')
      SERVER_CHANGED=$(git diff $REMOTE_BRANCH --name-only | grep "^elysia-server/" | wc -l | tr -d ' ')
    fi
  else
    # pre-commit: staged 파일 확인
    ADMIN_CHANGED=$(echo "$STAGED_FILES" | grep "^admin/" | wc -l | tr -d ' ')
    SERVER_CHANGED=$(echo "$STAGED_FILES" | grep "^elysia-server/" | wc -l | tr -d ' ')
    # lint 후 re-stage를 위해 staged 파일 목록 저장
    STAGED_ADMIN_FILES=$(echo "$STAGED_FILES" | grep "^admin/" || true)
    STAGED_SERVER_FILES=$(echo "$STAGED_FILES" | grep "^elysia-server/" || true)
  fi

  if [ "$ADMIN_CHANGED" -eq 0 ]; then
    SKIP_ADMIN=true
  else
    [ "$QUIET" = false ] && log_admin "Detected ${WHITE}$ADMIN_CHANGED${NC} changed files"
  fi

  if [ "$SERVER_CHANGED" -eq 0 ]; then
    SKIP_SERVER=true
  else
    [ "$QUIET" = false ] && log_server "Detected ${WHITE}$SERVER_CHANGED${NC} changed files"
  fi
fi

# Admin 검사
if [ "$SKIP_ADMIN" = true ]; then
  echo "0" > "$ADMIN_RESULT"
else

  if [ "$MODE" = "fast" ]; then
    (
      cd admin
      if [ "$QUIET" = false ]; then
        log_admin "Running ${WHITE}yarn lint${NC}..."
        stream_logs "admin" "$ADMIN_COLOR" yarn lint
        FIX_EXIT=$?
        if [ $FIX_EXIT -eq 0 ]; then
          log_admin "Running ${WHITE}yarn lint:check${NC}..."
          stream_logs "admin" "$ADMIN_COLOR" yarn lint:check
          LINT_EXIT=$?
          if [ $LINT_EXIT -eq 0 ]; then
            log_admin "Running ${WHITE}yarn type-check${NC}..."
            stream_logs "admin" "$ADMIN_COLOR" yarn type-check
            echo $? > "$ADMIN_RESULT"
          else
            echo $LINT_EXIT > "$ADMIN_RESULT"
          fi
        else
          echo $FIX_EXIT > "$ADMIN_RESULT"
        fi
      else
        yarn lint > /dev/null 2>&1 && yarn lint:check > /dev/null 2>&1 && yarn type-check > /dev/null 2>&1
        echo $? > "$ADMIN_RESULT"
      fi
    )
    ADMIN_EXIT_CODE=$(cat "$ADMIN_RESULT")
    # lint 후 staged 파일 re-stage (lint가 파일을 수정했을 수 있음)
    if [ "$ADMIN_EXIT_CODE" = "0" ] && [ -n "$STAGED_ADMIN_FILES" ]; then
      echo "$STAGED_ADMIN_FILES" | xargs -I {} git add {} 2>/dev/null
      [ "$QUIET" = false ] && log_admin "Re-staged lint-modified files"
    fi
  else
    (
      cd admin
      if [ "$QUIET" = false ]; then
        log_admin "Running ${WHITE}yarn lint${NC}..."
        stream_logs "admin" "$ADMIN_COLOR" yarn lint
        FIX_EXIT=$?
        if [ $FIX_EXIT -eq 0 ]; then
          log_admin "Running ${WHITE}yarn lint:check${NC}..."
          stream_logs "admin" "$ADMIN_COLOR" yarn lint:check
          LINT_EXIT=$?
          if [ $LINT_EXIT -eq 0 ]; then
            log_admin "Running ${WHITE}yarn type-check${NC}..."
            stream_logs "admin" "$ADMIN_COLOR" yarn type-check
            TYPE_EXIT=$?
            if [ $TYPE_EXIT -eq 0 ]; then
              log_admin "Running ${WHITE}yarn build${NC}..."
              stream_logs "admin" "$ADMIN_COLOR" yarn build
              echo $? > "$ADMIN_RESULT"
            else
              echo $TYPE_EXIT > "$ADMIN_RESULT"
            fi
          else
            echo $LINT_EXIT > "$ADMIN_RESULT"
          fi
        else
          echo $FIX_EXIT > "$ADMIN_RESULT"
        fi
      else
        yarn lint > /dev/null 2>&1 && yarn lint:check > /dev/null 2>&1 && yarn type-check > /dev/null 2>&1 && yarn build > /dev/null 2>&1
        echo $? > "$ADMIN_RESULT"
      fi
    )
    ADMIN_EXIT_CODE=$(cat "$ADMIN_RESULT")
    # lint 후 staged 파일 re-stage
    if [ "$ADMIN_EXIT_CODE" = "0" ] && [ -n "$STAGED_ADMIN_FILES" ]; then
      echo "$STAGED_ADMIN_FILES" | xargs -I {} git add {} 2>/dev/null
      [ "$QUIET" = false ] && log_admin "Re-staged lint-modified files"
    fi
  fi
fi

# Elysia-server 검사
if [ "$SKIP_SERVER" = true ]; then
  echo "0" > "$SERVER_RESULT"
else

  if [ "$MODE" = "fast" ]; then
    (
      cd elysia-server
      if [ "$QUIET" = false ]; then
        log_server "Running ${WHITE}bun lint${NC}..."
        stream_logs "elysia-server" "$SERVER_COLOR" bun lint
        FIX_EXIT=$?
        if [ $FIX_EXIT -eq 0 ]; then
          log_server "Running ${WHITE}bun lint:check${NC}..."
          stream_logs "elysia-server" "$SERVER_COLOR" bun lint:check
          LINT_EXIT=$?
          if [ $LINT_EXIT -eq 0 ]; then
            log_server "Running ${WHITE}bun type-check${NC}..."
            stream_logs "elysia-server" "$SERVER_COLOR" bun type-check
            echo $? > "$SERVER_RESULT"
          else
            echo $LINT_EXIT > "$SERVER_RESULT"
          fi
        else
          echo $FIX_EXIT > "$SERVER_RESULT"
        fi
      else
        bun lint > /dev/null 2>&1 && bun lint:check > /dev/null 2>&1 && bun type-check > /dev/null 2>&1
        echo $? > "$SERVER_RESULT"
      fi
    )
    SERVER_EXIT_CODE=$(cat "$SERVER_RESULT")
    # lint 후 staged 파일 re-stage (lint가 파일을 수정했을 수 있음)
    if [ "$SERVER_EXIT_CODE" = "0" ] && [ -n "$STAGED_SERVER_FILES" ]; then
      echo "$STAGED_SERVER_FILES" | xargs -I {} git add {} 2>/dev/null
      [ "$QUIET" = false ] && log_server "Re-staged lint-modified files"
    fi
  else
    (
      cd elysia-server
      if [ "$QUIET" = false ]; then
        log_server "Running ${WHITE}bun lint${NC}..."
        stream_logs "elysia-server" "$SERVER_COLOR" bun lint
        FIX_EXIT=$?
        if [ $FIX_EXIT -eq 0 ]; then
          log_server "Running ${WHITE}bun lint:check${NC}..."
          stream_logs "elysia-server" "$SERVER_COLOR" bun lint:check
          LINT_EXIT=$?
          if [ $LINT_EXIT -eq 0 ]; then
            log_server "Running ${WHITE}bun type-check${NC}..."
            stream_logs "elysia-server" "$SERVER_COLOR" bun type-check
            TYPE_EXIT=$?
            if [ $TYPE_EXIT -eq 0 ]; then
              log_server "Running ${WHITE}bun run build${NC}..."
              stream_logs "elysia-server" "$SERVER_COLOR" bun run build
              echo $? > "$SERVER_RESULT"
            else
              echo $TYPE_EXIT > "$SERVER_RESULT"
            fi
          else
            echo $LINT_EXIT > "$SERVER_RESULT"
          fi
        else
          echo $FIX_EXIT > "$SERVER_RESULT"
        fi
      else
        bun lint > /dev/null 2>&1 && bun lint:check > /dev/null 2>&1 && bun type-check > /dev/null 2>&1 && bun run build > /dev/null 2>&1
        echo $? > "$SERVER_RESULT"
      fi
    )
    SERVER_EXIT_CODE=$(cat "$SERVER_RESULT")
    # lint 후 staged 파일 re-stage
    if [ "$SERVER_EXIT_CODE" = "0" ] && [ -n "$STAGED_SERVER_FILES" ]; then
      echo "$STAGED_SERVER_FILES" | xargs -I {} git add {} 2>/dev/null
      [ "$QUIET" = false ] && log_server "Re-staged lint-modified files"
    fi
  fi
fi

# 결과 파일에서 exit code 읽기
ADMIN_EXIT=$(cat "$ADMIN_RESULT")
SERVER_EXIT=$(cat "$SERVER_RESULT")

# 소요 시간 계산
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 결과 출력
if [ "$QUIET" = false ]; then
  # 실제로 실행된 작업이 있을 때만 빈 줄과 결과 출력
  if [ "$SKIP_ADMIN" = false ] || [ "$SKIP_SERVER" = false ]; then
    echo ""

    # Admin 결과
    if [ "$SKIP_ADMIN" = false ]; then
      if [ "$ADMIN_EXIT" = "0" ]; then
        log_admin "${GREEN}Exited with code 0${NC}"
      else
        log_admin "${RED}Exited with code $ADMIN_EXIT${NC}"
      fi
    fi

    # Server 결과
    if [ "$SKIP_SERVER" = false ]; then
      if [ "$SERVER_EXIT" = "0" ]; then
        log_server "${GREEN}Exited with code 0${NC}"
      else
        log_server "${RED}Exited with code $SERVER_EXIT${NC}"
      fi
    fi
  fi
fi

# 임시 파일 정리
rm -rf "$TEMP_DIR"

# 최종 결과
echo ""
if [ "$ADMIN_EXIT" = "0" ] && [ "$SERVER_EXIT" = "0" ]; then
  log_system "${GREEN}All services completed successfully${NC} ${GRAY}(${DURATION}s)${NC}"
  exit 0
else
  FAILED=""
  [ "$ADMIN_EXIT" != "0" ] && FAILED="admin"
  [ "$SERVER_EXIT" != "0" ] && [ ! -z "$FAILED" ] && FAILED="${FAILED}, "
  [ "$SERVER_EXIT" != "0" ] && FAILED="${FAILED}server"
  log_system "${RED}Failed: ${FAILED}${NC} ${GRAY}(${DURATION}s)${NC}"
  exit 1
fi
