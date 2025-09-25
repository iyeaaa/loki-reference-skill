import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'Elysia API Server',
        version: '1.0.0'
      }
    }
  }))
  .get('/', () => 'Hello Elysia!')
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(3001)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)