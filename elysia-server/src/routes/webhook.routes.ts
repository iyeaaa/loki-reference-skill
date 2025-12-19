import { Elysia } from "elysia"
import { webhookService } from "../services/webhook.service"
import logger from "../utils/logger"

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  // SendGrid Inbound Parse - Use ElysiaJS built-in multipart parser
  .post("/inbound", async ({ body, request }) => {
    const contentType = request.headers.get("content-type")
    const requestUrl = request.url
    const requestMethod = request.method
    const allHeaders = Object.fromEntries(request.headers.entries())

    logger.info(
      {
        contentType,
        hasContentType: !!contentType,
        contentTypeLength: contentType?.length || 0,
        requestUrl,
        requestMethod,
        allHeaders,
        timestamp: new Date().toISOString(),
      },
      "📧 [SENDGRID INBOUND] Received inbound webhook request - RAW REQUEST INFO",
    )

    // ElysiaJS automatically parses multipart/form-data
    // body will contain the parsed form data
    logger.info(
      {
        bodyType: typeof body,
        bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
        hasBody: !!body,
      },
      "📧 [SENDGRID INBOUND] Body type info",
    )

    // Log specific SendGrid fields if they exist
    if (body && typeof body === "object") {
      const sendGridFields = body as Record<string, unknown>
      logger.info(
        {
          from: sendGridFields.from,
          to: sendGridFields.to,
          subject: sendGridFields.subject,
          text: sendGridFields.text
            ? `${String(sendGridFields.text).substring(0, 200)}...`
            : undefined,
          html: sendGridFields.html
            ? `${String(sendGridFields.html).substring(0, 200)}...`
            : undefined,
          envelope: sendGridFields.envelope,
          headers: sendGridFields.headers,
          sender_ip: sendGridFields.sender_ip,
          spam_score: sendGridFields.spam_score,
          spam_report: sendGridFields.spam_report,
          charsets: sendGridFields.charsets,
          SPF: sendGridFields.SPF,
          dkim: sendGridFields.dkim,
          attachments: sendGridFields.attachments,
          attachment_info: sendGridFields["attachment-info"],
          email: sendGridFields.email
            ? `[RFC822 email - ${String(sendGridFields.email).length} chars]`
            : undefined,
        },
        "📧 [SENDGRID INBOUND] Parsed SendGrid fields - EMAIL DETAILS",
      )
    }

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
            logger.info(
              {
                fieldname: key,
                filename: value instanceof File ? value.name : key,
                mimetype: value.type,
                size: value.size,
              },
              "📎 [SENDGRID INBOUND] Attachment detected",
            )
          } else {
            formData[key] = value
          }
        }
      }

      logger.info(
        {
          filesCount: files.length,
          fileNames: files.map((f) => f.originalname),
          fileSizes: files.map((f) => f.size),
          bodyKeys: Object.keys(formData),
          formDataSample: {
            from: formData.from,
            to: formData.to,
            subject: formData.subject,
          },
        },
        "📧 [SENDGRID INBOUND] Multipart parsing completed - ready to process",
      )

      // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
      const result = await webhookService.processInboundEmail(formData as any, files as any)

      logger.info(
        { result, from: formData.from, to: formData.to, subject: formData.subject },
        "✅ [SENDGRID INBOUND] Inbound email processed successfully",
      )

      return result
    } catch (error) {
      logger.error(
        {
          err: error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          contentType,
          bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
        },
        "❌ [SENDGRID INBOUND] Failed to process inbound email",
      )
      throw error
    }
  })
  .post("/inbound-store", async ({ body, request }) => {
    logger.info(
      {
        contentType: request.headers.get("content-type"),
        bodyType: typeof body,
        bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
      },
      "📦 [INBOUND-STORE] Received request",
    )

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

    logger.info(
      {
        from: formData.from,
        to: formData.to,
        subject: formData.subject,
        filesCount: files.length,
        fileNames: files.map((f) => f.originalname),
      },
      "📦 [INBOUND-STORE] Parsed email data",
    )

    try {
      // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
      const result = await webhookService.processInboundStore(formData as any, files as any)

      logger.info(
        { result, from: formData.from, to: formData.to },
        "✅ [INBOUND-STORE] Processed successfully",
      )

      return result
    } catch (error) {
      logger.error(
        {
          err: error,
          errorMessage: error instanceof Error ? error.message : String(error),
          from: formData.from,
          to: formData.to,
        },
        "❌ [INBOUND-STORE] Failed to process",
      )
      throw error
    }
  })
  // SendGrid Event Webhook
  .post("/sendgrid-events", async ({ body, request }) => {
    logger.info(
      {
        url: request.url,
        method: request.method,
        contentType: request.headers.get("content-type"),
        bodyType: typeof body,
        isArray: Array.isArray(body),
        eventCount: Array.isArray(body) ? body.length : 1,
        timestamp: new Date().toISOString(),
      },
      "📊 [SENDGRID EVENTS] Received SendGrid event webhook",
    )

    // Log each event in the batch
    if (Array.isArray(body)) {
      body.forEach((event: Record<string, unknown>, index: number) => {
        logger.info(
          {
            index,
            eventType: event.event,
            email: event.email,
            sgMessageId: event.sg_message_id,
            timestamp: event.timestamp,
            ip: event.ip,
            userAgent: event.useragent,
            sgMachineOpen: event.sg_machine_open,
            url: event.url,
            category: event.category,
          },
          `📊 [SENDGRID EVENTS] Event ${index + 1}: ${event.event}`,
        )
      })
    }

    try {
      const result = await webhookService.processSendGridEvents(body as unknown)

      logger.info(
        { result, eventCount: Array.isArray(body) ? body.length : 1 },
        "✅ [SENDGRID EVENTS] SendGrid events processed",
      )

      return result
    } catch (error) {
      logger.error(
        {
          err: error,
          errorMessage: error instanceof Error ? error.message : String(error),
          eventCount: Array.isArray(body) ? body.length : 1,
          eventTypes: Array.isArray(body) ? body.map((e: Record<string, unknown>) => e.event) : [],
        },
        "❌ [SENDGRID EVENTS] Failed to process events",
      )
      throw error
    }
  })
