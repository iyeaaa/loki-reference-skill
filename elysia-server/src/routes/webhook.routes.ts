import { Elysia, t } from "elysia"
import * as tossService from "../services/toss.service"
import { webhookService } from "../services/webhook.service"
import logger, { generateTraceId, inboundEmailLogger, webhookLogger } from "../utils/logger"

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  // SendGrid Inbound Parse - Use ElysiaJS built-in multipart parser
  .post("/inbound", async ({ body }) => {
    const startTime = Date.now()
    const traceId = generateTraceId()

    // Get essential info only
    const sendGridFields = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
    const from = String(sendGridFields.from || "unknown")
    const to = String(sendGridFields.to || "unknown")
    const subject = String(sendGridFields.subject || "")

    // Single log for received webhook
    inboundEmailLogger.received(traceId, from, to, subject)

    try {
      // Convert ElysiaJS parsed body to our expected format
      const formData: Record<string, unknown> = {}
      const files: Array<{
        fieldname: string
        originalname: string
        mimetype: string
        size: number
        buffer: Buffer
      }> = []

      if (body && typeof body === "object") {
        for (const [key, value] of Object.entries(body)) {
          if (value instanceof File || value instanceof Blob) {
            files.push({
              fieldname: key,
              originalname: value instanceof File ? value.name : key,
              mimetype: value.type,
              size: value.size,
              buffer: Buffer.from(await value.arrayBuffer()),
            })
            // Attachments logged at debug level only
            logger.debug(
              {
                traceId,
                component: "inbound-email",
                filename: value instanceof File ? value.name : key,
                size: value.size,
              },
              `[inbound-email] Attachment: ${value instanceof File ? value.name : key}`,
            )
          } else {
            formData[key] = value
          }
        }
      }

      const result = await webhookService.processInboundEmail(
        // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
        formData as any,
        // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
        files as any,
        traceId,
      )

      const durationMs = Date.now() - startTime
      inboundEmailLogger.processed(traceId, {
        emailId: result?.emailId || "unknown",
        isReply: result?.isReply || false,
        classification: result?.classification,
        durationMs,
      })

      return result
    } catch (error) {
      inboundEmailLogger.failed(traceId, error instanceof Error ? error.message : String(error))
      throw error
    }
  })
  .post("/inbound-store", async ({ body }) => {
    const startTime = Date.now()
    const traceId = generateTraceId()

    // Use ElysiaJS built-in parser
    const formData: Record<string, unknown> = {}
    const files: Array<{
      fieldname: string
      originalname: string
      mimetype: string
      size: number
      buffer: Buffer
    }> = []

    if (body && typeof body === "object") {
      for (const [key, value] of Object.entries(body)) {
        if (value instanceof File || value instanceof Blob) {
          files.push({
            fieldname: key,
            originalname: value instanceof File ? value.name : key,
            mimetype: value.type,
            size: value.size,
            buffer: Buffer.from(await value.arrayBuffer()),
          })
        } else {
          formData[key] = value
        }
      }
    }

    const from = String(formData.from || "unknown")
    const to = String(formData.to || "unknown")
    const subject = String(formData.subject || "")

    inboundEmailLogger.received(traceId, from, to, subject)

    try {
      const result = await webhookService.processInboundStore(
        // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
        formData as any,
        // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
        files as any,
      )

      const durationMs = Date.now() - startTime
      inboundEmailLogger.processed(traceId, {
        emailId: result?.emailId || "unknown",
        isReply: false,
        durationMs,
      })

      return result
    } catch (error) {
      inboundEmailLogger.failed(traceId, error instanceof Error ? error.message : String(error))
      throw error
    }
  })
  // SendGrid Event Webhook
  .post("/sendgrid-events", async ({ body }) => {
    const startTime = Date.now()
    const traceId = generateTraceId()
    const eventCount = Array.isArray(body) ? body.length : 1

    // Single log for batch received - no individual event logging
    webhookLogger.batchReceived({ source: "sendgrid-events", traceId }, eventCount)

    // Log event types summary at debug level only
    if (Array.isArray(body)) {
      const eventTypeCounts = body.reduce(
        (acc: Record<string, number>, event: Record<string, unknown>) => {
          const type = String(event.event || "unknown")
          acc[type] = (acc[type] || 0) + 1
          return acc
        },
        {},
      )
      logger.debug(
        {
          traceId,
          component: "webhook",
          source: "sendgrid-events",
          eventTypeCounts,
        },
        `[webhook:sendgrid-events] Event breakdown: ${JSON.stringify(eventTypeCounts)}`,
      )
    }

    try {
      const result = await webhookService.processSendGridEvents(body as unknown)

      const durationMs = Date.now() - startTime
      webhookLogger.processed(
        { source: "sendgrid-events", eventType: "batch", traceId },
        { success: true, durationMs, metadata: { eventCount } },
      )

      return result
    } catch (error) {
      const durationMs = Date.now() - startTime
      webhookLogger.processed(
        { source: "sendgrid-events", eventType: "batch", traceId },
        {
          success: false,
          durationMs,
          metadata: { eventCount, error: error instanceof Error ? error.message : String(error) },
        },
      )
      throw error
    }
  })
  // TossPayments Webhook
  .post(
    "/toss",
    async ({ body, headers, set }) => {
      const startTime = Date.now()
      const traceId = generateTraceId()

      // Get raw body for signature verification
      const payload = JSON.stringify(body)
      const signature =
        headers["toss-signature"] || headers["tosspayments-webhook-signature"] || null

      webhookLogger.batchReceived({ source: "toss", traceId }, 1)

      // Verify webhook signature
      if (!tossService.verifyWebhookSignature(payload, signature)) {
        logger.warn({ traceId }, "[Toss Webhook] Invalid signature")
        set.status = 401
        return { success: false, error: "Invalid signature" }
      }

      try {
        const event = body as tossService.TossWebhookPayload
        const result = await tossService.handleWebhookEvent(event)

        const durationMs = Date.now() - startTime
        webhookLogger.processed(
          { source: "toss", eventType: event.eventType, traceId },
          { success: result.success, durationMs, metadata: { message: result.message } },
        )

        return result
      } catch (error) {
        const durationMs = Date.now() - startTime
        webhookLogger.processed(
          { source: "toss", eventType: "unknown", traceId },
          {
            success: false,
            durationMs,
            metadata: { error: error instanceof Error ? error.message : String(error) },
          },
        )
        logger.error({ error, traceId }, "[Toss Webhook] Processing error")
        set.status = 500
        return { success: false, error: "Internal server error" }
      }
    },
    {
      body: t.Object({
        eventType: t.String(),
        createdAt: t.String(),
        data: t.Any(),
      }),
    },
  )
