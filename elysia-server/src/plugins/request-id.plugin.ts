import { randomUUID } from "node:crypto"
import { Elysia } from "elysia"

/**
 * Request ID plugin
 * Adds a unique request ID to each request for tracing
 */
export const requestId = new Elysia({ name: "request-id" }).derive(({ headers, set }) => {
  // Use existing request ID if provided, otherwise generate new one
  const reqId = (headers["x-request-id"] as string) || randomUUID()

  // Add to response headers for client-side debugging
  set.headers["x-request-id"] = reqId

  return {
    requestId: reqId,
  }
})
