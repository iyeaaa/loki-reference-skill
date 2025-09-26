import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { migrateDatabase } from './db/migrate'
import { config } from './config'

// Import routes
import { healthRoutes } from './routes/health.routes'
import { emailRoutes } from './routes/email.routes'
import { webhookRoutes } from './routes/webhook.routes'
import { postRoutes } from './routes/post.routes'

// Initialize database
migrateDatabase().catch(console.error)

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'Bulletin Board API',
        version: '1.0.0',
        description: 'Simple CRUD API for bulletin board'
      }
    }
  }))
  .get('/', () => 'Bulletin Board API')

  // Register routes
  .use(healthRoutes)
  .use(emailRoutes)
  .use(webhookRoutes)
  .use(postRoutes)

  .listen(config.port)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)