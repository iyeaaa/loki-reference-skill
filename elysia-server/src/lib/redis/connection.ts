import Redis from "ioredis"
import { config } from "../../config"
import logger from "../../utils/logger"

/**
 * Redis 연결 최대 재시도 횟수
 * 이 횟수를 초과하면 재시도를 멈춥니다
 */
const MAX_RETRY_ATTEMPTS = 5

/**
 * Redis connection for BullMQ
 * BullMQ requires maxRetriesPerRequest: null
 */
export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    // 최대 재시도 횟수를 초과하면 null을 반환하여 재시도 중단
    if (times > MAX_RETRY_ATTEMPTS) {
      logger.error(
        `[Redis] Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded. Stopping reconnection attempts.`,
      )
      return null // null을 반환하면 재시도 중단
    }
    const delay = Math.min(times * 50, 2000)
    logger.warn(`[Redis] Retry attempt ${times}/${MAX_RETRY_ATTEMPTS}, waiting ${delay}ms...`)
    return delay
  },
})

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected successfully")
})

redisConnection.on("error", (err) => {
  // ECONNREFUSED 에러는 warn 레벨로 낮춤 (Redis가 없는 환경에서 정상)
  if (err.message?.includes("ECONNREFUSED")) {
    logger.warn({ message: err.message }, "[Redis] Connection refused - Redis may not be available")
  } else {
    logger.error({ err }, "[Redis] Connection error")
  }
})

redisConnection.on("close", () => {
  logger.info("[Redis] Connection closed")
})

/**
 * Create a new Redis connection instance
 * Use this for BullMQ workers (they need separate connections)
 */
export function createRedisConnection(): Redis {
  return new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      // 최대 재시도 횟수를 초과하면 null을 반환하여 재시도 중단
      if (times > MAX_RETRY_ATTEMPTS) {
        logger.error(
          `[Redis] Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded. Stopping reconnection attempts.`,
        )
        return null
      }
      const delay = Math.min(times * 50, 2000)
      logger.warn(`[Redis] Retry attempt ${times}/${MAX_RETRY_ATTEMPTS}, waiting ${delay}ms...`)
      return delay
    },
  })
}

/**
 * Close all Redis connections gracefully
 */
export async function closeRedisConnections(): Promise<void> {
  await redisConnection.quit()
  logger.info("[Redis] Connections closed")
}

export default redisConnection
