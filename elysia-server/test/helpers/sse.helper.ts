/**
 * Server-Sent Events (SSE) Helper for Testing
 *
 * Utilities for parsing and handling SSE responses from the API
 */

export interface SSEEvent {
  type: string
  [key: string]: any
}

/**
 * Parse SSE response from a fetch Response object
 *
 * @param response - Fetch Response object containing SSE stream
 * @returns The result data from the completion event, or undefined if not found
 */
export async function parseSSEResponse(response: Response): Promise<any> {
  const body = await response.text()

  // Decode the numeric object if present (workaround for Elysia serialization issue)
  // This happens because Elysia serializes ReadableStream before it reaches the client
  let actualBody = body
  if (body.startsWith('data: {"0":')) {
    // Extract all events and reconstruct them from numeric byte representation
    const matches = body.match(/data: ({[^}]*?})\n\n/gs)
    if (matches) {
      actualBody = matches
        .map((match) => {
          const jsonStr = match.replace(/^data: /, '').replace(/\n\n$/, '')
          const numObj = JSON.parse(jsonStr)
          const bytes = Object.values(numObj) as number[]
          return String.fromCharCode(...bytes)
        })
        .join('')
    }
  }

  // Parse SSE format: each event is "data: {json}\n\n"
  const events = actualBody
    .split("\n\n")
    .filter((chunk) => chunk.trim().startsWith("data: "))
    .map((chunk) => {
      try {
        // Remove "data: " prefix and parse JSON
        const jsonStr = chunk.replace(/^data: /, "").trim()
        return JSON.parse(jsonStr) as SSEEvent
      } catch (error) {
        console.error("Failed to parse SSE event:", chunk.substring(0, 100))
        return null
      }
    })
    .filter((event): event is SSEEvent => event !== null)

  // Find the completion event (type: "complete")
  const completeEvent = events.find((event) => event.type === "complete")

  return completeEvent?.result
}

/**
 * Parse all SSE events from a response (not just the completion event)
 *
 * @param response - Fetch Response object containing SSE stream
 * @returns Array of all parsed SSE events
 */
export async function parseAllSSEEvents(response: Response): Promise<SSEEvent[]> {
  const body = await response.text()

  // Decode the numeric object if present (workaround for Elysia serialization issue)
  let actualBody = body
  if (body.startsWith('data: {"0":')) {
    const matches = body.match(/data: ({[^}]*?})\n\n/gs)
    if (matches) {
      actualBody = matches
        .map((match) => {
          const jsonStr = match.replace(/^data: /, '').replace(/\n\n$/, '')
          const numObj = JSON.parse(jsonStr)
          const bytes = Object.values(numObj) as number[]
          return String.fromCharCode(...bytes)
        })
        .join('')
    }
  }

  return actualBody
    .split("\n\n")
    .filter((chunk) => chunk.trim().startsWith("data: "))
    .map((chunk) => {
      try {
        const jsonStr = chunk.replace(/^data: /, "").trim()
        return JSON.parse(jsonStr) as SSEEvent
      } catch (error) {
        console.error("Failed to parse SSE event:", chunk.substring(0, 100))
        return null
      }
    })
    .filter((event): event is SSEEvent => event !== null)
}

/**
 * Extract progress events from SSE stream
 *
 * @param response - Fetch Response object containing SSE stream
 * @returns Array of progress events with their data
 */
export async function extractProgressEvents(response: Response): Promise<SSEEvent[]> {
  const events = await parseAllSSEEvents(response)
  return events.filter((event) => event.type === "progress")
}

/**
 * Extract error events from SSE stream
 *
 * @param response - Fetch Response object containing SSE stream
 * @returns Array of error events with their data
 */
export async function extractErrorEvents(response: Response): Promise<SSEEvent[]> {
  const events = await parseAllSSEEvents(response)
  return events.filter((event) => event.type === "error")
}
