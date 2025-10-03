import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { config, isDevelopment } from "../config"
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

// Monitor pool errors (always log errors)
pool.on("error", (err) => {
  logger.error({ err }, "PostgreSQL pool error")
})

// Only log connection events in development with TRACE level
if (isDevelopment && process.env.LOG_LEVEL === "trace") {
  pool.on("connect", () => {
    logger.trace("New database connection established")
  })

  pool.on("remove", () => {
    logger.trace("Database connection removed from pool")
  })
}

// Export drizzle instance with schema
export const db = drizzle(pool, { schema })

// Export pool for direct access if needed (e.g., for health checks)
export { pool }
