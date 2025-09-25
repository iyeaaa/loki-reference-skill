import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = Bun.env.DATABASE_URL ||
  `postgres://${Bun.env.DB_USER || 'postgres'}:${Bun.env.DB_PASSWORD || 'postgres'}@${Bun.env.DB_HOST || 'localhost'}:${Bun.env.DB_PORT || '5432'}/${Bun.env.DB_NAME || 'postgres'}`

const pool = new Pool({
  connectionString,
})

export const db = drizzle(pool, { schema })