import "dotenv/config"

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
export const NODE_ENV = getEnvOrDefault("NODE_ENV", "development") as
  | "development"
  | "production"
  | "test"
export const isDevelopment = NODE_ENV === "development"
export const isProduction = NODE_ENV === "production"
export const isTest = NODE_ENV === "test"

// Application config
export const config = {
  // Server
  port: getEnvInt("PORT", 3001),
  nodeEnv: NODE_ENV,

  // Frontend URL (for email notification links)
  frontendUrl: getEnvOrDefault("FRONTEND_URL", "https://app.rinda.ai"),

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
      getEnvOrDefault("SENDGRID_FROM_EMAIL", "rinda@send.grinda.ai"),
      "SENDGRID_FROM_EMAIL",
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

  // Redis (for BullMQ)
  redis: {
    host: getEnvOrDefault("REDIS_HOST", "localhost"),
    port: getEnvInt("REDIS_PORT", 6379),
    password: getEnvOrDefault("REDIS_PASSWORD", ""),
  },

  // Redis Cache Configuration
  cache: {
    leadEnrichment: {
      enabled:
        getEnvOrDefault("LEAD_ENRICHMENT_REDIS_CACHE_ENABLED", "true").toLowerCase() === "true",
      keyPrefix: getEnvOrDefault("LEAD_ENRICHMENT_REDIS_CACHE_PREFIX", "lead_enrichment:v1:"),
      ttlMs: getEnvInt("LEAD_ENRICHMENT_CACHE_TTL_MS", 6 * 60 * 60 * 1000), // 6 hours
      timeoutMs: getEnvInt("LEAD_ENRICHMENT_REDIS_TIMEOUT_MS", 250),
    },
    leadDiscovery: {
      enabled:
        getEnvOrDefault("LEAD_DISCOVERY_REDIS_CACHE_ENABLED", "true").toLowerCase() === "true",
      keyPrefix: getEnvOrDefault("LEAD_DISCOVERY_REDIS_CACHE_PREFIX", "lead_discovery:v1:"),
      ttlMs: getEnvInt("LEAD_DISCOVERY_CACHE_TTL_MS", 24 * 60 * 60 * 1000), // 24 hours
      timeoutMs: getEnvInt("LEAD_DISCOVERY_REDIS_TIMEOUT_MS", 250),
    },
    emailVerification: {
      enabled:
        getEnvOrDefault("EMAIL_VERIFICATION_REDIS_CACHE_ENABLED", "true").toLowerCase() === "true",
      keyPrefix: getEnvOrDefault("EMAIL_VERIFICATION_REDIS_CACHE_PREFIX", "email_verification:v1:"),
      ttlMs: getEnvInt("EMAIL_VERIFICATION_CACHE_TTL_MS", 365 * 24 * 60 * 60 * 1000), // 365 days
      timeoutMs: getEnvInt("EMAIL_VERIFICATION_REDIS_TIMEOUT_MS", 250),
    },
  },

  // Monitoring (optional)
  monitoring: {
    sentryDsn: getEnvOrDefault("SENTRY_DSN", ""),
  },

  // OpenAI (for Mastra)
  openai: {
    apiKey: getEnvOrDefault("OPENAI_API_KEY", ""),
  },

  // Gemini (for File Search)
  gemini: {
    apiKey: (() => {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
      if (!key)
        throw new Error(
          "❌ Missing required environment variable: GEMINI_API_KEY or GOOGLE_AI_API_KEY",
        )
      return key
    })(),
  },

  // Hunter.io (Email Verification & Enrichment)
  hunter: {
    apiKey: getEnv("HUNTER_API_KEY"),
  },

  // Google Cloud / BigQuery Configuration
  google: {
    // Project ID for Google Cloud
    projectId: getEnvOrDefault("GOOGLE_CLOUD_PROJECT", "sendgrinda-leads"),

    // Credentials (priority order in bigquery-search.service.ts):
    // 1. GOOGLE_CREDENTIALS_GZIP_BASE64 (gzip + base64 - shortest)
    // 2. GOOGLE_CREDENTIALS_BASE64 (base64 only)
    // 3. GOOGLE_APPLICATION_CREDENTIALS (file path)
    // 4. Individual credentials (clientEmail + privateKey)
    // 5. gcloud CLI default credentials
    credentials: {
      gzipBase64: getEnvOrDefault("GOOGLE_CREDENTIALS_GZIP_BASE64", ""),
      base64: getEnvOrDefault("GOOGLE_CREDENTIALS_BASE64", ""),
      keyFilePath: getEnvOrDefault("GOOGLE_APPLICATION_CREDENTIALS", ""),
      clientEmail: getEnvOrDefault("BIGQUERY_CLIENT_EMAIL", ""),
      privateKey: getEnvOrDefault("BIGQUERY_PRIVATE_KEY", ""),
    },

    // OAuth (for Google Workspace integration)
    oauth: {
      clientId: getEnvOrDefault("GOOGLE_CLIENT_ID", ""),
      clientSecret: getEnvOrDefault("GOOGLE_CLIENT_SECRET", ""),
      redirectUri: getEnvOrDefault("GOOGLE_REDIRECT_URI", "http://localhost:5173/trial"),
    },
  },

  // External APIs
  apis: {
    jina: {
      apiKey: getEnv("JINA_API_KEY"),
    },
    hasdata: {
      apiKey: getEnv("HASDATA_API_KEY"),
    },
  },

  // Mastra
  mastra: {
    model: getEnvOrDefault("MASTRA_MODEL", "gpt-5-mini"),
    maxTokens: getEnvInt("MASTRA_MAX_TOKENS", 1000),
    temperature: Number.parseFloat(getEnvOrDefault("MASTRA_TEMPERATURE", "0.7")),
    rindaLeadPgUrl: getEnv("RINDA_LEAD_PG_URL"),
  },

  // Nylas (Email Integration)
  nylas: {
    apiKey: getEnvOrDefault("NYLAS_API_KEY", ""),
    apiUri: getEnvOrDefault("NYLAS_API_URI", "https://api.us.nylas.com"),
    clientId: getEnvOrDefault("NYLAS_CLIENT_ID", ""),
    redirectUri: getEnvOrDefault(
      "NYLAS_REDIRECT_URI",
      "http://localhost:3001/api/v1/nylas/callback",
    ),
  },

  // Unipile (Email Integration - Multi-provider)
  unipile: {
    apiKey: getEnvOrDefault("UNIPILE_API_KEY", ""),
    apiUrl: getEnvOrDefault("UNIPILE_API_URL", "https://api.unipile.com:13129"),
    redirectUri: getEnvOrDefault("UNIPILE_REDIRECT_URI", "http://localhost:5173/app/redirect"),
  },

  // Application URL (for webhooks)
  appUrl: getEnvOrDefault("APP_URL", "http://localhost:3001"),

  // Perplexity (AI-powered search)
  perplexity: {
    apiKey: getEnvOrDefault("PERPLEXITY_API_KEY", ""),
  },

  // Apollo.io (B2B Database)
  apollo: {
    apiKey: getEnvOrDefault("APOLLO_API_KEY", ""),
  },

  // Serper (Google Search API)
  serper: {
    apiKey: getEnvOrDefault("SERPER_API_KEY", ""),
  },

  // Google Places API
  googlePlaces: {
    apiKey: getEnvOrDefault("GOOGLE_PLACES_API_KEY", ""),
  },

  // Loops.so (Transactional Emails)
  loops: {
    apiKey: getEnvOrDefault("LOOPS_API_KEY", ""),
    // Transactional Email Template IDs
    transactionalIds: {
      onboardingComplete: getEnvOrDefault(
        "LOOPS_TRANSACTIONAL_ONBOARDING_COMPLETE",
        "cmjju1bio06vt0hzt094zh3a4",
      ),
    },
  },

  // CS (Customer Success) 설정
  cs: {
    managerName: getEnvOrDefault("CS_MANAGER_NAME", "Rinda Team"),
    kakaoLink: getEnvOrDefault("CS_KAKAO_LINK", ""),
    phoneNumber: getEnvOrDefault("CS_PHONE_NUMBER", ""),
  },
} as const

// Log configuration on startup (only in development)
if (isDevelopment) {
  const dbHost = config.database.url.split("@")[1]?.split("/")[0] || "configured"
  console.log(
    `\n[Config] env=${NODE_ENV} port=${config.port} db=${dbHost} mail=${config.sendgrid.fromEmail}\n`,
  )
}
