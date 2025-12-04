import { Elysia } from "elysia"
import logger from "../utils/logger"

/**
 * Get status icon for Docker-style logging
 */
const getStatusIcon = (statusCode: number): string => {
  if (statusCode < 300) return "✓"
  if (statusCode < 400) return "→"
  if (statusCode < 500) return "⚠"
  return "✗"
}

/**
 * Format duration for display
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Check if path should be logged
 */
const shouldSkipLogging = (path: string): boolean =>
  path.startsWith("/health") || path.startsWith("/swagger") || path.includes("/favicon")

/**
 * HTTP Request/Response Logger
 * Docker-style compact logging
 *
 * Format: ICON METHOD PATH STATUS DURATION [| ERROR]
 * Example: ✓ GET /api/v1/users 200 15ms
 */
const requestTimes = new WeakMap<Request, number>()

export const httpLogger = new Elysia({ name: "http-logger" })
  .derive(({ request }) => {
    requestTimes.set(request, Date.now())
    return {}
  })
  .mapResponse(({ request, set }) => {
    const { method, url } = request
    const path = new URL(url).pathname

    if (shouldSkipLogging(path)) {
      requestTimes.delete(request)
      return
    }

    const startTime = requestTimes.get(request) || Date.now()
    const duration = Date.now() - startTime
    const status = typeof set.status === "number" ? set.status : 200

    logger.info(`${getStatusIcon(status)} ${method} ${path} ${status} ${formatDuration(duration)}`)

    requestTimes.delete(request)
  })
  .onError({ as: "global" }, (ctx) => {
    const { method, url } = ctx.request
    const path = new URL(url).pathname

    if (shouldSkipLogging(path)) {
      requestTimes.delete(ctx.request)
      return
    }

    const startTime = requestTimes.get(ctx.request) || Date.now()
    const duration = Date.now() - startTime
    const status = typeof ctx.set.status === "number" ? ctx.set.status : 500
    const errorMsg = ctx.error instanceof Error ? ctx.error.message : String(ctx.error)

    logger.error(
      `${getStatusIcon(status)} ${method} ${path} ${status} ${formatDuration(duration)} | ${errorMsg}`,
    )

    requestTimes.delete(ctx.request)
  })
