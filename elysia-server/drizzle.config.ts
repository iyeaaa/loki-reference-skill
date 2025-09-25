import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: Bun.env.DB_HOST || 'localhost',
    port: parseInt(Bun.env.DB_PORT || '5432'),
    user: Bun.env.DB_USER || 'postgres',
    password: Bun.env.DB_PASSWORD || 'postgres',
    database: Bun.env.DB_NAME || 'postgres',
    ssl: false,
  },
} satisfies Config