# Contributing to SendGrinda

Thank you for your interest in contributing to SendGrinda! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Development Setup

### Prerequisites

- **Node.js** 20+
- **Bun** 1.2+
- **Docker** & Docker Compose
- **Yarn** 4.x (enabled via Corepack)

### Quick Start

```bash
# Clone the repository
git clone git@github.com:CheolheeLee0/send-grid-test.git
cd send-grid-test

# Enable Corepack for Yarn
corepack enable

# Run setup (installs deps, starts DB, runs migrations)
./scripts/dev.sh setup

# Start development servers
./scripts/dev.sh dev
```

### Development Commands

| Command | Description |
|---------|-------------|
| `./scripts/dev.sh setup` | Setup local database, install dependencies, run migrations and seed |
| `./scripts/dev.sh dev` | Start frontend (port 5173) and backend (port 3001) dev servers |
| `./scripts/dev.sh cleanup` | Stop all containers, kill dev servers, clean build artifacts |

### Manual Setup

If you prefer manual setup:

```bash
# Install dependencies
cd admin && yarn install
cd ../elysia-server && bun install

# Start database
docker compose -f compose.db.yml up -d

# Run migrations and seed
cd elysia-server
bun run db:push
bun run db:seed

# Start servers (in separate terminals)
cd admin && yarn dev
cd elysia-server && bun run dev
```

## Code Style

We use **Biome** for linting and formatting across both frontend and backend.

### Linting Commands

```bash
# Admin (Frontend)
cd admin
yarn lint          # Auto-fix issues
yarn lint:check    # Check only (CI mode)
yarn type-check    # TypeScript type checking
yarn check         # Lint + type check

# Elysia Server (Backend)
cd elysia-server
bun lint           # Auto-fix issues
bun lint:check     # Check only (CI mode)
bun type-check     # TypeScript type checking
```

### Pre-commit Hooks

The project uses **Husky** to run pre-commit hooks automatically. When you commit, the following checks run:

1. **Biome lint** - Linting with auto-fix
2. **Biome check** - Verify no lint errors remain
3. **TypeScript** - Type checking with `tsc --noEmit`

This ensures all code pushed to the repository meets quality standards.

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing patterns in the codebase
- Keep functions small and focused
- Write meaningful variable and function names
- Add comments for complex logic only

## Git Workflow

### Branch Naming

- `feature/` - New features (e.g., `feature/user-authentication`)
- `fix/` - Bug fixes (e.g., `fix/email-parsing-error`)
- `refactor/` - Code refactoring (e.g., `refactor/api-client`)
- `docs/` - Documentation changes (e.g., `docs/api-endpoints`)

### Commit Messages

Follow conventional commit format:

```
<type>(<scope>): <description>

[optional body]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `style` - Formatting, no code change
- `test` - Adding tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(email): add bulk email sending feature
fix(auth): resolve JWT token expiration issue
refactor(api): simplify error handling middleware
docs(readme): update installation instructions
```

## Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit with meaningful messages

3. **Ensure all checks pass**
   ```bash
   ./scripts/send-ci.sh full  # Run full CI checks locally
   ```

4. **Push your branch**
   ```bash
   git push -u origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Use a clear, descriptive title
   - Fill in the PR template
   - Link related issues if any

6. **Address review feedback** and update your PR as needed

### PR Requirements

- All CI checks must pass (lint, type-check, build)
- Code must be reviewed by at least one team member
- No merge conflicts with `main`

## Testing

### Running Tests

```bash
# Backend tests
cd elysia-server
bun test           # Run all tests
bun test:watch     # Watch mode

# E2E tests (if configured)
bun test:e2e
```

### Writing Tests

- Place test files next to the code they test with `.test.ts` extension
- Use descriptive test names
- Test edge cases and error conditions

## Project Structure

```
send-grid-test/
├── admin/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── lib/          # Utilities and API client
│   │   └── router/       # Route configuration
│   └── package.json
│
├── elysia-server/         # Bun + Elysia backend
│   ├── src/
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   ├── db/           # Database schemas (Drizzle)
│   │   ├── plugins/      # Elysia plugins
│   │   └── lib/          # Utilities
│   └── package.json
│
├── scripts/               # Development and CI scripts
│   ├── dev.sh            # Development helper (setup, dev, cleanup)
│   ├── send-ci.sh        # CI check script (lint, type-check, build)
│   └── biome.sh          # Biome lint runner
│
├── .github/workflows/    # GitHub Actions CI/CD
└── docker-compose.yml    # Production Docker setup
```

## Need Help?

- Check existing issues and PRs for similar questions
- Create an issue for bugs or feature requests
- Contact the team via Slack

---

Happy coding!
