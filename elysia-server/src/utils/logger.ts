import pino from "pino"
import { config, isProduction } from "../config"

export const logger = pino({
  level: config.logging.level,

  // Pretty printing in development, JSON in production
  transport: !isProduction
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
          singleLine: false,
        },
      }
    : undefined,

  // Add service context
  base: {
    env: config.nodeEnv,
    service: "elysia-server",
  },

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

export default logger
