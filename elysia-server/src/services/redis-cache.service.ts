import Redis from "ioredis"
import { config } from "../config"
import logger from "../utils/logger"

type RedisCacheOptions = {
  enabled: boolean
  keyPrefix: string
  ttlSeconds: number
  timeoutMs: number
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })

  const guarded = promise.catch(() => null as T | null)
  const result = await Promise.race([guarded, timeout])
  if (timer) clearTimeout(timer)
  return result as T | null
}

function createRedisForCache(): Redis {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    enableReadyCheck: false,
    lazyConnect: true,
    // Fast failure/fallback
    maxRetriesPerRequest: 1,
    connectTimeout: 800,
    retryStrategy: () => null,
  })
}

const redis = createRedisForCache()
let redisWarnedOnce = false

/**
 * Generic Redis cache service that can be used across the application
 *
 * @example
 * const cache = new RedisCache({
 *   enabled: true,
 *   keyPrefix: "my-feature:v1:",
 *   ttlSeconds: 3600,
 *   timeoutMs: 250
 * })
 *
 * // Set a value
 * await cache.set("user:123", { name: "John", email: "john@example.com" })
 *
 * // Get a value
 * const user = await cache.get<User>("user:123")
 *
 * // Delete a value
 * await cache.del("user:123")
 *
 * // Check if a key exists
 * const exists = await cache.exists("user:123")
 */
export class RedisCache {
  private readonly options: RedisCacheOptions

  constructor(options: RedisCacheOptions) {
    this.options = options
  }

  static fromConfig(cacheConfig: {
    enabled: boolean
    keyPrefix: string
    ttlMs: number
    timeoutMs: number
  }): RedisCache {
    const ttlSeconds = Math.max(1, Math.round(cacheConfig.ttlMs / 1000))

    return new RedisCache({
      enabled: cacheConfig.enabled,
      keyPrefix: cacheConfig.keyPrefix,
      ttlSeconds,
      timeoutMs: cacheConfig.timeoutMs,
    })
  }

  isEnabled(): boolean {
    return this.options.enabled
  }

  private makeKey(key: string): string {
    return `${this.options.keyPrefix}${key}`
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.options.enabled) return null

    const startedAt = Date.now()
    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)

      const fullKey = this.makeKey(key)
      const value = await withTimeout(redis.get(fullKey), this.options.timeoutMs)
      if (!value) {
        logger.debug(
          {
            key,
            ms: Date.now() - startedAt,
            prefix: this.options.keyPrefix,
          },
          "[redis-cache] miss",
        )
        return null
      }

      const parsed = JSON.parse(value) as T
      logger.debug(
        {
          key,
          ms: Date.now() - startedAt,
          prefix: this.options.keyPrefix,
        },
        "[redis-cache] hit",
      )
      return parsed
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        logger.warn(
          `[redis-cache] Redis cache unavailable, operating without cache (error=${String(error)})`,
        )
      }
      return null
    }
  }

  /**
   * Set a value in cache with optional TTL override
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.options.enabled) return

    const startedAt = Date.now()
    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)

      const fullKey = this.makeKey(key)
      const payload = JSON.stringify(value)
      const ttl = ttlSeconds ?? this.options.ttlSeconds

      await withTimeout(redis.setex(fullKey, ttl, payload), this.options.timeoutMs)

      logger.debug(
        {
          key,
          ms: Date.now() - startedAt,
          ttlSeconds: ttl,
          prefix: this.options.keyPrefix,
        },
        "[redis-cache] set",
      )
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        logger.warn(
          `[redis-cache] Redis cache unavailable, operating without cache (error=${String(error)})`,
        )
      }
    }
  }

  /**
   * Delete a value from cache
   */
  async del(key: string): Promise<void> {
    if (!this.options.enabled) return

    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)
      const fullKey = this.makeKey(key)
      await withTimeout(redis.del(fullKey), this.options.timeoutMs)
      logger.debug({ key, prefix: this.options.keyPrefix }, "[redis-cache] del")
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        logger.warn(
          `[redis-cache] Redis cache unavailable, operating without cache (error=${String(error)})`,
        )
      }
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.options.enabled) return false

    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)
      const fullKey = this.makeKey(key)
      const result = await withTimeout(redis.exists(fullKey), this.options.timeoutMs)
      return result === 1
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        logger.warn(
          `[redis-cache] Redis cache unavailable, operating without cache (error=${String(error)})`,
        )
      }
      return false
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>()
    if (!this.options.enabled || keys.length === 0) return result

    const startedAt = Date.now()
    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)

      const fullKeys = keys.map((k) => this.makeKey(k))
      const values = await withTimeout(redis.mget(...fullKeys), this.options.timeoutMs)
      if (!values) return result

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const raw = values[i]
        if (!key || !raw) continue
        try {
          const parsed = JSON.parse(raw) as T
          result.set(key, parsed)
        } catch {
          // ignore parse errors
        }
      }

      logger.debug(
        {
          keys: keys.length,
          hits: result.size,
          ms: Date.now() - startedAt,
          prefix: this.options.keyPrefix,
        },
        "[redis-cache] mget",
      )
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        logger.warn(
          `[redis-cache] Redis cache unavailable, operating without cache (error=${String(error)})`,
        )
      }
    }

    return result
  }

  /**
   * Set multiple values in cache
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.options.enabled || entries.length === 0) return

    const startedAt = Date.now()
    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)

      const pipeline = redis.pipeline()
      for (const entry of entries) {
        const fullKey = this.makeKey(entry.key)
        const payload = JSON.stringify(entry.value)
        const ttl = entry.ttl ?? this.options.ttlSeconds
        pipeline.setex(fullKey, ttl, payload)
      }

      await withTimeout(pipeline.exec(), this.options.timeoutMs)

      logger.debug(
        {
          entries: entries.length,
          ms: Date.now() - startedAt,
          prefix: this.options.keyPrefix,
        },
        "[redis-cache] mset",
      )
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        logger.warn(
          `[redis-cache] Redis cache unavailable, operating without cache (error=${String(error)})`,
        )
      }
    }
  }

  /**
   * Get or compute a value - if not in cache, compute it and cache it
   */
  async getOrSet<T>(key: string, compute: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await compute()
    await this.set(key, value, ttlSeconds)
    return value
  }
}

// Simple hash function for generating cache keys
export function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}
