/**
 * Web Extraction Redis Service
 * 웹 추출 결과를 Redis에 저장하여 메모리 사용량 최적화
 * 각 결과는 처리 즉시 Redis에 저장되고 메모리에서 해제됨
 */

import Redis from "ioredis"
import { config } from "../config"
import type { CompanyRecord } from "../types/web-extraction.types"
import logger from "../utils/logger"

// Redis 연결 설정
const REDIS_KEY_PREFIX = "webex:results:"
const REDIS_TTL_SECONDS = 60 * 60 // 1시간 (다운로드 후 자동 삭제)
const REDIS_TIMEOUT_MS = 5000 // Redis 작업 타임아웃

let redis: Redis | null = null
let redisConnectionFailed = false

/**
 * Redis 연결 초기화 (지연 연결)
 */
function getRedis(): Redis | null {
  if (redisConnectionFailed) {
    return null
  }

  if (!redis) {
    try {
      redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        enableReadyCheck: false,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        retryStrategy: () => null, // 재시도 안 함 - 빠른 fallback
      })

      redis.on("error", (err) => {
        logger.warn(
          { error: err.message },
          "[WebExtraction Redis] Connection error, using memory fallback",
        )
        redisConnectionFailed = true
        redis = null
      })
    } catch (error) {
      logger.warn({ error }, "[WebExtraction Redis] Failed to create Redis client")
      redisConnectionFailed = true
      return null
    }
  }

  return redis
}

/**
 * 타임아웃 래퍼
 */
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

/**
 * 결과 키 생성
 */
function makeResultKey(jobId: string): string {
  return `${REDIS_KEY_PREFIX}${jobId}`
}

/**
 * 단일 결과 추가 (처리 즉시 호출)
 * 메모리에 쌓지 않고 바로 Redis에 저장
 */
export async function addResult(jobId: string, result: CompanyRecord): Promise<boolean> {
  const redisClient = getRedis()

  if (!redisClient) {
    return false // Redis 사용 불가 - fallback 필요
  }

  try {
    await withTimeout(redisClient.connect(), REDIS_TIMEOUT_MS)

    const key = makeResultKey(jobId)
    const payload = JSON.stringify(result)

    // 리스트에 결과 추가
    await withTimeout(redisClient.rpush(key, payload), REDIS_TIMEOUT_MS)

    // TTL 설정 (첫 추가 시에만 설정되도록)
    await withTimeout(redisClient.expire(key, REDIS_TTL_SECONDS), REDIS_TIMEOUT_MS)

    return true
  } catch (error) {
    logger.debug({ error, jobId }, "[WebExtraction Redis] Failed to add result")
    return false
  }
}

/**
 * 모든 결과 조회 (다운로드 시 호출)
 */
export async function getAllResults(jobId: string): Promise<CompanyRecord[] | null> {
  const redisClient = getRedis()

  if (!redisClient) {
    return null // Redis 사용 불가
  }

  try {
    await withTimeout(redisClient.connect(), REDIS_TIMEOUT_MS)

    const key = makeResultKey(jobId)

    // 모든 결과 조회
    const rawResults = await withTimeout(
      redisClient.lrange(key, 0, -1),
      REDIS_TIMEOUT_MS * 2, // 대량 조회는 타임아웃 2배
    )

    if (!rawResults || rawResults.length === 0) {
      return null
    }

    // JSON 파싱
    const results: CompanyRecord[] = []
    for (const raw of rawResults) {
      try {
        results.push(JSON.parse(raw))
      } catch {
        // 파싱 실패한 항목은 무시
      }
    }

    return results
  } catch (error) {
    logger.error({ error, jobId }, "[WebExtraction Redis] Failed to get results")
    return null
  }
}

/**
 * 결과 수 조회
 */
export async function getResultCount(jobId: string): Promise<number> {
  const redisClient = getRedis()

  if (!redisClient) {
    return 0
  }

  try {
    await withTimeout(redisClient.connect(), REDIS_TIMEOUT_MS)

    const key = makeResultKey(jobId)
    const count = await withTimeout(redisClient.llen(key), REDIS_TIMEOUT_MS)

    return count ?? 0
  } catch (error) {
    logger.debug({ error, jobId }, "[WebExtraction Redis] Failed to get result count")
    return 0
  }
}

/**
 * 결과 삭제 (다운로드 완료 후 또는 정리 시)
 */
export async function deleteResults(jobId: string): Promise<void> {
  const redisClient = getRedis()

  if (!redisClient) {
    return
  }

  try {
    await withTimeout(redisClient.connect(), REDIS_TIMEOUT_MS)

    const key = makeResultKey(jobId)
    await withTimeout(redisClient.del(key), REDIS_TIMEOUT_MS)

    logger.debug({ jobId }, "[WebExtraction Redis] Results deleted")
  } catch (error) {
    logger.debug({ error, jobId }, "[WebExtraction Redis] Failed to delete results")
  }
}

/**
 * TTL 연장 (다운로드 전 호출하여 유지)
 */
export async function extendTTL(
  jobId: string,
  ttlSeconds: number = REDIS_TTL_SECONDS,
): Promise<void> {
  const redisClient = getRedis()

  if (!redisClient) {
    return
  }

  try {
    await withTimeout(redisClient.connect(), REDIS_TIMEOUT_MS)

    const key = makeResultKey(jobId)
    await withTimeout(redisClient.expire(key, ttlSeconds), REDIS_TIMEOUT_MS)
  } catch (error) {
    logger.debug({ error, jobId }, "[WebExtraction Redis] Failed to extend TTL")
  }
}

/**
 * Redis 사용 가능 여부 확인
 */
export function isRedisAvailable(): boolean {
  return !redisConnectionFailed && getRedis() !== null
}

/**
 * 결과 일괄 추가 (fallback 시 메모리 배열을 Redis로 이동)
 */
export async function addResultsBulk(jobId: string, results: CompanyRecord[]): Promise<boolean> {
  const redisClient = getRedis()

  if (!redisClient || results.length === 0) {
    return false
  }

  try {
    await withTimeout(redisClient.connect(), REDIS_TIMEOUT_MS)

    const key = makeResultKey(jobId)
    const pipeline = redisClient.pipeline()

    // 파이프라인으로 일괄 추가
    for (const result of results) {
      pipeline.rpush(key, JSON.stringify(result))
    }

    // TTL 설정
    pipeline.expire(key, REDIS_TTL_SECONDS)

    await withTimeout(pipeline.exec(), REDIS_TIMEOUT_MS * 2)

    logger.info({ jobId, count: results.length }, "[WebExtraction Redis] Bulk results added")
    return true
  } catch (error) {
    logger.error({ error, jobId }, "[WebExtraction Redis] Failed to bulk add results")
    return false
  }
}
