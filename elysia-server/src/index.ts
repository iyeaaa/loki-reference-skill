import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { config } from './config'
import { migrateDatabase } from './db/migrate'
import { errorHandler } from './plugins/error-handler.plugin'
import { responseTransformer } from './plugins/response-transformer.plugin'
import { simpleLogger } from './plugins/simple-logger.plugin'
import { authRoutes } from './routes/auth.routes'
import { departmentsRoutes } from './routes/departments.routes'
import { emailRoutes } from './routes/email.routes'
// Import routes
import { healthRoutes } from './routes/health.routes'
import { postRoutes } from './routes/post.routes'
import { userRoutes } from './routes/users.routes'
import { webhookRoutes } from './routes/webhook.routes'

// Initialize database
migrateDatabase().catch(console.error)

const app = new Elysia()
  .use(simpleLogger) // Apply logger first
  .onError(({ error }) => {
    console.error('Application Error:', error)
    throw error
  })
  .use(errorHandler) // Apply global error handler
  .use(responseTransformer) // Apply response transformer
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Bulletin Board API',
          version: '1.0.0',
          description: 'Simple CRUD API for bulletin board',
        },
      },
    }),
  )
  .get('/', () => ({ message: 'Bulletin Board API', version: '1.0.0' }))

  // Register routes
  .use(healthRoutes)
  .use(emailRoutes)
  .use(webhookRoutes)
  .use(postRoutes)
  .use(authRoutes)
  .use(departmentsRoutes)
  .use(userRoutes)

  .listen(config.port)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
