# Codex

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Elysia.js + Bun + Drizzle ORM
- Linter: Biome

## Code Standards
- 2 spaces, 100 line width, double quotes
- Avoid `any`, use `const`, template literals
- Remove unused imports/variables
- Type all functions

## Structure
```
admin/src/
  components/  # UI components
  pages/       # Pages
  lib/         # Utils & API

elysia-server/src/
  routes/      # API routes
  services/    # Business logic
  db/schema/   # Database schemas
  workers/     # Background jobs
```

## Commands
```bash
bun biome check --write .  # Format & lint
```

## Naming
- Components: PascalCase
- Files: kebab-case
- Variables: camelCase
