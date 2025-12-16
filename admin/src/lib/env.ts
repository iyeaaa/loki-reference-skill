/**
 * Centralized environment variable validation using Zod
 *
 * This module validates all environment variables at application startup
 * and provides type-safe access to them throughout the application.
 *
 * Usage:
 *   import { env } from '@/lib/env'
 *   console.log(env.VITE_API_URL)
 */

import { z } from "zod"

/**
 * Schema for client-side environment variables
 * All variables prefixed with VITE_ are exposed to the client
 */
const envSchema = z.object({
  /**
   * API base URL for backend requests
   * - Development: Leave empty to use Vite proxy (recommended)
   * - Production: Set to your API domain (e.g., https://api.your-domain.com)
   */
  VITE_API_URL: z.string().default(""),

  /**
   * Node environment (automatically set by Vite)
   */
  MODE: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Development mode flag (automatically set by Vite)
   */
  DEV: z.boolean().default(false),

  /**
   * Production mode flag (automatically set by Vite)
   */
  PROD: z.boolean().default(false),
})

/**
 * Type for the validated environment
 */
export type Env = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables
 */
function parseEnv(): Env {
  // In Vite, environment variables are accessed via import.meta.env
  const rawEnv = {
    VITE_API_URL: import.meta.env.VITE_API_URL ?? "",
    MODE: import.meta.env.MODE ?? "development",
    DEV: import.meta.env.DEV ?? false,
    PROD: import.meta.env.PROD ?? false,
  }

  const result = envSchema.safeParse(rawEnv)

  if (!result.success) {
    console.error("❌ Invalid environment variables:")
    console.error(result.error.format())

    // In development, throw an error to make issues visible
    if (import.meta.env.DEV) {
      throw new Error(`Invalid environment variables: ${result.error.message}`)
    }

    // In production, log error but continue with defaults
    console.warn("⚠️ Using default values for invalid environment variables")
    return envSchema.parse({})
  }

  return result.data
}

/**
 * Validated environment variables
 * Access environment variables through this object for type safety
 */
export const env = parseEnv()

/**
 * Helper to check if running in development mode
 */
export const isDevelopment = env.DEV || env.MODE === "development"

/**
 * Helper to check if running in production mode
 */
export const isProduction = env.PROD || env.MODE === "production"

/**
 * API base URL - use this for all API requests
 * Defaults to empty string to use Vite proxy in development
 */
export const API_BASE_URL = env.VITE_API_URL
