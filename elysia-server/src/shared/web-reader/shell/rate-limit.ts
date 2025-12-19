import PQueue from "p-queue"

/**
 * Global rate limiter for Web Reader API (Jina Reader)
 * Prevents HTTP 429 rate limit errors when multiple requests run in parallel
 *
 * Configuration (conservative settings to avoid 429):
 * - concurrency: 1 (max 1 concurrent request - sequential processing)
 * - intervalCap: 3 (max 3 requests per interval)
 * - interval: 1000ms (1 second interval)
 * - carryoverConcurrencyCount: true (carry over pending requests)
 *
 * This results in ~3 requests/second = 180 requests/minute
 * Jina AI free tier allows ~200 requests/minute
 */
export const webReaderQueue = new PQueue({
  concurrency: 1,
  intervalCap: 3,
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
