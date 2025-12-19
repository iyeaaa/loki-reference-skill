import { cors } from "@elysiajs/cors"
import { swagger } from "@elysiajs/swagger"
import { Elysia } from "elysia"
import { config, isDevelopment } from "./config"
import { activityLogger, autoActivityLogger } from "./plugins/activity-logger.plugin"
import { errorHandler } from "./plugins/error-handler.plugin"
import { httpLogger, isScannerRequest } from "./plugins/http-logger.plugin"
import { permissionGuard } from "./plugins/permission-guard.plugin"
import { rateLimit } from "./plugins/rate-limit.plugin"
import { requestId } from "./plugins/request-id.plugin"
import { responseTransformer } from "./plugins/response-transformer.plugin"
import { activityLogRoutes } from "./routes/activity-logs.routes"
import { aiRoutes } from "./routes/ai.routes"
import { authRoutes } from "./routes/auth.routes"
import { bigquerySearchRoutes } from "./routes/bigquery-search.routes"
import {
  billingCustomersRoutes,
  billingPlansRoutes,
  billingProductsRoutes,
  subscriptionsRoutes,
} from "./routes/billing.routes"
import { bulkEmailRoutes } from "./routes/bulk-email.routes"
import { bullmqTestRoutes } from "./routes/bullmq-test.routes"
import { chatbotRoutes } from "./routes/chatbot.routes"
import { adminCustomerGroupRoutes, customerGroupRoutes } from "./routes/customer-groups.routes"
import { dashboardRoutes } from "./routes/dashboard.routes"
import { departmentsRoutes } from "./routes/departments.routes"
import { adminEmailAccountRoutes, emailAccountRoutes } from "./routes/email-accounts.routes"
import { emailRepliesRoutes } from "./routes/email-replies.routes"
import { emailSignatureRoutes } from "./routes/email-signatures.routes"
import { adminEmailTemplateRoutes, emailTemplateRoutes } from "./routes/email-templates.routes"
import { adminEmailRoutes, emailRoutes } from "./routes/emails.routes"
import { geminiFileSearchRoutes } from "./routes/gemini-file-search.routes"
// Import routes
import { apiHealthRoute, healthRoutes } from "./routes/health.routes"
import {
  iamAuditLogsRoutes,
  iamMembersRoutes,
  iamMyPermissionsRoutes,
  iamPoliciesRoutes,
  iamRolesRoutes,
  iamTierBoundariesRoutes,
} from "./routes/iam.routes"
import { jobLogsRoutes } from "./routes/job-logs.routes"
import { leadDiscoveryRoutes } from "./routes/lead-discovery.routes"
import { leadEnrichmentRoutes } from "./routes/lead-enrichment.routes"
import { leadImportRoutes } from "./routes/lead-import.routes"
import { adminLeadRoutes, leadRoutes } from "./routes/leads.routes"
import { notificationRoutes } from "./routes/notification.routes"
import { nylasRoutes } from "./routes/nylas.routes"
import { onboardingRoutes } from "./routes/onboarding.routes"
import { openaiApiKeysRoutes } from "./routes/openai-api-keys.routes"
import { salesStrategyRoutes, workspaceSalesStrategyRoutes } from "./routes/sales-strategies.routes"
import { adminSequenceRoutes, sequenceRoutes } from "./routes/sequences.routes"
import { sseTestRoutes } from "./routes/sse-test.routes"
import { adminUserRoutes, userRoutes } from "./routes/users.routes"
import { webExtractionRoutes } from "./routes/web-extraction.routes"
import { webhookRoutes } from "./routes/webhook.routes"
import { websetRoutes } from "./routes/websets.routes"
import { workflowEmailRoutes } from "./routes/workflow-emails.routes"
import { workflowExecutionRoutes } from "./routes/workflow-execution.routes"
import { adminWorkspaceRoutes, workspaceRoutes } from "./routes/workspaces.routes"
import logger from "./utils/logger"
import { startEmailSequenceWorker } from "./workers/email-sequence-worker-v2"
import { startScheduledEmailWorker } from "./workers/scheduled-email-worker"
import { startWorkflowExecutionWorker } from "./workers/workflow-execution-worker"

