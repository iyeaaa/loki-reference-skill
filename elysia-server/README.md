# Elysia Server - SendGrid Email Service API

A production-ready email management system built with Elysia, featuring AI-powered email automation, workflow management, and Mastra AI integration.

## Features

- Email management with SendGrid integration
- AI-powered email replies and drafting (OpenAI + Mastra)
- Email sequences and workflow automation
- Lead management and customer groups
- Email templates and signatures
- User authentication with JWT
- Rate limiting and security headers
- Comprehensive logging with Pino
- OpenAPI documentation with Scalar UI

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: PostgreSQL with Drizzle ORM
- **Email**: SendGrid
- **AI**: OpenAI, LangChain, Mastra
- **Authentication**: JWT
- **Validation**: Zod
- **Logging**: Pino

## Installation

```bash
bun install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Required Environment Variables

```env
# Database
DATABASE_URL=postgres://user:password@host:port/database

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_email@domain.com

# JWT
JWT_SECRET=your_secret_key_min_32_characters

# OpenAI (Required for AI features)
OPENAI_API_KEY=your_openai_api_key
```

### Optional Mastra Configuration

```env
MASTRA_MODEL=gpt-4o-mini           # Default: gpt-4o-mini
MASTRA_MAX_TOKENS=1000             # Default: 1000
MASTRA_TEMPERATURE=0.7             # Default: 0.7
```

## Database Setup

### Local Development with Docker

```bash
# Start PostgreSQL with Docker
bun run docker:db-up

# Push schema and seed data
bun run db:setup:local
```

### Production

```bash
# Run migrations
bun run db:migrate

# Seed initial data
bun run db:seed
```

## Development

```bash
# Development mode with hot reload
bun run dev

# Development with local Docker database
bun run dev:local

# Run Mastra Studio (AI agent playground)
bun run mastra:dev
# Access at http://localhost:4111
```

## Building & Running

```bash
# Type check
bun run type-check

# Lint and format
bun run lint
bun run format

# Build for production
bun run build

# Start production server
bun run start
```

## Testing

```bash
# Run unit tests
bun test

# Run E2E tests
bun run test:e2e

# Run E2E tests with UI
bun run test:e2e:ui
```

## Database Commands

```bash
# Generate migrations
bun run db:generate

# Push schema to database
bun run db:push

# Open Drizzle Studio
bun run db:studio

# Backup database
bun run db:backup

# Restore database
bun run db:restore
```

## API Documentation

Once the server is running, visit:
- OpenAPI (Scalar UI): `http://localhost:3001/openapi`
- OpenAPI JSON: `http://localhost:3001/openapi/json`
- Health check: `http://localhost:3001/health`

## Mastra AI Endpoints

### Email Agent
- `POST /api/mastra/email-agent/chat` - Chat with email assistant
- `POST /api/mastra/email/draft` - Generate professional email drafts

### General Assistant
- `POST /api/mastra/general-assistant/chat` - Chat with general AI assistant

### Agent Info
- `GET /api/mastra/agents` - List available agents and capabilities

## Architecture

This project follows Vertical Slice Architecture with Functional Core, Imperative Shell (FCIS) pattern:

```
src/
├── app/web/main.ts              # Server setup (index.ts)
├── feature/                     # Business capabilities (routes/)
│   └── {feature}/
│       ├── core/                # Pure logic (validation, rules)
│       └── shell/               # Orchestration + I/O
└── shared/                      # Infrastructure
    ├── mastra/                  # AI agent infrastructure
    │   ├── core/                # Config validation
    │   └── shell/               # Mastra instance, agents
    ├── db/                      # Database
    └── config/                  # Configuration
```

## License

Private project for Grinda AI

## Support

For issues and questions, contact: support@grinda.ai
