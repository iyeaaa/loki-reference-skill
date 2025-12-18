import { Elysia } from "elysia"
import { webhookService } from "../services/webhook.service"
import logger from "../utils/logger"
import { parseMultipartFormData } from "../utils/multipart.util"

export const webhookRoutes = new Elysia({ prefix: "/api/webhook" })
  .onParse((context, contentType) => {
    // Skip automatic body parsing for multipart form-data
    // We need to manually parse it to handle file uploads correctly
    if (contentType.startsWith("multipart/form-data")) {
      return // Return undefined to skip parsing
    }
  })
  // SendGrid Inbound Parse
  .post("/inbound", async ({ request }) => {
    const contentType = request.headers.get("content-type")
    logger.info(
      {
        contentType,
        hasContentType: !!contentType,
        contentTypeLength: contentType?.length || 0,
      },
      "Received inbound webhook request",
    )

    const arrayBuffer = await request.arrayBuffer()
    logger.info(
      {
        bodySize: arrayBuffer.byteLength,
        contentType,
      },
      "Parsing multipart form data",
    )

    try {
      const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

      logger.info(
        {
          filesCount: files?.length || 0,
          fileNames: files?.map((f) => f.originalname) || [],
          bodyKeys: Object.keys(body),
          attachmentsField: body.attachments,
          attachmentInfoField: body["attachment-info"],
        },
        "Multipart parsing completed",
      )

      return webhookService.processInboundEmail(body, files)
    } catch (error) {
      logger.error(
        {
          err: error,
          errorMessage: error instanceof Error ? error.message : String(error),
          contentType,
          bodySize: arrayBuffer.byteLength,
        },
        "Failed to parse multipart form data",
      )
      throw error
    }
  })
  .post("/inbound-store", async ({ request }) => {
    const contentType = request.headers.get("content-type")
    const arrayBuffer = await request.arrayBuffer()
    const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

    return webhookService.processInboundStore(body, files)
  })
  // SendGrid Event Webhook
  .post("/sendgrid-events", async ({ body }) => {
    return webhookService.processSendGridEvents(body as unknown)
  })
