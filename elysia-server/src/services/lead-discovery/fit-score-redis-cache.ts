import Redis from "ioredis"
import { config } from "../../config"
import { leadDiscoveryLogger } from "./logger"

export type FitScoreCacheValue = {
  score: number
  reason?: string
}

type FitScoreRedisCacheOptions = {
  enabled: boolean
  keyPrefix: string
  ttlSeconds: number
  timeoutMs: number
  mgetChunkSize: number
  setChunkSize: number
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function parsePositiveFloat(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "")
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items]
  const result: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize))
  }
  return result
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
  // BullMQ용 redisConnection은 maxRetriesPerRequest=null이라 캐시 조회 시 “무한 대기” 위험이 있어,
  // 캐시 전용 커넥션은 빠르게 실패하도록 별도 설정합니다.
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    enableReadyCheck: false,
    lazyConnect: true,
    // 빠른 실패/폴백 목적
    maxRetriesPerRequest: 1,
    connectTimeout: 800,
    retryStrategy: () => null,
  })
}

const redis = createRedisForCache()
let redisWarnedOnce = false

export class FitScoreRedisCache {
  private readonly options: FitScoreRedisCacheOptions

  constructor(options: FitScoreRedisCacheOptions) {
    this.options = options
  }

  static fromEnv(): FitScoreRedisCache {
    const enabled =
      (process.env.LEAD_DISCOVERY_FIT_SCORE_REDIS_CACHE_ENABLED ?? "false").toLowerCase() === "true"

    const ttlMs = parsePositiveInt(
      process.env.LEAD_DISCOVERY_FIT_SCORE_CACHE_TTL_MS,
      6 * 60 * 60 * 1000,
    )
    const ttlSeconds = Math.max(1, Math.round(ttlMs / 1000))

    return new FitScoreRedisCache({
      enabled,
      keyPrefix:
        process.env.LEAD_DISCOVERY_FIT_SCORE_REDIS_CACHE_PREFIX ?? "lead_discovery:fit_score:v1:",
      ttlSeconds,
      timeoutMs: parsePositiveInt(process.env.LEAD_DISCOVERY_FIT_SCORE_REDIS_TIMEOUT_MS, 250),
      mgetChunkSize: parsePositiveInt(process.env.LEAD_DISCOVERY_FIT_SCORE_REDIS_MGET_CHUNK, 500),
      setChunkSize: parsePositiveInt(process.env.LEAD_DISCOVERY_FIT_SCORE_REDIS_SET_CHUNK, 500),
    })
  }

  isEnabled(): boolean {
    return this.options.enabled
  }

  private makeKey(keyHash: string): string {
    return `${this.options.keyPrefix}${keyHash}`
  }

  async getMany(keyHashes: string[]): Promise<Map<string, FitScoreCacheValue>> {
    const result = new Map<string, FitScoreCacheValue>()
    if (!this.options.enabled) return result
    if (keyHashes.length === 0) return result

    const startedAt = Date.now()
    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)

      const chunks = chunkArray(keyHashes, this.options.mgetChunkSize)
      for (const chunk of chunks) {
        const keys = chunk.map((h) => this.makeKey(h))
        const values = await withTimeout(redis.mget(...keys), this.options.timeoutMs)
        if (!values) continue

        for (let i = 0; i < chunk.length; i++) {
          const keyHash = chunk[i]
          if (!keyHash) continue
          const raw = values[i]
          if (!raw) continue
          try {
            const parsed = JSON.parse(raw) as FitScoreCacheValue
            if (typeof parsed?.score === "number") {
              result.set(keyHash, { score: parsed.score, reason: parsed.reason })
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      leadDiscoveryLogger.debug("[fit-score-cache] redis mget", {
        keys: keyHashes.length,
        hits: result.size,
        ms: Date.now() - startedAt,
      })
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        leadDiscoveryLogger.warn(
          `[fit-score-cache] Redis cache unavailable, falling back to memory cache (error=${String(error)})`,
        )
      }
    }

    return result
  }

  async setMany(entries: Array<{ keyHash: string; value: FitScoreCacheValue }>): Promise<void> {
    if (!this.options.enabled) return
    if (entries.length === 0) return

    const startedAt = Date.now()
    try {
      await withTimeout(redis.connect(), this.options.timeoutMs)

      const chunks = chunkArray(entries, this.options.setChunkSize)
      for (const chunk of chunks) {
        const pipeline = redis.pipeline()
        for (const entry of chunk) {
          const key = this.makeKey(entry.keyHash)
          const payload = JSON.stringify(entry.value)
          pipeline.setex(key, this.options.ttlSeconds, payload)
        }

        await withTimeout(pipeline.exec(), this.options.timeoutMs)
      }

      leadDiscoveryLogger.debug("[fit-score-cache] redis set", {
        entries: entries.length,
        ms: Date.now() - startedAt,
        ttlSeconds: this.options.ttlSeconds,
      })
    } catch (error) {
      if (!redisWarnedOnce) {
        redisWarnedOnce = true
        leadDiscoveryLogger.warn(
          `[fit-score-cache] Redis cache unavailable, falling back to memory cache (error=${String(error)})`,
        )
      }
    }
  }
}

export function getDefaultFitScoreRedisCache(): FitScoreRedisCache {
  return FitScoreRedisCache.fromEnv()
}

export function estimateRedisTtlHoursFromEnv(): number {
  const ttlMs = parsePositiveFloat(
    process.env.LEAD_DISCOVERY_FIT_SCORE_CACHE_TTL_MS,
    6 * 60 * 60 * 1000,
  )
  return Math.max(1, ttlMs / (60 * 60 * 1000))
}
