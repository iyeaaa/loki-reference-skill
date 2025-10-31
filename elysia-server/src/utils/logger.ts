import pino from "pino"
import { config, isProduction } from "../config"

export const logger = pino({
  level: config.logging.level,

  // Pretty printing in development, JSON in production
  // Note: Removed messageFormat to avoid DataCloneError with worker threads
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }
    : undefined,

  // Add service context (only in production)
  base: isProduction
    ? {
        env: config.nodeEnv,
        service: "elysia-server",
      }
    : undefined,

  // Format log levels
  formatters: {
    level: (label) => ({ level: label }),
  },

  // Redact sensitive information
  redact: {
    paths: [
      "password",
      "passwordHash",
      "apiKey",
      "token",
      "accessToken",
      "refreshToken",
      "authorization",
      "*.password",
      "*.passwordHash",
      "*.apiKey",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.authorization",
      "req.headers.authorization",
      "headers.authorization",
    ],
    censor: "[REDACTED]",
  },
})

/**
 * Create a child logger with request-specific context
 */
export const createRequestLogger = (requestId: string, userId?: string) => {
  return logger.child({
    requestId,
    ...(userId && { userId }),
  })
}

/**
 * Docker-style logging helpers for chatbot operations
 * Format messages directly for better readability without custom messageFormat
 */
export const chatbotLogger = {
  info: (message: string) => {
    logger.info(message)
  },

  error: (message: string) => {
    logger.error(message)
  },

  nodeStart: (nodeName: string, context = "LangGraph") => {
    logger.info(`[${context}] Node started: ${nodeName}`)
  },

  nodeSuccess: (nodeName: string, duration: number, context = "LangGraph") => {
    const durationStr =
      duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`
    logger.info(`[${context}] Node completed: ${nodeName} (${durationStr})`)
  },

  nodeError: (nodeName: string, error: string, duration: number, context = "LangGraph") => {
    const durationStr =
      duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`
    logger.error(`[${context}] Node failed: ${nodeName} - ${error} (${durationStr})`)
  },

  routeStart: (method: string, path: string) => {
    logger.info(`[API] ${method} ${path}`)
  },

  routeSuccess: (method: string, path: string, statusCode: number, duration: number) => {
    const durationStr =
      duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`
    logger.info(`[API] ${method} ${path} - ${statusCode} (${durationStr})`)
  },

  routeError: (
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    error?: string,
  ) => {
    const durationStr =
      duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`
    const errorMsg = error ? ` - ${error}` : ""
    logger.error(`[API] ${method} ${path} - ${statusCode}${errorMsg} (${durationStr})`)
  },

  graphEvent: (eventType: string, nodeName: string, duration?: number) => {
    const durationStr =
      duration !== undefined
        ? ` (${duration < 1000 ? `${Math.round(duration)}ms` : `${(duration / 1000).toFixed(2)}s`})`
        : ""
    logger.debug(`[Graph] ${eventType}: ${nodeName}${durationStr}`)
  },
}

export default logger
