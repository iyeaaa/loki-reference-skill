import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config } from "./config"
import { migrateDatabase } from "./db/migrate"
import { errorHandler } from "./plugins/error-handler.plugin"
import { responseTransformer } from "./plugins/response-transformer.plugin"
import { simpleLogger } from "./plugins/simple-logger.plugin"
import { activityLogRoutes } from "./routes/activity-logs.routes"
import { aiRoutes } from "./routes/ai.routes"
import { authRoutes } from "./routes/auth.routes"
import { adminCustomerGroupRoutes, customerGroupRoutes } from "./routes/customer-groups.routes"
import { departmentsRoutes } from "./routes/departments.routes"
import { adminEmailAccountRoutes, emailAccountRoutes } from "./routes/email-accounts.routes"
import { adminEmailTemplateRoutes, emailTemplateRoutes } from "./routes/email-templates.routes"
import { adminEmailRoutes, emailRoutes } from "./routes/emails.routes"
// Import routes
import { healthRoutes } from "./routes/health.routes"
import { adminLeadRoutes, leadRoutes } from "./routes/leads.routes"
import { adminSequenceRoutes, sequenceRoutes } from "./routes/sequences.routes"
import { adminUserRoutes, userRoutes } from "./routes/users.routes"
import { webhookRoutes } from "./routes/webhook.routes"
import { workflowEmailRoutes } from "./routes/workflow-emails.routes"
import { workflowExecutionRoutes } from "./routes/workflow-execution.routes"
import { adminWorkspaceRoutes, workspaceRoutes } from "./routes/workspaces.routes"
import { startEmailSequenceWorker } from "./workers/email-sequence-worker"
import { startScheduledEmailWorker } from "./workers/scheduled-email-worker"
import { startWorkflowExecutionWorker } from "./workers/workflow-execution-worker"

// Initialize database
migrateDatabase().catch(console.error)

// Start workers
startEmailSequenceWorker() // 구 기능 (sequence_steps)
startWorkflowExecutionWorker() // 신 기능 (workflow 기반)

// Start scheduled email worker
startScheduledEmailWorker()

const app = new Elysia()
  .use(simpleLogger) // Apply logger first
  .onError(({ error }) => {
    console.error("Application Error:", error)
    throw error
  })
  .use(errorHandler) // Apply global error handler
  .use(responseTransformer) // Apply response transformer
  .use(
    cors({
      origin: true, // Allow all origins in development
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "SendGrid Email Service API",
          version: "2.1.0",
          description:
            "SendGrid 기반 이메일 관리 시스템 - 이메일 송수신, AI 자동 답장, 주소록 관리, 사용자 인증",
        },
      },
    }),
  )
  .get("/", () => ({ message: "SendGrid Email Service API", version: "2.1.0" }))

  // Register routes
  .use(healthRoutes)
  .use(webhookRoutes)
  .use(aiRoutes)
  .use(authRoutes)
  .use(departmentsRoutes)
  .use(userRoutes)
  .use(adminUserRoutes)
  .use(workspaceRoutes)
  .use(adminWorkspaceRoutes)
  .use(customerGroupRoutes)
  .use(adminCustomerGroupRoutes)
  .use(emailAccountRoutes)
  .use(adminEmailAccountRoutes)
  .use(emailTemplateRoutes)
  .use(adminEmailTemplateRoutes)
  .use(emailRoutes)
  .use(adminEmailRoutes)
  .use(leadRoutes)
  .use(adminLeadRoutes)
  .use(sequenceRoutes)
  .use(adminSequenceRoutes)
  .use(workflowEmailRoutes)
  .use(workflowExecutionRoutes)
  .use(activityLogRoutes)

  .listen(config.port)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)
