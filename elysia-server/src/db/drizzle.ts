import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { config } from "../config"
import logger from "../utils/logger"
import * as schema from "./schema"

// Create connection pool with optimized settings
const pool = new Pool({
  connectionString: config.database.url,
  min: config.database.poolMin, // Minimum number of connections
  max: config.database.poolMax, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Fail fast if connection takes > 2s
})

// Monitor pool errors
pool.on("error", (err) => {
  logger.error({ err }, "PostgreSQL pool error")
})

// Log new connections (only in development)
pool.on("connect", (client) => {
  logger.debug("New database connection established")
})

// Log when client is removed from pool
pool.on("remove", () => {
  logger.debug("Database connection removed from pool")
})

// Export drizzle instance with schema
export const db = drizzle(pool, { schema })

// Export pool for direct access if needed (e.g., for health checks)
export { pool }
