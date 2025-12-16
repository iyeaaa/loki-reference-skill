import Redis from "ioredis"
import { config } from "../../config"
import logger from "../../utils/logger"

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
    const delay = Math.min(times * 50, 2000)
    return delay
  },
})

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected successfully")
})

redisConnection.on("error", (err) => {
  logger.error({ err }, "[Redis] Connection error")
})

redisConnection.on("close", () => {
  logger.warn("[Redis] Connection closed")
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
      const delay = Math.min(times * 50, 2000)
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
