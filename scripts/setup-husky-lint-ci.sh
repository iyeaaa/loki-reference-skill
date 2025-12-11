#!/bin/bash

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Usage information
usage() {
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  echo -e "${BLUE}   Husky + Lint + CI Setup & Verification${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}\n"
  echo -e "${YELLOW}Usage:${NC}"
  echo -e "  ./setup-husky-lint-ci.en.sh [option]\n"
  echo -e "${YELLOW}Options:${NC}"
  echo -e "  check    - Check setup status only (no installation)"
  echo -e "  setup    - Install and configure Git Hooks"
  echo -e "  (none)   - Auto-detect (install if needed, check if already set)\n"
  echo -e "${YELLOW}Examples:${NC}"
  echo -e "  ./setup-husky-lint-ci.en.sh         # Auto-detect"
  echo -e "  ./setup-husky-lint-ci.en.sh setup   # Force install"
  echo -e "  ./setup-husky-lint-ci.en.sh check   # Check only"
}

# Parse options
MODE=${1:-auto}

if [ "$MODE" = "-h" ] || [ "$MODE" = "--help" ]; then
  usage
  exit 0
fi

# Check status function
check_status() {
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  echo -e "${BLUE}   Git Hooks Status Check${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}\n"

  local ALL_OK=true

  # 1. Check Git repository
  echo -e "${YELLOW}[1/7]${NC} Checking Git repository..."
  if [ -d ".git" ]; then
    echo -e "  ${GREEN}✓${NC} This is a Git repository"
  else
    echo -e "  ${RED}✗${NC} Not a Git repository"
    ALL_OK=false
  fi

  # 2. Check Husky package
  echo -e "\n${YELLOW}[2/7]${NC} Checking Husky package..."
  if [ -d "node_modules/husky" ]; then
    echo -e "  ${GREEN}✓${NC} Husky is installed"
  else
    echo -e "  ${RED}✗${NC} Husky is not installed"
    echo -e "  ${YELLOW}→${NC} Fix: yarn install"
    ALL_OK=false
  fi

  # 3. Check .husky directory
  echo -e "\n${YELLOW}[3/7]${NC} Checking .husky directory..."
  if [ -d ".husky" ]; then
    echo -e "  ${GREEN}✓${NC} .husky directory exists"
  else
    echo -e "  ${RED}✗${NC} .husky directory does not exist"
    echo -e "  ${YELLOW}→${NC} Fix: npx husky install"
    ALL_OK=false
  fi

  # 4. Check pre-commit hook
  echo -e "\n${YELLOW}[4/7]${NC} Checking pre-commit hook..."
  if [ -f ".husky/pre-commit" ]; then
    if [ -x ".husky/pre-commit" ]; then
      echo -e "  ${GREEN}✓${NC} pre-commit hook exists and is executable"
    else
      echo -e "  ${YELLOW}⚠${NC} pre-commit hook exists but is not executable"
      echo -e "  ${YELLOW}→${NC} Fix: chmod +x .husky/pre-commit"
      ALL_OK=false
    fi
  else
    echo -e "  ${RED}✗${NC} pre-commit hook does not exist"
    ALL_OK=false
  fi

  # 5. Check pre-push hook
  echo -e "\n${YELLOW}[5/7]${NC} Checking pre-push hook..."
  if [ -f ".husky/pre-push" ]; then
    if [ -x ".husky/pre-push" ]; then
      echo -e "  ${GREEN}✓${NC} pre-push hook exists and is executable"
    else
      echo -e "  ${YELLOW}⚠${NC} pre-push hook exists but is not executable"
      echo -e "  ${YELLOW}→${NC} Fix: chmod +x .husky/pre-push"
      ALL_OK=false
    fi
  else
    echo -e "  ${RED}✗${NC} pre-push hook does not exist"
    ALL_OK=false
  fi

  # 6. Check Git hooks path
  echo -e "\n${YELLOW}[6/7]${NC} Checking Git hooks path..."
  HOOKS_PATH=$(git config core.hooksPath)
  if [ "$HOOKS_PATH" = ".husky" ]; then
    echo -e "  ${GREEN}✓${NC} Git hooks path is correctly set: $HOOKS_PATH"
  elif [ -z "$HOOKS_PATH" ]; then
    echo -e "  ${YELLOW}⚠${NC} Git hooks path is not set"
    echo -e "  ${YELLOW}→${NC} Fix: git config core.hooksPath .husky"
    ALL_OK=false
  else
    echo -e "  ${RED}✗${NC} Git hooks path is incorrect: $HOOKS_PATH"
    echo -e "  ${YELLOW}→${NC} Fix: git config core.hooksPath .husky"
    ALL_OK=false
  fi

  # 7. Check send-ci.sh script
  echo -e "\n${YELLOW}[7/7]${NC} Checking send-ci.sh script..."
  if [ -f "send-ci.sh" ]; then
    if [ -x "send-ci.sh" ]; then
      echo -e "  ${GREEN}✓${NC} send-ci.sh exists and is executable"
    else
      echo -e "  ${YELLOW}⚠${NC} send-ci.sh exists but is not executable"
      echo -e "  ${YELLOW}→${NC} Fix: chmod +x send-ci.sh"
      ALL_OK=false
    fi
  else
    echo -e "  ${RED}✗${NC} send-ci.sh does not exist"
    ALL_OK=false
  fi

  # Final result
  echo -e "\n${BLUE}════════════════════════════════════════${NC}"
  if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo -e "Git hooks are properly configured.\n"
    return 0
  else
    echo -e "${RED}❌ Some checks failed${NC}\n"
    return 1
  fi
}