// Start workers
if (!isDevelopment) {
  startEmailSequenceWorker()
  startWorkflowExecutionWorker()
  startScheduledEmailWorker()
  logger.info("[Worker] sequence, workflow, scheduled-email started")
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
  .use(requestId) // Add request ID for tracing
  .use(httpLogger) // Logger

  // Skip automatic body parsing for multipart/form-data (MUST be before any plugins that access body)
  .onParse((_context, contentType) => {
    // Skip parsing for multipart form-data to allow custom parsing in webhook handlers
    if (contentType.startsWith("multipart/form-data")) {
      return // Return undefined to skip automatic parsing
    }
  })

  // Webhooks (must be registered before permissionGuard to handle custom body parsing)
  .use(webhookRoutes)

  // Security plugins
  .use(rateLimit) // Apply rate limiting to all routes
  .use(permissionGuard) // Apply centralized permission check (2025 best practice)
  .use(activityLogger) // Activity logging context (depends on permissionGuard)
  .use(autoActivityLogger) // Auto activity logging for CUD operations
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
  .onError(({ error, request }) => {
    const path = new URL(request.url).pathname
    const status = "status" in error && typeof error.status === "number" ? error.status : 500

    // Scanner bot 404 requests → debug level (reduce noise)
    if (status === 404 && isScannerRequest(path)) {
      logger.debug({ err: error }, "Scanner Request (404)")
    } else {
      logger.error({ err: error }, "Application Error")
    }
    throw error
  })
  .get("/", () => ({ message: "SendGrid Email Service API", version: "2.1.0" }))

  // Register routes
  .use(apiHealthRoute)
  .use(healthRoutes)
  .use(sseTestRoutes)
  .use(aiRoutes)
  .use(chatbotRoutes)
  .use(authRoutes)
  .use(departmentsRoutes)
  .use(userRoutes)
  .use(adminUserRoutes)
  .use(workspaceRoutes)
  .use(adminWorkspaceRoutes)
  .use(customerGroupRoutes)
  .use(adminCustomerGroupRoutes)
  .use(dashboardRoutes)
  .use(emailAccountRoutes)
  .use(adminEmailAccountRoutes)
  .use(emailSignatureRoutes)
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
  .use(openaiApiKeysRoutes)
  .use(webExtractionRoutes)
  .use(websetRoutes)
  .use(geminiFileSearchRoutes)
  .use(bigquerySearchRoutes)
  .use(leadEnrichmentRoutes)
  .use(nylasRoutes)
  .use(leadDiscoveryRoutes)
  .use(salesStrategyRoutes)
  .use(workspaceSalesStrategyRoutes)
  // Billing routes
  .use(billingProductsRoutes)
  .use(billingPlansRoutes)
  .use(subscriptionsRoutes)
  .use(billingCustomersRoutes)
  // IAM routes
  .use(iamPoliciesRoutes)
  .use(iamRolesRoutes)
  .use(iamMembersRoutes)
  .use(iamTierBoundariesRoutes)
  .use(iamAuditLogsRoutes)
  .use(iamMyPermissionsRoutes)
  // Onboarding routes
  .use(onboardingRoutes)
  // Notification routes
  .use(notificationRoutes)
  // BullMQ Test routes
  .use(bullmqTestRoutes)
  // Job Logs routes
  .use(jobLogsRoutes)

  .listen(config.port)

// Startup log
logger.info(`
📦 elysia-server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▸ Run:  bun dev
▸ DB:   bun db:generate (generate migration files)
▸ Lint: bun lint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
※ CI/CD: auto deploy on main push (EC2)
※ DB migrate runs on docker container start
※ Code quality: husky hooks + send-ci.sh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Server] http://${app.server?.hostname}:${config.port} ready
`)
