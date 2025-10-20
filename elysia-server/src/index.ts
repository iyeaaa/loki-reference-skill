import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config, isDevelopment } from "./config"
import { errorHandler } from "./plugins/error-handler.plugin"
import { httpLogger } from "./plugins/http-logger.plugin"
import { rateLimit } from "./plugins/rate-limit.plugin"
import { requestId } from "./plugins/request-id.plugin"
import { responseTransformer } from "./plugins/response-transformer.plugin"
import { activityLogRoutes } from "./routes/activity-logs.routes"
import { aiRoutes } from "./routes/ai.routes"
import { authRoutes } from "./routes/auth.routes"
import { bulkEmailRoutes } from "./routes/bulk-email.routes"
import { adminCustomerGroupRoutes, customerGroupRoutes } from "./routes/customer-groups.routes"
import { departmentsRoutes } from "./routes/departments.routes"
import { adminEmailAccountRoutes, emailAccountRoutes } from "./routes/email-accounts.routes"
import { emailRepliesRoutes } from "./routes/email-replies.routes"
import { adminEmailTemplateRoutes, emailTemplateRoutes } from "./routes/email-templates.routes"
import { adminEmailRoutes, emailRoutes } from "./routes/emails.routes"
// Import routes
import { healthRoutes } from "./routes/health.routes"
import { leadImportRoutes } from "./routes/lead-import.routes"
import { adminLeadRoutes, leadRoutes } from "./routes/leads.routes"
import { adminSequenceRoutes, sequenceRoutes } from "./routes/sequences.routes"
import { adminUserRoutes, userRoutes } from "./routes/users.routes"
import { webhookRoutes } from "./routes/webhook.routes"
import { workflowEmailRoutes } from "./routes/workflow-emails.routes"
import { workflowExecutionRoutes } from "./routes/workflow-execution.routes"
import { adminWorkspaceRoutes, workspaceRoutes } from "./routes/workspaces.routes"
import logger from "./utils/logger"
import { startEmailSequenceWorker } from "./workers/email-sequence-worker"
import { startScheduledEmailWorker } from "./workers/scheduled-email-worker"
import { startWorkflowExecutionWorker } from "./workers/workflow-execution-worker"

// Start workers
if (!isDevelopment) {
  logger.info("Starting background workers (production mode)...")
  startEmailSequenceWorker() // 구 기능 (sequence_steps)
  startWorkflowExecutionWorker() // 신 기능 (workflow 기반)
  startScheduledEmailWorker()
  logger.info("✅ Background workers started")
} else {
  logger.info("⏸️  Background workers disabled in development mode")
}

const app = new Elysia()
  // Core plugins (order matters)
  // Ensure CORS runs first so even error responses include CORS headers
  .use(
    cors({
      origin: isDevelopment ? true : config.cors.allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Accept"],
      exposeHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
      maxAge: 86400, // 24 hours
    }),
  )
  .use(requestId) // Add request ID for tracing
  .use(httpLogger) // Logger

  // Security plugins
  .use(rateLimit) // Apply rate limiting to all routes
  .onBeforeHandle(({ set }) => {
    // Security headers
    set.headers["x-content-type-options"] = "nosniff"
    set.headers["x-frame-options"] = "DENY"
    set.headers["x-xss-protection"] = "1; mode=block"
    set.headers["referrer-policy"] = "strict-origin-when-cross-origin"

    if (!isDevelopment) {
      set.headers["strict-transport-security"] = "max-age=31536000; includeSubDomains"
    }
  })
  // Handle OPTIONS requests explicitly
  .options("*", ({ set }) => {
    set.status = 204
    return ""
  })
  .use(errorHandler) // Apply global error handler (after CORS so errors include CORS)
  .use(responseTransformer) // Apply response transformer
  .onError(({ error }) => {
    logger.error({ err: error }, "Application Error")
    throw error
  })
  .use(
    swagger({
      documentation: {
        info: {
          title: "SendGrid Email Service API",
          version: "2.1.0",
          description:
            "SendGrid 기반 이메일 관리 시스템 - 이메일 송수신, AI 자동 답장, 주소록 관리, 사용자 인증",
          contact: {
            name: "Grinda AI",
            email: "support@grinda.ai",
          },
        },
        servers: [
          {
            url: isDevelopment ? `http://localhost:${config.port}` : "https://api.grinda.ai",
            description: isDevelopment ? "Development" : "Production",
          },
        ],
        tags: [
          { name: "auth", description: "Authentication endpoints" },
          { name: "emails", description: "Email management" },
          { name: "workflows", description: "Workflow automation" },
          { name: "leads", description: "Lead management" },
          { name: "admin", description: "Admin-only endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "JWT token from /api/v1/auth/login",
            },
          },
        },
      },
      exclude: ["/health", "/health/ready", "/health/live"], // Exclude health checks from docs
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
  .use(bulkEmailRoutes)
  .use(emailRepliesRoutes)
  .use(leadRoutes)
  .use(adminLeadRoutes)
  .use(sequenceRoutes)
  .use(adminSequenceRoutes)
  .use(workflowEmailRoutes)
  .use(workflowExecutionRoutes)
  .use(activityLogRoutes)
  .use(leadImportRoutes)

  .listen(config.port)

logger.info(`🚀 Server ready at http://${app.server?.hostname}:${config.port}`)
