#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory (parent of scripts folder)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
    echo ""
    echo -e "${BLUE}SendGrinda Development Script${NC}"
    echo ""
    echo "Usage: ./scripts/dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup     - Setup local database, run migrations and seed data"
    echo "  dev       - Start frontend and backend dev servers"
    echo "  cleanup   - Stop all containers and clean up"
    echo ""
    echo "Examples:"
    echo "  ./scripts/dev.sh setup    # First time setup"
    echo "  ./scripts/dev.sh dev      # Start development"
    echo "  ./scripts/dev.sh cleanup  # Clean everything"
    echo ""
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
}

# Setup command
setup() {
    echo -e "${BLUE}Setting up local development environment...${NC}"
    echo ""

    check_docker

    # Check if .env files exist
    if [ ! -f "$PROJECT_ROOT/elysia-server/.env" ]; then
        echo -e "${YELLOW}Creating elysia-server/.env from example...${NC}"
        cp "$PROJECT_ROOT/elysia-server/.env.example" "$PROJECT_ROOT/elysia-server/.env"
        # Update DATABASE_URL for local development
        sed -i.bak 's|DATABASE_URL=.*|DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres|' "$PROJECT_ROOT/elysia-server/.env"
        rm -f "$PROJECT_ROOT/elysia-server/.env.bak"
        echo -e "${GREEN}Created elysia-server/.env${NC}"
        echo -e "${YELLOW}Note: Please update API keys in elysia-server/.env${NC}"
    fi

    if [ ! -f "$PROJECT_ROOT/admin/.env" ]; then
        echo -e "${YELLOW}Creating admin/.env from example...${NC}"
        cp "$PROJECT_ROOT/admin/.env.example" "$PROJECT_ROOT/admin/.env"
        echo -e "${GREEN}Created admin/.env${NC}"
    fi

    # Start PostgreSQL container
    echo -e "${BLUE}Starting PostgreSQL container...${NC}"
    docker compose -f "$PROJECT_ROOT/compose.db.yml" up -d

    # Wait for PostgreSQL to be ready
    echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
    sleep 5

    # Check if PostgreSQL is accepting connections
    for i in {1..30}; do
        if docker compose -f "$PROJECT_ROOT/compose.db.yml" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}PostgreSQL is ready!${NC}"
            break
        fi
        if [ $i -eq 30 ]; then
            echo -e "${RED}PostgreSQL failed to start. Check logs with: docker compose -f compose.db.yml logs${NC}"
            exit 1
        fi
        echo "Waiting for PostgreSQL... ($i/30)"
        sleep 1
    done

    # Install dependencies
    echo -e "${BLUE}Installing dependencies...${NC}"
    cd "$PROJECT_ROOT/admin" && yarn install
    cd "$PROJECT_ROOT/elysia-server" && bun install

    # Run migrations and seed
    echo -e "${BLUE}Running database migrations...${NC}"
    cd "$PROJECT_ROOT/elysia-server"
    bun run db:push

    # Check if seed is needed (check if users table is empty)
    echo -e "${BLUE}Checking if seeding is needed...${NC}"
    USER_COUNT=$(docker compose -f "$PROJECT_ROOT/compose.db.yml" exec -T postgres psql -U postgres -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ' || echo "0")

    if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
        echo -e "${BLUE}Seeding database...${NC}"
        bun run db:seed
    else
        echo -e "${GREEN}Database already has data, skipping seed.${NC}"
    fi

    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
    echo -e "Run ${YELLOW}./scripts/dev.sh dev${NC} to start development servers."
}

# Dev command
dev() {
    echo -e "${BLUE}Starting development servers...${NC}"
    echo ""

    check_docker

    # Make sure PostgreSQL is running
    if ! docker compose -f "$PROJECT_ROOT/compose.db.yml" ps | grep -q "postgres.*running"; then
        echo -e "${YELLOW}PostgreSQL is not running. Starting it...${NC}"
        docker compose -f "$PROJECT_ROOT/compose.db.yml" up -d
        sleep 3
    fi

    # Start both servers using concurrently or in background
    echo -e "${GREEN}Starting Admin (Frontend) on http://localhost:5173${NC}"
    echo -e "${GREEN}Starting Elysia Server (Backend) on http://localhost:3001${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
    echo ""

    # Run both servers
    cd "$PROJECT_ROOT"

    # Use trap to handle Ctrl+C
    trap 'echo ""; echo -e "${YELLOW}Stopping servers...${NC}"; kill $(jobs -p) 2>/dev/null; exit 0' INT TERM

    # Start servers in background
    (cd "$PROJECT_ROOT/admin" && yarn dev) &
    ADMIN_PID=$!

    (cd "$PROJECT_ROOT/elysia-server" && bun run dev) &
    SERVER_PID=$!

    # Wait for both processes
    wait $ADMIN_PID $SERVER_PID
}

# Cleanup command
cleanup() {
    echo -e "${BLUE}Cleaning up...${NC}"
    echo ""

    # Stop any running Node/Bun processes for this project
    echo -e "${YELLOW}Stopping development servers...${NC}"
    pkill -f "vite.*admin" 2>/dev/null || true
    pkill -f "bun.*elysia-server" 2>/dev/null || true

    # Kill processes on common dev ports
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true

    # Stop and remove Docker containers
    echo -e "${YELLOW}Stopping Docker containers...${NC}"
    docker compose -f "$PROJECT_ROOT/compose.db.yml" down -v 2>/dev/null || true

    # Clean node_modules cache (optional - commented out for speed)
    # echo -e "${YELLOW}Cleaning node_modules cache...${NC}"
    # rm -rf "$PROJECT_ROOT/admin/node_modules/.cache" 2>/dev/null || true
    # rm -rf "$PROJECT_ROOT/elysia-server/node_modules/.cache" 2>/dev/null || true

    # Clean build artifacts
    echo -e "${YELLOW}Cleaning build artifacts...${NC}"
    rm -rf "$PROJECT_ROOT/admin/dist" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/elysia-server/dist" 2>/dev/null || true

    echo ""
    echo -e "${GREEN}Cleanup complete!${NC}"
}

# Main
case "${1:-}" in
    setup)
        setup
        ;;
    dev)
        dev
        ;;
    cleanup)
        cleanup
        ;;
    *)
        usage
        exit 1
        ;;
esac
