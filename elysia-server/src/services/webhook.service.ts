import { and, eq, sql } from "drizzle-orm"
import { db } from "../db"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailEvents, emailReplies, emails as emailsTable } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import type {
  Email,
  FileData,
  SendGridEnvelope,
  SendGridInboundPayload,
} from "../models/email.model"
import { emails } from "../types/email-storage"
import { extractEmailAddress, parseEmailBody } from "../utils/email.util"
import logger from "../utils/logger"
import { emailService } from "./email.service"

interface SendGridEvent {
  event:
    | "processed"
    | "delivered"
    | "open"
    | "click"
    | "bounce"
    | "dropped"
    | "deferred"
    | "spam_report"
    | "unsubscribe"
  email: string
  timestamp: number
  sg_event_id?: string
  sg_message_id?: string
  useragent?: string
  ip?: string
  url?: string
  bounce_classification?: string
  reason?: string
  status?: string
  response?: string
  type?: string
  [key: string]: unknown
}

class WebhookService {
  async processInboundEmail(body: SendGridInboundPayload, files: FileData[]) {
    // Log complete raw data first
    logger.info(
      {
        fullBody: body,
        fullFiles: files,
        bodyKeys: Object.keys(body),
        filesCount: files?.length || 0,
      },
      "Complete webhook payload received",
    )

    // Extract headers
    const headers = this.extractHeaders(body.headers)

    // Log email information
    this.logEmailInfo(body, headers, files)

    // Process attachments
    const parsedAttachments = await this.processAttachments(body)

    // Create email data
    const emailData = this.createEmailData(body, parsedAttachments)

    // Store email (legacy - in memory)
    emails.push(emailData)

    // Store email in database
    try {
      await this.storeInboundEmailInDB(body, headers, parsedAttachments)
    } catch (error) {
      logger.error({ err: error }, "Failed to store inbound email in DB")
    }

    // Send auto-reply if needed
    if (body.from && body.subject) {
      this.handleAutoReply(body, headers)
    }

    return { status: "OK" }
  }

  processInboundStore(body: SendGridInboundPayload, files: FileData[]) {
    const email = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      from: body.from || "",
      to: body.to || "",
      subject: body.subject || "",
      text: body.text || "",
      html: body.html || "",
      attachments: files
        ? files.map((f: FileData) => ({
            filename: f.originalname,
            size: f.size,
            mimetype: f.mimetype,
          }))
        : [],
    }

    emails.push(email)
    logger.info({ emailId: email.id, subject: email.subject }, "Email stored")

