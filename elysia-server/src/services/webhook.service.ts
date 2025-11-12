import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "../db"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailEvents, emailReplies, emails as emailsTable } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { sequenceEnrollments, sequences } from "../db/schema/sequences"
import type {
  Email,
  FileData,
  SendGridEnvelope,
  SendGridInboundPayload,
} from "../models/email.model"
import { emails } from "../types/email-storage"
import { extractEmailAddress, parseEmailBody, parseEmailHeaders } from "../utils/email.util"
import logger from "../utils/logger"
import { getAIClassificationService } from "./ai-classification.service"
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

    // Extract headers - PRIORITY: Parse from body.email (RFC 822) first
    const headers = this.extractHeaders(body.headers, body.email)

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

    // Auto-reply disabled
    // if (body.from && body.subject) {
    //   this.handleAutoReply(body, headers)
    // }

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

  private extractHeaders(
    headersString?: string,
    emailContent?: string,
  ): {
    messageId: string | undefined
    inReplyTo: string | undefined
    references: string[]
  } {
    let messageId: string | undefined
    let inReplyTo: string | undefined
    let references: string[] = []

    // PRIORITY 1: Parse from RFC 822 email content (body.email field)
    // This is the most reliable source for SendGrid Inbound Parse
    if (emailContent) {
      const parsedHeaders = parseEmailHeaders(emailContent)
      messageId = parsedHeaders.messageId
      inReplyTo = parsedHeaders.inReplyTo
      references = parsedHeaders.references

      logger.info(
        {
          messageId,
          inReplyTo,
          referencesCount: references.length,
          source: "RFC822",
        },
        "Headers extracted from RFC 822 email content",
      )
    }

    // PRIORITY 2: Fallback to headers string (legacy support)
    if (!messageId && headersString) {
      try {
        const headers = JSON.parse(headersString)
        messageId = headers["Message-ID"] || headers["message-id"]
        inReplyTo = headers["In-Reply-To"] || headers["in-reply-to"]
        const referencesStr = headers.References || headers.references
        if (referencesStr) {
          references.push(...referencesStr.split(/\s+/).filter((ref: string) => ref.length > 0))
        }
        logger.info(
          {
            messageId,
            inReplyTo,
            referencesCount: references.length,
            source: "JSON",
          },
          "Headers extracted from JSON headers string",
        )
      } catch (e) {
        logger.warn({ err: e }, "Failed to parse headers string as JSON")
      }
    }

    return { messageId, inReplyTo, references }
  }

  private logEmailInfo(
    body: SendGridInboundPayload,
    headers: {
      messageId: string | undefined
      inReplyTo: string | undefined
      references: string[]
    },
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
    headers: {
      messageId: string | undefined
      inReplyTo: string | undefined
      references: string[]
    },
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
    // 답장인 경우: 원본 이메일의 워크스페이스에 해당하는 계정을 찾음
    let targetWorkspaceId: string | undefined

    if (headers.inReplyTo) {
      // 답장인 경우: 먼저 원본 이메일의 워크스페이스를 찾음
      const originalEmailForWorkspace = await db
        .select({ workspaceId: emailsTable.workspaceId })
        .from(emailsTable)
        .where(
          and(eq(emailsTable.messageId, headers.inReplyTo), eq(emailsTable.direction, "outbound")),
        )
        .limit(1)

      if (originalEmailForWorkspace.length > 0 && originalEmailForWorkspace[0]?.workspaceId) {
        targetWorkspaceId = originalEmailForWorkspace[0].workspaceId
        logger.info(
          { workspaceId: targetWorkspaceId, inReplyTo: headers.inReplyTo },
          "Found original email's workspace for reply",
        )
      }
    }

    // 이메일 계정 검색 (워크스페이스 필터 적용)
    const emailAccountQuery = db
      .select({
        id: userEmailAccounts.id,
        workspaceId: userEmailAccounts.workspaceId,
      })
      .from(userEmailAccounts)
      .where(
        targetWorkspaceId
          ? and(
              eq(userEmailAccounts.emailAddress, toEmail),
              eq(userEmailAccounts.workspaceId, targetWorkspaceId),
            )
          : eq(userEmailAccounts.emailAddress, toEmail),
      )
      .limit(1)

    const emailAccount = await emailAccountQuery

    if (emailAccount.length === 0) {
      logger.warn({ toEmail, targetWorkspaceId }, "Email account not found")
      return
    }

    const account = emailAccount[0]
    if (!account) {
      logger.warn("Email account not found")
      return
    }

    // 3. 답장인 경우: 원본 이메일에서 leadId, sequenceId, threadId, workspaceId를 가져옴
    let leadId: string | null = null
    let sequenceId: string | null = null
    let leadName: string | null = null
    let sequenceName: string | null = null
    let threadId = headers.messageId // First email: messageId becomes threadId
    let workspaceId = account.workspaceId // Default to account workspace, will be overridden if reply

    if (headers.inReplyTo) {
      // 답장인 경우: 원본 이메일 찾기 (모든 필요한 정보 한번에 조회)
      const originalEmailResults = await db
        .select({
          id: emailsTable.id,
          workspaceId: emailsTable.workspaceId,
          threadId: emailsTable.threadId,
          leadId: emailsTable.leadId,
          sequenceId: emailsTable.sequenceId,
          leadName: emailsTable.leadName,
          sequenceName: emailsTable.sequenceName,
        })
        .from(emailsTable)
        .where(eq(emailsTable.messageId, headers.inReplyTo))
        .limit(1)

      if (originalEmailResults.length > 0 && originalEmailResults[0]) {
        const originalEmail = originalEmailResults[0]

        // workspaceId 상속 (reply-to-reply를 위해 중요!)
        workspaceId = originalEmail.workspaceId
        logger.info(
          { workspaceId, inReplyTo: headers.inReplyTo },
          "Workspace ID inherited from original email",
        )

        // threadId 상속
        if (originalEmail.threadId) {
          threadId = originalEmail.threadId
          logger.info(
            { threadId, inReplyTo: headers.inReplyTo },
            "Thread ID inherited from original email",
          )
        }

        // leadId와 sequenceId 상속
        if (originalEmail.leadId) {
          leadId = originalEmail.leadId
          leadName = originalEmail.leadName
          logger.info(
            { leadId, leadName, inReplyTo: headers.inReplyTo },
            "Lead info inherited from original email",
          )
        }

        if (originalEmail.sequenceId) {
          sequenceId = originalEmail.sequenceId
          sequenceName = originalEmail.sequenceName
          logger.info(
            { sequenceId, sequenceName, inReplyTo: headers.inReplyTo },
            "Sequence info inherited from original email",
          )
        }
      }
    }

    // 4. leadId가 없으면 발신자 이메일로 리드 찾기 (fallback)
    if (!leadId) {
      const leadContactResults = await db
        .select({ leadId: leadContacts.leadId })
        .from(leadContacts)
        .where(and(eq(leadContacts.contactType, "email"), eq(leadContacts.contactValue, fromEmail)))
        .limit(1)

      leadId = leadContactResults.length > 0 ? leadContactResults[0]?.leadId || null : null

      if (leadId) {
        logger.info({ leadId, fromEmail }, "Lead found by sender email")
      }
    }

    // 5. sequenceId가 없고 leadId가 있으면 enrollment에서 조회 (fallback)
    if (leadId && !sequenceId) {
      const enrollmentResults = await db
        .select({
          sequenceId: sequenceEnrollments.sequenceId,
          sequenceName: sequences.name,
          lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
          enrollmentStatus: sequenceEnrollments.status,
        })
        .from(sequenceEnrollments)
        .innerJoin(sequences, eq(sequences.id, sequenceEnrollments.sequenceId))
        .where(
          and(
            eq(sequenceEnrollments.leadId, leadId),
            eq(sequenceEnrollments.userEmailAccountId, account.id),
            // 상태 필터 없음 - 모든 상태의 enrollment에서 가장 최근 것을 찾음
          ),
        )
        .orderBy(desc(sequenceEnrollments.lastEmailSentAt))
        .limit(1)

      if (enrollmentResults.length > 0 && enrollmentResults[0]) {
        sequenceId = enrollmentResults[0].sequenceId
        sequenceName = enrollmentResults[0].sequenceName
        logger.info(
          {
            sequenceId,
            sequenceName,
            leadId,
            lastEmailSentAt: enrollmentResults[0].lastEmailSentAt,
            enrollmentStatus: enrollmentResults[0].enrollmentStatus,
          },
          "Sequence found via enrollment (fallback, all statuses)",
        )
      }
    }

    // messageId가 없는 경우 fallback (비정상적인 이메일)
    if (!threadId) {
      threadId = `missing-msgid-${Date.now()}`
      logger.warn(
        { threadId, inReplyTo: headers.inReplyTo },
        "Missing Message-ID header, using fallback thread ID",
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
        workspaceId: account.workspaceId, // Use email account's workspace
        userEmailAccountId: account.id,
        leadId,
        sequenceId, // ← 원본 이메일에서 상속
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
        threadId,
        leadName, // ← Denormalized field 추가
        sequenceName, // ← Denormalized field 추가
      })
      .returning()

    const inboundEmail = inboundEmailResults[0]
    if (!inboundEmail) {
      logger.error("Failed to save inbound email")
      return
    }

    logger.info(
      {
        emailId: inboundEmail.id,
        leadId: inboundEmail.leadId,
        sequenceId: inboundEmail.sequenceId,
        leadName: inboundEmail.leadName,
        sequenceName: inboundEmail.sequenceName,
      },
      "Inbound email saved successfully with inherited info",
    )

    // 6. 답장인지 확인 (In-Reply-To 헤더가 있는 경우)
    logger.info({
      msg: "🔍 [WEBHOOK] Checking email_replies creation conditions",
      inboundEmailId: inboundEmail.id,
      hasInReplyTo: !!headers.inReplyTo,
      inReplyToValue: headers.inReplyTo,
      messageId: headers.messageId,
      threadId: inboundEmail.threadId,
      workspaceId: inboundEmail.workspaceId,
      accountWorkspaceId: account.workspaceId,
    })

    if (headers.inReplyTo) {
      logger.info(
        { inReplyTo: headers.inReplyTo },
        "✅ Reply detected (In-Reply-To header present)",
      )

      // 원본 이메일 ID 찾기 - 2-step process to support reply-to-reply
      // Step 1: Try to find the email being replied to (could be outbound or inbound)
      // Search WITHOUT workspace filter first to find the email
      logger.info({
        msg: "🔍 [WEBHOOK] Searching for email being replied to",
        searchCriteria: {
          messageId: headers.inReplyTo,
        },
      })

      const repliedToEmailResults = await db
        .select({
          id: emailsTable.id,
          workspaceId: emailsTable.workspaceId,
          messageId: emailsTable.messageId,
          threadId: emailsTable.threadId,
          subject: emailsTable.subject,
          direction: emailsTable.direction,
        })
        .from(emailsTable)
        .where(eq(emailsTable.messageId, headers.inReplyTo))
        .limit(1)

      const repliedToEmail = repliedToEmailResults[0]
      let originalEmail: typeof repliedToEmail | undefined

      if (repliedToEmail) {
        if (repliedToEmail.direction === "outbound") {
          // Case 1: Direct reply to an outbound email (most common)
          originalEmail = repliedToEmail
          logger.info({
            msg: "✅ [WEBHOOK] Direct reply to outbound email",
            originalEmailId: originalEmail.id,
            threadId: originalEmail.threadId,
          })
        } else {
          // Case 2: Reply to an inbound email (reply-to-reply)
          // Find the FIRST outbound email in this thread
          logger.info({
            msg: "🔄 [WEBHOOK] Reply-to-reply detected, finding first outbound email in thread",
            repliedToEmailId: repliedToEmail.id,
            threadId: repliedToEmail.threadId,
          })

          // Only search if threadId exists
          if (repliedToEmail.threadId) {
            const firstOutboundResults = await db
              .select({
                id: emailsTable.id,
                workspaceId: emailsTable.workspaceId,
                messageId: emailsTable.messageId,
                threadId: emailsTable.threadId,
                subject: emailsTable.subject,
                direction: emailsTable.direction,
              })
              .from(emailsTable)
              .where(
                and(
                  eq(emailsTable.threadId, repliedToEmail.threadId),
                  eq(emailsTable.direction, "outbound"),
                  eq(emailsTable.workspaceId, repliedToEmail.workspaceId),
                ),
              )
              .orderBy(emailsTable.createdAt) // Get the FIRST outbound email
              .limit(1)

            originalEmail = firstOutboundResults[0]

            if (originalEmail) {
              logger.info({
                msg: "✅ [WEBHOOK] Found original outbound email in thread",
                originalEmailId: originalEmail.id,
                threadId: originalEmail.threadId,
              })
            }
          } else {
            logger.warn({
              msg: "⚠️  [WEBHOOK] Reply-to-reply email has no threadId",
              repliedToEmailId: repliedToEmail.id,
            })
          }
        }
      }
      if (originalEmail) {
        logger.info({
          msg: "✅ [WEBHOOK] Original email found",
          originalEmailId: originalEmail.id,
          originalMessageId: originalEmail.messageId,
          originalThreadId: originalEmail.threadId,
          originalSubject: originalEmail.subject,
          inReplyToHeader: headers.inReplyTo,
          headersMatch: originalEmail.messageId === headers.inReplyTo,
        })

        // Check if email_replies record already exists for this thread
        // One email_replies record per thread - update if exists, insert if new
        const existingReplyResults = await db
          .select({ id: emailReplies.id })
          .from(emailReplies)
          .where(eq(emailReplies.originalEmailId, originalEmail.id))
          .limit(1)

        const existingReply = existingReplyResults[0]
        let emailReply: { id: string } | undefined

        if (existingReply) {
          // Update existing reply with the LATEST reply email
          const [updated] = await db
            .update(emailReplies)
            .set({
              replyEmailId: inboundEmail.id, // Update to latest reply
              // Reset classification - will be reclassified below
              intent: null,
              sentiment: null,
            })
            .where(eq(emailReplies.id, existingReply.id))
            .returning({ id: emailReplies.id })

          emailReply = updated
          logger.info({
            msg: "✅ [WEBHOOK] email_replies record UPDATED with latest reply",
            emailReplyId: emailReply?.id,
            originalEmailId: originalEmail.id,
            newReplyEmailId: inboundEmail.id,
            threadId: inboundEmail.threadId,
          })
        } else {
          // Create new email_replies record for this thread
          const [inserted] = await db
            .insert(emailReplies)
            .values({
              workspaceId: originalEmail.workspaceId,
              originalEmailId: originalEmail.id,
              replyEmailId: inboundEmail.id,
              isRead: false,
            })
            .returning({ id: emailReplies.id })

          emailReply = inserted
          logger.info({
            msg: "✅ [WEBHOOK] email_replies record CREATED for new thread",
            emailReplyId: emailReply?.id,
            originalEmailId: originalEmail.id,
            replyEmailId: inboundEmail.id,
            workspaceId: originalEmail.workspaceId,
            threadId: inboundEmail.threadId,
          })
        }

        // AI classification (enabled by default, non-blocking - errors won't fail email ingestion)
        const classificationEnabled = process.env.AI_CLASSIFICATION_ENABLED !== "false"
        logger.info({
          msg: "🤖 [WEBHOOK] AI classification check",
          hasEmailReply: !!emailReply,
          classificationEnabled: classificationEnabled,
          willRunClassification: !!(emailReply && classificationEnabled),
        })

        if (emailReply && classificationEnabled) {
          logger.info({
            msg: "🚀 [WEBHOOK] Starting AI classification (async)",
            emailReplyId: emailReply.id,
          })

          this.classifyEmailReplyAsync(
            emailReply.id,
            inboundEmail.subject || "",
            inboundEmail.bodyText || inboundEmail.bodyHtml || "",
          ).catch((error) => {
            logger.error({
              err: error,
              emailReplyId: emailReply.id,
              msg: "❌ [WEBHOOK] AI classification failed, but email was still saved",
            })
          })
        }

        // 원본 이메일의 repliedAt 업데이트
        await db
          .update(emailsTable)
          .set({
            repliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailsTable.id, originalEmail.id))

        logger.info({
          msg: "✅ [WEBHOOK] Original email repliedAt updated",
          originalEmailId: originalEmail.id,
        })

        // 답장을 받은 경우, 해당 리드의 모든 active 시퀀스 enrollment를 중단
        if (inboundEmail.leadId) {
          try {
            const { sequenceEnrollments } = await import("../db/schema")

            // 1. 해당 리드의 모든 active enrollment 조회
            const activeEnrollments = await db
              .select({
                id: sequenceEnrollments.id,
                sequenceId: sequenceEnrollments.sequenceId,
              })
              .from(sequenceEnrollments)
              .where(
                and(
                  eq(sequenceEnrollments.leadId, inboundEmail.leadId),
                  eq(sequenceEnrollments.status, "active"),
                ),
              )

            if (activeEnrollments.length > 0) {
              logger.info({
                msg: "🛑 [WEBHOOK] Stopping all active enrollments for lead (reply received)",
                leadId: inboundEmail.leadId,
                leadName: inboundEmail.leadName,
                activeEnrollmentsCount: activeEnrollments.length,
                enrollmentIds: activeEnrollments.map((e) => e.id),
              })

              // 2. 모든 active enrollment를 stopped 상태로 변경
              await db
                .update(sequenceEnrollments)
                .set({
                  status: "stopped",
                  stoppedAt: new Date(),
                })
                .where(
                  and(
                    eq(sequenceEnrollments.leadId, inboundEmail.leadId),
                    eq(sequenceEnrollments.status, "active"),
                  ),
                )

              logger.info({
                msg: "✅ [WEBHOOK] All active enrollments stopped successfully",
                leadId: inboundEmail.leadId,
                stoppedCount: activeEnrollments.length,
              })

              // 3. 대기 중인 step executions도 스킵 처리
              const { sequenceStepExecutions } = await import("../db/schema")
              for (const enrollment of activeEnrollments) {
                await db
                  .update(sequenceStepExecutions)
                  .set({
                    status: "skipped",
                    errorMessage: "Skipped due to reply received",
                  })
                  .where(
                    and(
                      eq(sequenceStepExecutions.enrollmentId, enrollment.id),
                      eq(sequenceStepExecutions.status, "pending"),
                    ),
                  )
              }

              logger.info({
                msg: "✅ [WEBHOOK] Pending step executions skipped",
                leadId: inboundEmail.leadId,
              })
            } else {
              logger.debug({
                msg: "ℹ️  [WEBHOOK] No active enrollments found for this lead",
                leadId: inboundEmail.leadId,
              })
            }
          } catch (error) {
            logger.error({
              err: error,
              leadId: inboundEmail.leadId,
              msg: "❌ [WEBHOOK] Failed to stop active enrollments, but email was still processed",
            })
          }
        }
      } else {
        logger.warn({
          msg: "❌ [WEBHOOK] Original email NOT found - email_replies record NOT created",
          inReplyTo: headers.inReplyTo,
          inboundEmailId: inboundEmail.id,
          threadId: inboundEmail.threadId,
          workspaceId: account.workspaceId,
          searchedMessageId: headers.inReplyTo,
          reason: "No matching outbound email with this messageId in this workspace",
        })
      }
    } else {
      // In-Reply-To 헤더가 없는 경우
      logger.info({
        msg: "⚠️  [WEBHOOK] No In-Reply-To header - checking fallback options",
        inboundEmailId: inboundEmail.id,
        threadId: inboundEmail.threadId,
        hasLeadId: !!leadId,
        hasSequenceId: !!sequenceId,
      })

      // Fallback: leadId와 sequenceId가 있으면 최근 발송한 이메일 찾기
      if (leadId && sequenceId) {
        logger.info({
          msg: "🔍 [WEBHOOK] Attempting to find recent outbound email for this lead/sequence",
          leadId,
          sequenceId,
          inboundEmailId: inboundEmail.id,
        })

        // 최근 30일 이내에 해당 lead에게 보낸 outbound 이메일 중 가장 최근 것 찾기
        const recentOutboundResults = await db
          .select({
            id: emailsTable.id,
            workspaceId: emailsTable.workspaceId,
            messageId: emailsTable.messageId,
            threadId: emailsTable.threadId,
            subject: emailsTable.subject,
            direction: emailsTable.direction,
            sentAt: emailsTable.sentAt,
          })
          .from(emailsTable)
          .where(
            and(
              eq(emailsTable.leadId, leadId),
              eq(emailsTable.sequenceId, sequenceId),
              eq(emailsTable.direction, "outbound"),
              eq(emailsTable.workspaceId, account.workspaceId),
              sql`${emailsTable.sentAt} >= NOW() - INTERVAL '30 days'`,
            ),
          )
          .orderBy(desc(emailsTable.sentAt))
          .limit(1)

        const recentOutbound = recentOutboundResults[0]

        if (recentOutbound) {
          logger.info({
            msg: "✅ [WEBHOOK] Found recent outbound email - treating as reply",
            originalEmailId: recentOutbound.id,
            originalSentAt: recentOutbound.sentAt?.toISOString(),
            leadId,
            sequenceId,
            inboundEmailId: inboundEmail.id,
            daysSinceOriginal: recentOutbound.sentAt
              ? Math.floor(
                  (new Date().getTime() - new Date(recentOutbound.sentAt).getTime()) /
                    (1000 * 60 * 60 * 24),
                )
              : null,
          })

          // email_replies 레코드 생성 또는 업데이트
          const existingReplyResults = await db
            .select({ id: emailReplies.id })
            .from(emailReplies)
            .where(eq(emailReplies.originalEmailId, recentOutbound.id))
            .limit(1)

          const existingReply = existingReplyResults[0]
          let emailReply: { id: string } | undefined

          if (existingReply) {
            // Update existing reply with the LATEST reply email
            const [updated] = await db
              .update(emailReplies)
              .set({
                replyEmailId: inboundEmail.id,
                intent: null,
                sentiment: null,
              })
              .where(eq(emailReplies.id, existingReply.id))
              .returning({ id: emailReplies.id })

            emailReply = updated
            logger.info({
              msg: "✅ [WEBHOOK] email_replies record UPDATED (fallback method)",
              emailReplyId: emailReply?.id,
              originalEmailId: recentOutbound.id,
              newReplyEmailId: inboundEmail.id,
            })
          } else {
            // Create new email_replies record
            const [inserted] = await db
              .insert(emailReplies)
              .values({
                workspaceId: recentOutbound.workspaceId,
                originalEmailId: recentOutbound.id,
                replyEmailId: inboundEmail.id,
                isRead: false,
              })
              .returning({ id: emailReplies.id })

            emailReply = inserted
            logger.info({
              msg: "✅ [WEBHOOK] email_replies record CREATED (fallback method)",
              emailReplyId: emailReply?.id,
              originalEmailId: recentOutbound.id,
              replyEmailId: inboundEmail.id,
            })
          }

          // AI classification
          const classificationEnabled = process.env.AI_CLASSIFICATION_ENABLED !== "false"
          if (emailReply && classificationEnabled) {
            logger.info({
              msg: "🚀 [WEBHOOK] Starting AI classification (async, fallback)",
              emailReplyId: emailReply.id,
            })

            this.classifyEmailReplyAsync(
              emailReply.id,
              inboundEmail.subject || "",
              inboundEmail.bodyText || inboundEmail.bodyHtml || "",
            ).catch((error) => {
              logger.error({
                err: error,
                emailReplyId: emailReply.id,
                msg: "❌ [WEBHOOK] AI classification failed, but email was still saved",
              })
            })
          }

          // 원본 이메일의 repliedAt 업데이트
          await db
            .update(emailsTable)
            .set({
              repliedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(emailsTable.id, recentOutbound.id))

          logger.info({
            msg: "✅ [WEBHOOK] Original email repliedAt updated (fallback)",
            originalEmailId: recentOutbound.id,
          })

          // 해당 리드의 모든 active 시퀀스 enrollment를 중단
          if (inboundEmail.leadId) {
            try {
              const { sequenceEnrollments } = await import("../db/schema")

              const activeEnrollments = await db
                .select({
                  id: sequenceEnrollments.id,
                  sequenceId: sequenceEnrollments.sequenceId,
                })
                .from(sequenceEnrollments)
                .where(
                  and(
                    eq(sequenceEnrollments.leadId, inboundEmail.leadId),
                    eq(sequenceEnrollments.status, "active"),
                  ),
                )

              if (activeEnrollments.length > 0) {
                logger.info({
                  msg: "🛑 [WEBHOOK] Stopping all active enrollments for lead (fallback reply)",
                  leadId: inboundEmail.leadId,
                  activeEnrollmentsCount: activeEnrollments.length,
                })

                await db
                  .update(sequenceEnrollments)
                  .set({
                    status: "stopped",
                    stoppedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(sequenceEnrollments.leadId, inboundEmail.leadId),
                      eq(sequenceEnrollments.status, "active"),
                    ),
                  )

                // 대기 중인 step executions도 스킵 처리
                const { sequenceStepExecutions } = await import("../db/schema")
                for (const enrollment of activeEnrollments) {
                  await db
                    .update(sequenceStepExecutions)
                    .set({
                      status: "skipped",
                      errorMessage: "Skipped due to reply received (fallback detection)",
                    })
                    .where(
                      and(
                        eq(sequenceStepExecutions.enrollmentId, enrollment.id),
                        eq(sequenceStepExecutions.status, "pending"),
                      ),
                    )
                }

                logger.info({
                  msg: "✅ [WEBHOOK] Active enrollments stopped and pending steps skipped (fallback)",
                  leadId: inboundEmail.leadId,
                })
              }
            } catch (error) {
              logger.error({
                err: error,
                leadId: inboundEmail.leadId,
                msg: "❌ [WEBHOOK] Failed to stop active enrollments (fallback), but email was still processed",
              })
            }
          }
        } else {
          logger.info({
            msg: "ℹ️  [WEBHOOK] No recent outbound email found for this lead in past 30 days",
            leadId,
            sequenceId,
            inboundEmailId: inboundEmail.id,
          })
        }
      } else {
        logger.info({
          msg: "ℹ️  [WEBHOOK] Cannot use fallback - missing leadId or sequenceId",
          inboundEmailId: inboundEmail.id,
          hasLeadId: !!leadId,
          hasSequenceId: !!sequenceId,
        })
      }
    }
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

    const shortMessageId = event.sg_message_id.split(".")[0] as string

    const emailResults = await db
      .select({ id: emailsTable.id, status: emailsTable.status })
      .from(emailsTable)
      .where(eq(emailsTable.sendgridMessageId, shortMessageId))
      .limit(1)

    if (emailResults.length === 0) {
      logger.warn(
        {
          originalSgMessageId: event.sg_message_id,
          shortMessageId: shortMessageId,
        },
        "Email not found for event",
      )
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
        // Update sequence step execution status to delivered
        await this.updateSequenceStepExecutionStatus(emailId, "delivered")
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
        // Update sequence step execution status to failed
        await this.updateSequenceStepExecutionStatus(
          emailId,
          "failed",
          `Bounced: ${event.reason || "Unknown reason"}`,
        )
        break
      case "dropped":
      case "deferred":
        updates.status = "failed"
        updates.errorMessage = event.reason
        // Update sequence step execution status to failed
        await this.updateSequenceStepExecutionStatus(
          emailId,
          "failed",
          event.reason || "Email dropped or deferred",
        )
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

  private async updateSequenceStepExecutionStatus(
    emailId: string,
    status: "delivered" | "failed",
    errorMessage?: string,
  ) {
    try {
      // Find sequence step execution by email ID
      const { sequenceStepExecutions } = await import("../db/schema/sequences")
      const { updateStepExecutionStatus } = await import("../services/sequence.service")

      const executionResults = await db
        .select({ id: sequenceStepExecutions.id })
        .from(sequenceStepExecutions)
        .where(eq(sequenceStepExecutions.emailId, emailId))
        .limit(1)

      if (executionResults.length > 0) {
        const execution = executionResults[0]
        if (execution) {
          await updateStepExecutionStatus(execution.id, status, errorMessage)
          logger.info(
            { emailId, executionId: execution.id, status },
            "Sequence step execution status updated",
          )
        }
      }
    } catch (error) {
      logger.error({ error, emailId, status }, "Failed to update sequence step execution status")
    }
  }

  /**
   * Classify email reply using AI (async, non-blocking) with retry logic
   */
  private async classifyEmailReplyAsync(
    emailReplyId: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info({ emailReplyId, attempt }, "Starting AI classification")

        const aiService = getAIClassificationService()
        const classification = await aiService.classifyReply({
          subject,
          body,
        })

        // Update email_replies with classification results
        await db
          .update(emailReplies)
          .set({
            intent: classification.intent,
            sentiment: classification.sentiment as
              | "positive"
              | "neutral"
              | "negative"
              | "interested"
              | "not_interested",
          })
          .where(eq(emailReplies.id, emailReplyId))

        logger.info(
          {
            emailReplyId,
            attempt,
            intent: classification.intent,
            sentiment: classification.sentiment,
            confidence: classification.confidence,
          },
          "AI classification completed and saved",
        )

        // Success - exit retry loop
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        logger.warn({
          err: lastError,
          emailReplyId,
          attempt,
          maxRetries,
          msg: `AI classification attempt ${attempt} failed`,
        })

        // If not the last attempt, wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delayMs = 2 ** (attempt - 1) * 1000 // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }

    // All retries exhausted
    logger.error({
      err: lastError,
      emailReplyId,
      attempts: maxRetries,
      msg: "AI classification failed after all retry attempts - email saved without classification",
    })
    // Don't throw - classification failure shouldn't break email processing
  }
}

export const webhookService = new WebhookService()
