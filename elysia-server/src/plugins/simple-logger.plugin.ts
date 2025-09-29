import { Elysia } from 'elysia'

export const simpleLogger = new Elysia({ name: 'simple-logger' }).onRequest(({ request }) => {
  const timestamp = new Date().toISOString().split('T')[1]?.split('.')[0] ?? ''
  const method = request.method
  const url = new URL(request.url)
  const path = url.pathname

  // 간단한 한 줄 로그
  console.log(`[${timestamp}] ${method} ${path}`)
})
