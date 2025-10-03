import { Elysia } from "elysia"
import logger from "../utils/logger"

/**
 * Get status marker for Docker-style logging
 */
const getStatusMarker = (statusCode: number): string => {
  if (statusCode < 300) return "[OK]"
  if (statusCode < 400) return "[REDIRECT]"
  if (statusCode < 500) return "[CLIENT_ERROR]"
  return "[SERVER_ERROR]"
}

/**
 * Check if path should be logged
 */
const shouldSkipLogging = (path: string): boolean =>
  path.startsWith("/health") || path.startsWith("/swagger") || path.includes("/favicon")

/**
 * HTTP Request/Response Logger
 * Docker-style logging for API requests
 *
 * Logs: [STATUS] METHOD PATH - CODE (DURATIONms)
 * Example: [OK] GET /api/v1/users - 200 (15ms)
 */
// Store request start times
const requestTimes = new WeakMap<Request, number>()

export const httpLogger = new Elysia({ name: "http-logger" })
  .onRequest(({ request }) => {
    requestTimes.set(request, Date.now())
  })
  .onAfterHandle({ as: "global" }, (ctx) => {
    const { method, url } = ctx.request
    const path = new URL(url).pathname

    if (shouldSkipLogging(path)) return

    const startTime = requestTimes.get(ctx.request) || Date.now()
    const duration = Date.now() - startTime
    const status = typeof ctx.set.status === "number" ? ctx.set.status : 200

    logger.info(
      { method, path, status, duration },
      `${getStatusMarker(status)} ${method} ${path} - ${status} (${duration}ms)`,
    )

    requestTimes.delete(ctx.request)
  })
  .onError((ctx) => {
    const { method, url } = ctx.request
    const path = new URL(url).pathname

    const startTime = requestTimes.get(ctx.request) || Date.now()
    const duration = Date.now() - startTime
    const status = typeof ctx.set.status === "number" ? ctx.set.status : 500

    logger.error(
      { method, path, status, duration, err: ctx.error },
      `[ERROR] ${method} ${path} - ${status} (${duration}ms)`,
    )

    requestTimes.delete(ctx.request)
  })