    return { status: "OK" }
  }

  private extractHeaders(headersString?: string): {
    messageId: string | undefined
    inReplyTo: string | undefined
    references: string[]
  } {
    let messageId: string | undefined
    let inReplyTo: string | undefined
    const references: string[] = []

    if (headersString) {
      try {
        const headers = JSON.parse(headersString)
        messageId = headers["Message-ID"] || headers["message-id"]
        inReplyTo = headers["In-Reply-To"] || headers["in-reply-to"]
        const referencesStr = headers.References || headers.references
        if (referencesStr) {
          references.push(...referencesStr.split(/\s+/).filter((ref: string) => ref.length > 0))
        }
      } catch (e) {
        logger.warn({ err: e }, "Failed to parse headers")
      }
    }

    return { messageId, inReplyTo, references }
  }

  private logEmailInfo(
    body: SendGridInboundPayload,
    headers: { messageId: string | undefined; inReplyTo: string | undefined; references: string[] },
    files: FileData[],
  ) {
    let envelopeFrom = "none"
    let envelopeParsed: SendGridEnvelope | null = null
    try {
      envelopeParsed = JSON.parse(body.envelope || "{}") as SendGridEnvelope
      envelopeFrom = envelopeParsed.from || "none"
    } catch {
      envelopeFrom = "parse failed"
    }

    // Log all standard SendGrid Inbound Parse fields
    const emailInfo = {
      receivedAt: new Date().toISOString(),

      // Basic fields
      from: body.from || "none",
      to: body.to || "none",
      cc: body.cc || "none",
      bcc: body.bcc || "none",
      subject: body.subject || "none",

      // Headers
      messageId: headers.messageId || "none",
      inReplyTo: headers.inReplyTo || "none",
      references: headers.references.length > 0 ? headers.references.join(", ") : "none",

      // Envelope
      envelope: envelopeParsed,
      envelopeFrom,

      // Content
      textLength: body.text?.length || 0,
      htmlLength: body.html?.length || 0,

      // Metadata
      senderIp: body.sender_ip || "none",
      spamReport: body.spam_report || "none",
      spamScore: body.spam_score || "none",
      dkim: body.dkim || "none",
      spf: body.SPF || "none",

      // Attachments
      attachments: body.attachments || "none",
      attachmentInfo: body["attachment-info"] || "none",
      filesCount: files?.length || 0,

      // Character sets and content IDs
      charsets: body.charsets || "none",
      contentIds: body["content-ids"] || "none",
    }

    logger.info(emailInfo, "Inbound email received with full metadata")

    if (body.text) {
      const textPreview = body.text.slice(0, 200)
      logger.debug({ preview: textPreview, length: body.text.length }, "Email text content preview")
    }

    if (files && files.length > 0) {
      files.forEach((file: FileData) => {
        logger.debug(
          {
            filename: file.originalname,
            fieldname: file.fieldname,
            mimetype: file.mimetype,
            size: file.size,
          },
          "Uploaded file",
        )
      })
    }

    this.logMetadata(body)
    this.logAllKeys(body)
  }

  private logMetadata(body: SendGridInboundPayload) {
    if (body.charsets) {
      try {
        const charsets = JSON.parse(body.charsets)
        logger.debug({ charsets }, "Email charsets metadata")
      } catch (e) {
        logger.warn({ err: e }, "Failed to parse charsets")
      }
    }

    if (body["content-ids"]) {
      try {
        const contentIds = JSON.parse(body["content-ids"])
        if (Object.keys(contentIds).length > 0) {
          logger.debug({ contentIds }, "Email content-ids metadata")
        }
      } catch (e) {
        logger.warn({ err: e }, "Failed to parse content-ids")
      }
    }
  }

  private logAllKeys(body: SendGridInboundPayload) {
    const allKeys = Object.keys(body)
    const keyPreviews: Record<string, string> = {}
    const fullValues: Record<string, string | undefined> = {}

    allKeys.forEach((key) => {
      const value = body[key as keyof SendGridInboundPayload]

      // Store full value for complete logging
      fullValues[key] = value

      // Create preview for debug log
      keyPreviews[key] = value
        ? value.length > 50
          ? `${value.substring(0, 50)}...`
          : value
        : "empty"
    })

    logger.info(
      {
        fieldsCount: allKeys.length,
        allKeys,
        fullValues,
      },
      "Complete field dump - all keys and values",
    )

    logger.debug(
      { fieldsCount: allKeys.length, keys: keyPreviews },
      "All received data keys (preview)",
    )
  }

  private async processAttachments(body: SendGridInboundPayload) {
    const attachmentsJson = body.attachments || "[]"
    const attachmentInfo = body["attachment-info"]
    return await emailService.processAttachments(attachmentsJson, attachmentInfo)
  }

  private createEmailData(body: SendGridInboundPayload, attachments: unknown[]): Email {
    return {
      id: Date.now().toString(),
      from: body.from || "Unknown",
      to: body.to || "Unknown",
      subject: body.subject || "No subject",
      text: body.text,
      html: body.html,
      attachments: attachments as { filename: string; content: string }[],
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 인바운드 이메일을 DB에 저장하고 답장인 경우 email_replies 테이블에도 저장
   */
  private async storeInboundEmailInDB(
    body: SendGridInboundPayload,
    headers: { messageId: string | undefined; inReplyTo: string | undefined; references: string[] },
    _attachments: unknown[],
  ) {
    logger.info("Storing inbound email in DB")

    // 1. 이메일 주소 추출 및 본문 파싱
    const toEmail = extractEmailAddress(body.to || "")
    const fromEmail = extractEmailAddress(body.from || "")

    // 본문 파싱: 항상 body.email에서 파싱 (SendGrid는 Raw 모드로 설정됨)
    let bodyText: string | undefined
    let bodyHtml: string | undefined

    if (body.email) {
      const parsed = parseEmailBody(body.email)
      bodyText = parsed.text
      bodyHtml = parsed.html
      logger.info(
        {
          hasText: !!bodyText,
          hasHtml: !!bodyHtml,
          textLength: bodyText?.length || 0,
          htmlLength: bodyHtml?.length || 0,
        },
        "Parsed email body from RFC 822 format",
      )
    } else {
      // Fallback: SendGrid가 파싱 모드인 경우
      bodyText = body.text
      bodyHtml = body.html
    }

    // 2. 수신 이메일 주소로 이메일 계정 찾기

    const emailAccount = await db
      .select({
        id: userEmailAccounts.id,
        workspaceId: userEmailAccounts.workspaceId,
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.emailAddress, toEmail))
      .limit(1)

    if (emailAccount.length === 0) {
      logger.warn({ toEmail }, "Email account not found")
      return
    }

    const account = emailAccount[0]
    if (!account) {
      logger.warn("Email account not found")
      return
    }

    // 3. 발신자 이메일로 리드 찾기
    const leadContactResults = await db
      .select({ leadId: leadContacts.leadId })
      .from(leadContacts)
      .where(and(eq(leadContacts.contactType, "email"), eq(leadContacts.contactValue, fromEmail)))
      .limit(1)

    const leadId = leadContactResults.length > 0 ? leadContactResults[0]?.leadId : null

    // 4. threadId 결정: 답장이면 원본의 threadId 사용, 아니면 messageId를 threadId로 사용
    let threadId: string | null | undefined = null

    if (headers.inReplyTo) {
      // 답장인 경우: 원본 이메일의 threadId 찾기
      const originalEmailForThread = await db
        .select({ threadId: emailsTable.threadId, messageId: emailsTable.messageId })
        .from(emailsTable)
        .where(eq(emailsTable.messageId, headers.inReplyTo))
        .limit(1)

      if (originalEmailForThread.length > 0) {
        const original = originalEmailForThread[0]
        // 원본의 threadId가 있으면 사용, 없으면 원본의 messageId를 threadId로 사용
        threadId = original?.threadId || original?.messageId || headers.inReplyTo
        logger.info(
          {
            threadId,
            inReplyTo: headers.inReplyTo,
            originalThreadId: original?.threadId,
            originalMessageId: original?.messageId,
          },
          "Thread ID inherited from original email",
        )
      } else {
        // 원본을 못 찾으면 inReplyTo를 threadId로 사용 (첫 이메일이 외부에서 온 경우)
        threadId = headers.inReplyTo
        logger.info(
          { threadId: headers.inReplyTo },
          "Using In-Reply-To as thread ID (original not found)",
        )
      }
    } else {
      // 새 스레드: messageId를 threadId로 사용
      threadId = headers.messageId || `thread-${Date.now()}`
      logger.info(
        { threadId, messageId: headers.messageId },
        "New thread - using messageId as thread ID",
      )
    }

    logger.info(
      { threadId, messageId: headers.messageId, inReplyTo: headers.inReplyTo },
      "Thread ID determined for inbound email",
    )

    // 5. 인바운드 이메일을 emails 테이블에 저장
    const inboundEmailResults = await db
      .insert(emailsTable)
      .values({
        workspaceId: account.workspaceId,
        userEmailAccountId: account.id,
        leadId,
        direction: "inbound",
        fromEmail,
        toEmail,
        subject: body.subject || "",
        bodyText,
        bodyHtml,
        rawEmail: body.email, // 원본 RFC 822 이메일 저장
        status: "delivered", // Inbound emails are already delivered
        sentAt: new Date(),
        deliveredAt: new Date(), // Set delivered time
        messageId: headers.messageId,
        inReplyTo: headers.inReplyTo,
        threadId, // threadId 추가!
      })
      .returning()

    const inboundEmail = inboundEmailResults[0]
    if (!inboundEmail) {
      logger.error("Failed to save inbound email")
      return
    }

    logger.info({ emailId: inboundEmail.id }, "Inbound email saved successfully")

    // 6. 답장인지 확인 (In-Reply-To 헤더가 있는 경우)
    if (headers.inReplyTo) {
      logger.info({ inReplyTo: headers.inReplyTo }, "Reply detected")

      // 원본 이메일 찾기 (messageId로 검색)
      const originalEmailResults = await db
        .select({
          id: emailsTable.id,
          workspaceId: emailsTable.workspaceId,
          sequenceId: emailsTable.sequenceId,
          leadId: emailsTable.leadId,
        })
        .from(emailsTable)
        .where(
          and(eq(emailsTable.messageId, headers.inReplyTo), eq(emailsTable.direction, "outbound")),
        )
        .limit(1)

      const originalEmail = originalEmailResults[0]
      if (originalEmail) {
        logger.info({ originalEmailId: originalEmail.id }, "Original email found")

        // email_replies 테이블에 저장
        await db.insert(emailReplies).values({
          workspaceId: originalEmail.workspaceId,
          originalEmailId: originalEmail.id,
          replyEmailId: inboundEmail.id,
          isRead: false,
        })

        logger.info("Saved to email_replies table")

        // 원본 이메일의 repliedAt 업데이트
        await db
          .update(emailsTable)
          .set({
            repliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailsTable.id, originalEmail.id))

        logger.info({ originalEmailId: originalEmail.id }, "Original email repliedAt updated")
      } else {
        logger.warn({ inReplyTo: headers.inReplyTo }, "Original email not found")
      }
    }
  }

  private async handleAutoReply(
    body: SendGridInboundPayload,
    headers:
      | Record<string, string | undefined>
      | { messageId?: string; inReplyTo?: string; references: string[] },
  ) {
    logger.info("Attempting to send auto-reply")

    const emailContent = emailService.extractEmailContent(body.text, body.html, body.email)

    logger.debug({ contentLength: emailContent.length }, "Email content length")

    const baseReferences: string[] = Array.isArray(headers.references) ? headers.references : []
    const updatedReferences: string[] = headers.messageId
      ? [...baseReferences, headers.messageId]
      : baseReferences

    const autoReplySuccess = await emailService.sendAutoReply(
      body.to || "",
      body.from || "",
      body.subject || "",
      emailContent,
      headers.messageId,
      updatedReferences,
    )

    if (autoReplySuccess) {
      logger.info("Auto-reply sent successfully")
    } else {
      logger.error("Failed to send auto-reply")
    }

    logger.info("Email processing completed")
  }

  /**
   * SendGrid Event Webhook 처리
   * @param events - SendGrid에서 전송하는 이벤트 배열
   */
  async processSendGridEvents(events: unknown) {
    const eventArray = Array.isArray(events) ? events : [events]

    logger.info({ count: eventArray.length }, "Processing SendGrid events")

    for (const event of eventArray) {
      try {
        await this.processSingleEvent(event as SendGridEvent)
      } catch (error) {
        logger.error({ err: error, event }, "Failed to process SendGrid event")
      }
    }

    return { status: "OK", processed: eventArray.length }
  }

  private async processSingleEvent(event: SendGridEvent) {
    logger.info({ event: event.event, sgMessageId: event.sg_message_id }, "Processing event")

    // 1. sg_message_id로 이메일 찾기
    if (!event.sg_message_id) {
      logger.warn("Event missing sg_message_id")
      return
    }

    const emailResults = await db
      .select({ id: emailsTable.id, status: emailsTable.status })
      .from(emailsTable)
      .where(eq(emailsTable.sendgridMessageId, event.sg_message_id))
      .limit(1)

    if (emailResults.length === 0) {
      logger.warn({ sgMessageId: event.sg_message_id }, "Email not found for event")
      return
    }

    const email = emailResults[0]
    if (!email) return

    // 2. email_events 테이블에 이벤트 저장
    await db.insert(emailEvents).values({
      emailId: email.id,
      eventType: event.event,
      timestamp: new Date(event.timestamp * 1000),
      sendgridEventId: event.sg_event_id,
      userAgent: event.useragent,
      ipAddress: event.ip,
      url: event.url,
      bounceType: event.bounce_classification,
      bounceReason: event.reason,
      smtpResponse: event.response,
      rawEventData: event as unknown as Record<string, unknown>,
      processed: false,
    })

    logger.info({ emailId: email.id, eventType: event.event }, "Event saved to database")

    // 3. 이메일 상태 업데이트
    await this.updateEmailStatus(email.id, event)
  }

  private async updateEmailStatus(emailId: string, event: SendGridEvent) {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    switch (event.event) {
      case "delivered":
        updates.status = "delivered"
        updates.deliveredAt = new Date(event.timestamp * 1000)
        break
      case "open":
        updates.status = "opened"
        updates.openedAt = new Date(event.timestamp * 1000)
        // Increment open count separately
        updates.openCount = sql`${emailsTable.openCount} + 1`
        break
      case "click":
        updates.status = "clicked"
        updates.clickedAt = new Date(event.timestamp * 1000)
        // Increment click count separately
        updates.clickCount = sql`${emailsTable.clickCount} + 1`
        break
      case "bounce":
        updates.status = "bounced"
        updates.bounceType = event.bounce_classification === "hard" ? "hard" : "soft"
        updates.bounceReason = event.reason
        break
      case "dropped":
      case "deferred":
        updates.status = "failed"
        updates.errorMessage = event.reason
        break
      case "spam_report":
        updates.status = "spam"
        updates.spamReportedAt = new Date(event.timestamp * 1000)
        break
      case "unsubscribe":
        updates.status = "unsubscribed"
        updates.unsubscribedAt = new Date(event.timestamp * 1000)
        break
    }

    if (Object.keys(updates).length > 1) {
      // More than just updatedAt
      await db.update(emailsTable).set(updates).where(eq(emailsTable.id, emailId))

      logger.info({ emailId, status: updates.status, event: event.event }, "Email status updated")
    }
  }
}

export const webhookService = new WebhookService()
