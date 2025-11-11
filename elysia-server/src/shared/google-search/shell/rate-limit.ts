import PQueue from "p-queue"

/**
 * Global rate limiter for Google Search API
 * Prevents HTTP 429 rate limit errors when multiple requests run in parallel
 *
 * Configuration:
 * - concurrency: 1 (only 1 concurrent request at a time)
 * - intervalCap: 10 (max 10 requests per interval)
 * - interval: 1000ms (1 second interval)
 * - carryoverConcurrencyCount: true (carry over pending requests)
 */
export const googleSearchQueue = new PQueue({
  concurrency: 1,
  intervalCap: 10,
  interval: 1000,
  carryoverConcurrencyCount: true,
})

/**
 * Get current queue statistics
 */
export function getQueueStats() {
  return {
    size: googleSearchQueue.size,
    pending: googleSearchQueue.pending,
    isPaused: googleSearchQueue.isPaused,
  }
}
