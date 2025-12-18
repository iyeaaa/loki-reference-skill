import { Elysia } from "elysia"
import { webhookService } from "../services/webhook.service"
import logger from "../utils/logger"

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  // SendGrid Inbound Parse - Use ElysiaJS built-in multipart parser
  .post("/inbound", async ({ body, request }) => {
    const contentType = request.headers.get("content-type")
    logger.info(
      {
        contentType,
        hasContentType: !!contentType,
        contentTypeLength: contentType?.length || 0,
      },
      "Received inbound webhook request",
    )

    // ElysiaJS automatically parses multipart/form-data
    // body will contain the parsed form data
    logger.info(
      {
        bodyType: typeof body,
        bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
      },
      "Body received",
    )

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
          } else {
            formData[key] = value
          }
        }
      }

      logger.info(
        {
          filesCount: files.length,
          fileNames: files.map((f) => f.originalname),
          bodyKeys: Object.keys(formData),
        },
        "Multipart parsing completed",
      )

      // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
      return webhookService.processInboundEmail(formData as any, files as any)
    } catch (error) {
      logger.error(
        {
          err: error,
          errorMessage: error instanceof Error ? error.message : String(error),
          contentType,
        },
        "Failed to process inbound email",
      )
      throw error
    }
  })
  .post("/inbound-store", async ({ body }) => {
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

    // biome-ignore lint/suspicious/noExplicitAny: webhook payload type is dynamic
    return webhookService.processInboundStore(formData as any, files as any)
  })
  // SendGrid Event Webhook
  .post("/sendgrid-events", async ({ body }) => {
    return webhookService.processSendGridEvents(body as unknown)
  })
