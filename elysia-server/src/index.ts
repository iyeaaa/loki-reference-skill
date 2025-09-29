import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { Elysia } from 'elysia'
import { config } from './config'
import { migrateDatabase } from './db/migrate'
import { errorHandler } from './plugins/error-handler.plugin'
import { responseTransformer } from './plugins/response-transformer.plugin'
import { simpleLogger } from './plugins/simple-logger.plugin'
import { addressBookRoutes } from './routes/address-book.routes'
import { aiRoutes } from './routes/ai.routes'
import { authRoutes } from './routes/auth.routes'
import { departmentsRoutes } from './routes/departments.routes'
import { emailRoutes } from './routes/email.routes'
// Import routes
import { healthRoutes } from './routes/health.routes'
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
  .use(cors()) // 에러는 뜨지만 문제 없음
  .use(
    swagger({
      documentation: {
        info: {
          title: 'SendGrid Email Service API',
          version: '2.1.0',
          description:
            'SendGrid 기반 이메일 관리 시스템 - 이메일 송수신, AI 자동 답장, 주소록 관리, 사용자 인증',
        },
      },
    }),
  )
  .get('/', () => ({ message: 'SendGrid Email Service API', version: '2.1.0' }))

  // Register routes
  .use(healthRoutes)
  .use(emailRoutes)
  .use(webhookRoutes)
  .use(aiRoutes)
  .use(addressBookRoutes)
  .use(authRoutes)
  .use(departmentsRoutes)
  .use(userRoutes)

  .listen(config.port)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
