import { Memory } from "@mastra/memory"

/**
 * Shared memory instance for Mastra agents
 * Uses in-memory storage for development/testing
 * Shell layer - handles I/O and orchestration
 */

/**
 * Shared memory instance configured with in-memory storage
 * This is suitable for development and testing environments
 * For production, consider using a persistent storage provider
 */
export const memory = new Memory({
  options: {
    lastMessages: 20,
  },
})
