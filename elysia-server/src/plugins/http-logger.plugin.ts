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
 * Scanner bot patterns - common vulnerability scanning paths
 */
const SCANNER_PATTERNS = [
  /\.(php|asp|aspx|jsp|cgi|env|git|bak|old|sql|log|key|pem|json|xml|yml|yaml|ini|conf|config|md|txt|map)$/i,
  /\/(wp-admin|wp-content|wp-includes|wordpress|phpmyadmin|admin|administrator|backup)/i,
  /\/(\.env|\.git|\.svn|\.htaccess|\.htpasswd|web\.config)/i,
  /\/(database|db|config|credentials|secret|private|passwd|shadow)/i,
  /\/(api\/v\d+\/?$)/, // Root API version paths like /api/v1/, /api/v2/
]

/**
 * Check if request is from scanner bot
 */
export const isScannerRequest = (path: string): boolean =>
  SCANNER_PATTERNS.some((pattern) => pattern.test(path))

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

    const logMessage = `${getStatusIcon(status)} ${method} ${path} ${status} ${formatDuration(duration)} | ${errorMsg}`

    // Scanner bot 404 requests → debug level (reduce noise)
    if (status === 404 && isScannerRequest(path)) {
      logger.debug(logMessage)
    } else {
      logger.error(logMessage)
    }

    requestTimes.delete(ctx.request)
  })
