import { Elysia } from 'elysia'

export const loggerPlugin = new Elysia({ name: 'logger' })
  .derive(() => {
    return {
      startTime: Date.now(),
    }
  })
  .onBeforeHandle(({ request }) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
    const method = request.method
    const url = new URL(request.url)
    const path = url.pathname

    // Request logging
    console.log(`[${timestamp}] ${method} ${path}`)
  })
  .onAfterHandle(({ set, startTime }) => {
    const duration = Date.now() - startTime
    const status = set.status || 200

    // Response logging
    console.log(`  └─ ${status} (${duration}ms)`)
  })
  .onError(({ error }) => {
    // Error logging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log(`  └─ ERROR: ${errorMessage}`)
  })
