/**
 * Get required environment variable
 * Throws error if not found
 */
function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Get optional environment variable with default value
 */
function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

/**
 * Parse integer from environment variable
 */
function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`❌ Invalid number for ${key}: ${value}`)
  }
  return parsed
}

/**
 * Validate email format
 */
function validateEmail(email: string, fieldName: string): string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new Error(`❌ Invalid email format for ${fieldName}: ${email}`)
  }
  return email
}

// Environment detection
export const NODE_ENV = getEnvOrDefault("NODE_ENV", "development") as "development" | "production" | "test"
export const isDevelopment = NODE_ENV === "development"
export const isProduction = NODE_ENV === "production"
export const isTest = NODE_ENV === "test"

// Application config
export const config = {
  // Server
  port: getEnvInt("PORT", 3001),
  nodeEnv: NODE_ENV,

  // Database
  database: {
    url: getEnv("DATABASE_URL"),
    poolMin: getEnvInt("DB_POOL_MIN", 2),
    poolMax: getEnvInt("DB_POOL_MAX", 10),
  },

  // SendGrid
  sendgrid: {
    apiKey: getEnv("SENDGRID_API_KEY"),
    fromEmail: validateEmail(
      getEnvOrDefault("SENDGRID_FROM_EMAIL", "rinda@partners.grinda.ai"),
      "SENDGRID_FROM_EMAIL"
    ),
    fromName: getEnvOrDefault("SENDGRID_FROM_NAME", "Rinda Expert - 그린다에이아이"),
  },

  // JWT
  jwt: {
    secret: getEnv("JWT_SECRET"),
    expiresIn: getEnvOrDefault("JWT_EXPIRES_IN", "7d"),
  },

  // Logging
  logging: {
    level: getEnvOrDefault("LOG_LEVEL", isProduction ? "info" : "debug"),
  },

  // CORS
  cors: {
    allowedOrigins: getEnvOrDefault("ALLOWED_ORIGINS", "*").split(","),
  },

  // Rate Limiting
  rateLimit: {
    max: getEnvInt("RATE_LIMIT_MAX", 100),
    windowMs: getEnvInt("RATE_LIMIT_WINDOW_MS", 60000), // 1 minute
  },

  // Monitoring (optional)
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
  },
} as const

// Log configuration on startup (only in development)
if (isDevelopment) {
  console.log("✅ Configuration loaded successfully")
  console.log(`   - Environment: ${NODE_ENV}`)
  console.log(`   - Port: ${config.port}`)
  console.log(`   - Database: ${config.database.url.split("@")[1] || "configured"}`)
  console.log(`   - SendGrid: ${config.sendgrid.fromEmail}`)
}