# Setup function
setup_hooks() {
  echo -e "${BLUE}════════════════════════════════════════${NC}"
  echo -e "${BLUE}   Git Hooks Setup${NC}"
  echo -e "${BLUE}════════════════════════════════════════${NC}\n"

  # 1. Check Git repository
  if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not a Git repository${NC}"
    exit 1
  fi

  # 2. Check Node.js
  if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    exit 1
  fi

  # 3. Check and install Husky package
  echo -e "${YELLOW}📦 [1/5] Checking dependencies...${NC}"
  if [ ! -d "node_modules/husky" ]; then
    echo -e "${YELLOW}   → Husky not found. Installing...${NC}"
    yarn install
  else
    echo -e "${GREEN}   ✓ Husky is already installed${NC}"
  fi

  # 4. Initialize Husky
  echo -e "\n${YELLOW}🎣 [2/5] Installing Git hooks...${NC}"
  npx husky install
  echo -e "${GREEN}   ✓ Git hooks installed${NC}"

  # 5. Set execute permissions
  echo -e "\n${YELLOW}🔐 [3/5] Setting execute permissions...${NC}"
  chmod +x .husky/pre-commit 2>/dev/null && echo -e "${GREEN}   ✓ pre-commit permission set${NC}" || echo -e "${YELLOW}   ⚠ Failed to set pre-commit permission${NC}"
  chmod +x .husky/pre-push 2>/dev/null && echo -e "${GREEN}   ✓ pre-push permission set${NC}" || echo -e "${YELLOW}   ⚠ Failed to set pre-push permission${NC}"
  chmod +x send-ci.sh 2>/dev/null && echo -e "${GREEN}   ✓ send-ci.sh permission set${NC}" || echo -e "${YELLOW}   ⚠ Failed to set send-ci.sh permission${NC}"

  # 6. Configure Git hooks path
  echo -e "\n${YELLOW}⚙️  [4/5] Configuring Git hooks path...${NC}"
  git config core.hooksPath .husky
  echo -e "${GREEN}   ✓ Git hooks path: .husky${NC}"

  # 7. Verification
  echo -e "\n${YELLOW}🧪 [5/5] Verifying setup...${NC}"

  if [ -f ".husky/pre-commit" ]; then
    echo -e "${GREEN}   ✓ pre-commit hook file exists${NC}"
  else
    echo -e "${RED}   ✗ pre-commit hook file not found${NC}"
  fi

  if [ -f ".husky/pre-push" ]; then
    echo -e "${GREEN}   ✓ pre-push hook file exists${NC}"
  else
    echo -e "${RED}   ✗ pre-push hook file not found${NC}"
  fi

  HOOKS_PATH=$(git config core.hooksPath)
  if [ "$HOOKS_PATH" = ".husky" ]; then
    echo -e "${GREEN}   ✓ Git hooks path is correct: $HOOKS_PATH${NC}"
  else
    echo -e "${YELLOW}   ⚠ Git hooks path: $HOOKS_PATH${NC}"
  fi

  echo -e "\n${BLUE}════════════════════════════════════════${NC}"
  echo -e "${GREEN}✅ Git Hooks setup completed!${NC}"
  echo -e "${YELLOW}📝 Hooks will run automatically on next commit/push.${NC}\n"
}

# Main logic
case $MODE in
  check)
    check_status
    exit $?
    ;;
  setup)
    setup_hooks
    echo -e "${YELLOW}🔍 Running final verification...${NC}\n"
    check_status
    exit $?
    ;;
  auto)
    # Auto-detect: check status, install if needed
    if check_status 2>/dev/null; then
      exit 0
    else
      echo -e "\n${YELLOW}⚠️  Setup incomplete. Starting auto-installation...${NC}\n"
      sleep 1
      setup_hooks
      echo -e "${YELLOW}🔍 Running final verification...${NC}\n"
      check_status
      exit $?
    fi
    ;;
  *)
    echo -e "${RED}❌ Invalid option: $MODE${NC}\n"
    usage
    exit 1
    ;;
esac
