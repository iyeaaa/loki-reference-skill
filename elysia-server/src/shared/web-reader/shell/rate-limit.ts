import PQueue from "p-queue"

/**
 * Global rate limiter for Web Reader API (Jina Reader)
 * Prevents HTTP 429 rate limit errors when multiple requests run in parallel
 *
 * Configuration:
 * - concurrency: 2 (max 2 concurrent requests at a time)
 * - intervalCap: 20 (max 20 requests per interval)
 * - interval: 1000ms (1 second interval)
 * - carryoverConcurrencyCount: true (carry over pending requests)
 */
export const webReaderQueue = new PQueue({
  concurrency: 2,
  intervalCap: 20,
  interval: 1000,
  carryoverConcurrencyCount: true,
})

/**
 * Get current queue statistics
 */
export function getQueueStats() {
  return {
    size: webReaderQueue.size,
    pending: webReaderQueue.pending,
    isPaused: webReaderQueue.isPaused,
  }
}
