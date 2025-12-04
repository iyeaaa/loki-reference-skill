import { Elysia } from "elysia"
import { pool } from "../db/drizzle"
import logger from "../utils/logger"

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  const start = Date.now()
  try {
    await pool.query("SELECT 1")
    return {
      healthy: true,
      latency: Date.now() - start,
    }
  } catch (error) {
    logger.error({ err: error }, "Database health check failed")
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// API health route for nginx /api/* routing
export const apiHealthRoute = new Elysia().get("/api/health", async () => {
  const start = Date.now()
  try {
    await pool.query("SELECT 1")
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: { status: "up", latency: Date.now() - start },
    }
  } catch (error) {
    return {
      status: "degraded",
      timestamp: new Date().toISOString(),
      database: { status: "down", error: error instanceof Error ? error.message : "Unknown" },
    }
  }
})

export const healthRoutes = new Elysia({ prefix: "/health" })
  // Detailed health check with all services
  .get("/", async ({ set }) => {
    const dbCheck = await checkDatabase()

    const health = {
      status: dbCheck.healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      checks: {
        database: {
          status: dbCheck.healthy ? "up" : "down",
          latency: dbCheck.latency,
          error: dbCheck.error,
        },
        memory: {
          heapUsed: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
          heapTotal: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
          external: Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
          unit: "MB",
        },
      },
    }

    if (!dbCheck.healthy) {
      set.status = 503 // Service Unavailable
    }

    return health
  })

  // Kubernetes readiness probe
  // Returns 200 if service is ready to accept traffic
  .get("/ready", async ({ set }) => {
    const dbCheck = await checkDatabase()

    if (!dbCheck.healthy) {
      set.status = 503
      return {
        ready: false,
        reason: "Database connection failed",
      }
    }

    return { ready: true }
  })

  // Kubernetes liveness probe
  // Returns 200 if service is alive (even if not ready)
  .get("/live", () => ({
    alive: true,
    timestamp: new Date().toISOString(),
  }))

  // Legacy endpoint for backward compatibility
  .get("/api/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
