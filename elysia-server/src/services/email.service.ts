import sgMail from "@sendgrid/mail"
import { and, eq } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailSignatures } from "../db/schema/email-signatures"
import { userSignaturePreferences } from "../db/schema/user-signature-preferences"
import { departments, users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import type { Attachment, SendGridAttachment } from "../models/email.model"
import { htmlToText } from "../utils/email.util"
import logger from "../utils/logger"
import * as nylasService from "./nylas.service"

class EmailService {
  constructor() {
    if (config.sendgrid.apiKey) {
      sgMail.setApiKey(config.sendgrid.apiKey)
    }
  }

  async processAttachments(
    attachmentsJson: string,
    attachmentInfo?: string,
  ): Promise<Attachment[]> {
    try {
      const attachmentsCount = JSON.parse(attachmentsJson)
      const parsedAttachments: Attachment[] = []

      if (attachmentInfo) {
        const attachmentInfoParsed = JSON.parse(attachmentInfo)

        for (let i = 1; i <= attachmentsCount; i++) {
          const info = attachmentInfoParsed[`attachment${i}`]
          if (info) {
            parsedAttachments.push({
              filename: info.filename || `attachment${i}`,
              type: info.type || "application/octet-stream",
              size: Number.parseInt(info["content-length"] || "0", 10),
            })
          }
        }
      }

      return parsedAttachments
    } catch (error) {
      logger.error({ err: error }, "Failed to parse attachments")
      return []
    }
  }

  extractEmailContent(text?: string, html?: string, email?: string): string {
    if (text) return text
    if (html) return html
    if (email) return email
    return ""
  }

  // Generate email signature from user data
  async generateUserSignature(
    userId: string,
    workspaceId?: string, // 선택적 (워크스페이스 무관)
  ): Promise<{
    signatureHtml: string
    signatureText: string
  }> {
    try {
      // First, try to get the default signature from user_signature_preferences
      const [preference] = await db
        .select({
          signature: emailSignatures,
        })
        .from(userSignaturePreferences)
        .innerJoin(emailSignatures, eq(userSignaturePreferences.signatureId, emailSignatures.id))
        .where(and(eq(userSignaturePreferences.userId, userId), eq(emailSignatures.isActive, true)))
        .limit(1)

      if (preference) {
        logger.info(
          { userId, signatureId: preference.signature.id },
          "Using user's default signature from database",
        )
        return {
          signatureHtml: preference.signature.signatureHtml,
          signatureText: preference.signature.signatureText,
        }
      }

      // Fallback: Get user info with department and workspace to generate signature
      // workspaceId가 없으면 기본 서명만 반환
      if (!workspaceId) {
        logger.info({ userId }, "No workspaceId provided, using default signature")
        const defaultHtml = "<p>Best regards,<br>Your Team</p>"
        return {
          signatureHtml: defaultHtml,
          signatureText: htmlToText(defaultHtml),
        }
      }

      const [userInfo] = await db
        .select({
          username: users.username,
          email: users.email,
          departmentName: departments.name,
          workspaceName: workspaces.name,
          displayName: userEmailAccounts.displayName,
        })
        .from(users)
        .innerJoin(departments, eq(users.departmentId, departments.id))
        .innerJoin(workspaces, eq(workspaces.id, workspaceId))
        .leftJoin(
          userEmailAccounts,
          eq(userEmailAccounts.userId, users.id) && eq(userEmailAccounts.workspaceId, workspaceId),
        )
        .where(eq(users.id, userId))
        .limit(1)

      if (!userInfo) {
        logger.warn(
          { userId, workspaceId },
          "User info not found for signature generation, using default",
        )
        return this.generateGrindaSignature("김규동 Gyudong Kim", "Project Lead")
      }

      const { username, departmentName, displayName } = userInfo
      const name = displayName || username
      const title = departmentName

      logger.info({ userId, workspaceId }, "No signature in database, generating from user info")
      return this.generateGrindaSignature(name, title)
    } catch (error) {
      logger.error({ err: error, userId, workspaceId }, "Failed to generate user signature")
      return { signatureHtml: "", signatureText: "" }
    }
  }

  // Generate hardcoded email signature
  generateGrindaSignature(
    name: string,
    title: string,
  ): {
    signatureHtml: string
    signatureText: string
  } {
    // HTML signature
    const signatureHtml = `
      <div dir="ltr">
        <font face="tahoma, sans-serif">---</font>
        <div>
          <font face="tahoma, sans-serif">
            <img width="200" height="40" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wmbav037hCfz80GR6E4h7flMNvTFaW2MHfrLwEDxzoBQv47zi5AijTZvapZhWOPSY3lexM6IgALCnW" loading="lazy">
            <br>
          </font>
        </div>
        <div>
          <b><font size="4" face="tahoma, sans-serif">${name}</font></b>
        </div>
        <div>
          <b><font face="tahoma, sans-serif">주식회사 그린다에이아이&nbsp; |&nbsp; ${title}</font></b>
        </div>
        <div><font face="tahoma, sans-serif"><br></font></div>
        <div>
          <font color="#999999" face="tahoma, sans-serif">
            <b>Add.</b> 대전광역시 유성구 대학로 99 대전 팁스타운 502
          </font>
        </div>
        <div>
          <font color="#999999" face="tahoma, sans-serif">
            (99, Daehak-ro, Yuseong-gu, Daejeon, Republic of Korea)
          </font>
        </div>
        <div>
          <font color="#999999" face="tahoma, sans-serif">
            <b>Tel.</b> 010-8351-6129
          </font>
        </div>
        <div>
          <font color="#999999" face="tahoma, sans-serif">
            <b>Web.</b> <a href="http://www.grinda.ai" target="_blank" rel="noreferrer noopener">www.grinda.ai</a>
          </font>
        </div>
        <div><font face="tahoma, sans-serif"><br></font></div>
        <div>
          <font face="tahoma, sans-serif">
            <span style="color:rgb(140,140,140);font-size:9px">
              본 메일에는 법률상 보호되는 영업비밀이나 비밀유지서약서에 따라 보호되는 비밀정보가 포함되어 있습니다. 이에 포함된 내용은 보안을 유지하여야 하며 본 문서에 포함된 정보의 전부 또는 일부를 무단으로 제3자에게 공개, 배포, 복사 또는 사용하는 것은 엄격히 금지됩니다. 본 메일이 잘못 전송된 경우, 발신인 또는 당사에 알려주시고, 본 메일 및 첨부문서를 즉시 삭제하여 주시기 바랍니다. 또한 본 메일의 법률상 안전성과 바이러스가 없음을 보장하지 않으며, 타인에 의한 본 메일의 변경에 대하여 책임지지 않습니다.
            </span>
            <br style="color:rgb(140,140,140);font-size:9px">
            <span style="color:rgb(140,140,140);font-size:9px">
              This email contains confidential information that is protected by law or under the confidentiality agreements. Any information contained herein shall be kept secure and any unauthorized disclosure, distribution, copying or use of any or all of the information contained herein to any third party is strictly prohibited. If this email is sent incorrectly, please notify the sender or us and delete this email and attachments immediately. In addition, the law of this mail does not guarantee safety and virus-free, and we are not responsible for any changes made to this mail by others.
            </span>
          </font>
        </div>
      </div>
    `.trim()

    // Text signature
    const signatureText = `
${name}
주식회사 그린다에이아이  |  ${title}

Add. 대전광역시 유성구 대학로 99 대전 팁스타운 502
(99, Daehak-ro, Yuseong-gu, Daejeon, Republic of Korea)
Tel. 010-8351-6129
Web. www.grinda.ai

본 메일에는 법률상 보호되는 영업비밀이나 비밀유지서약서에 따라 보호되는 비밀정보가 포함되어 있습니다. 이에 포함된 내용은 보안을 유지하여야 하며 본 문서에 포함된 정보의 전부 또는 일부를 무단으로 제3자에게 공개, 배포, 복사 또는 사용하는 것은 엄격히 금지됩니다. 본 메일이 잘못 전송된 경우, 발신인 또는 당사에 알려주시고, 본 메일 및 첨부문서를 즉시 삭제하여 주시기 바랍니다. 또한 본 메일의 법률상 안전성과 바이러스가 없음을 보장하지 않으며, 타인에 의한 본 메일의 변경에 대하여 책임지지 않습니다.
This email contains confidential information that is protected by law or under the confidentiality agreements. Any information contained herein shall be kept secure and any unauthorized disclosure, distribution, copying or use of any or all of the information contained herein to any third party is strictly prohibited. If this email is sent incorrectly, please notify the sender or us and delete this email and attachments immediately. In addition, the law of this mail does not guarantee safety and virus-free, and we are not responsible for any changes made to this mail by others.
    `.trim()

    return { signatureHtml, signatureText }
  }

  // Append signature to email content
  appendSignatureToEmail(
    emailContent: string,
    signatureHtml: string,
    signatureText: string,
    isHtml: boolean = true,
  ): string {
    if (isHtml) {
      // For HTML emails, append the signature HTML
      return `${emailContent}\n\n${signatureHtml}`
    } else {
      // For text emails, use the text signature
      return `${emailContent}\n\n---\n${signatureText}`
    }
  }

  async sendEmail(data: {
    fromEmail: string
    fromName?: string
    toEmail: string
    subject: string
    bodyText?: string
    bodyHtml?: string
    ccEmails?: string[]
    bccEmails?: string[]
    replyTo?: string
    inReplyTo?: string
    references?: string[]
    attachments?: SendGridAttachment[] // 첨부 파일 (Base64 인코딩된 파일)
    apiKey?: string // SendGrid API Key (starts with "SG") OR Nylas grantId
    includeSignature?: boolean // 서명 포함 여부 (기본값: true)
    userId?: string // 서명 생성을 위한 사용자 ID
    workspaceId?: string // 서명 생성을 위한 워크스페이스 ID
    signatureHtml?: string // 직접 지정한 서명 HTML (이 값이 있으면 이걸 우선 사용)
  }): Promise<{
    success: boolean
    messageId?: string
    sendgridMessageId?: string
    nylasMessageId?: string
    nylasThreadId?: string
    error?: string
  }> {
    try {
      const apiKey = data.apiKey || config.sendgrid.apiKey

      // Trial preview emails - don't actually send, return mock success
      // These are preview emails created during trial signup with dummy apiKey
      if (apiKey === "TRIAL_PREVIEW") {
        logger.info(
          { toEmail: data.toEmail, subject: data.subject },
          "Skipping email send - trial preview mode (apiKey=TRIAL_PREVIEW)",
        )
        return {
          success: false,
          error:
            "Trial preview mode - email not sent. Please configure a real email account to send emails.",
        }
      }

      // Route to Nylas if apiKey doesn't start with "SG" (it's a Nylas grantId)
      if (apiKey && !apiKey.startsWith("SG")) {
        return await this.sendEmailViaNylas(data, apiKey)
      }

      if (!apiKey) {
        return {
          success: false,
          error: "SendGrid API Key가 설정되지 않았습니다.",
        }
      }

      // API Key 설정 (요청별로 다를 수 있음)
      if (data.apiKey) {
        sgMail.setApiKey(data.apiKey)
      }

      // RFC 2822 Message-ID 생성 (답장 추적을 위해 필요)
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const domain = data.fromEmail.split("@")[1] || "mail.grinda.ai"
      const generatedMessageId = `<${timestamp}.${randomString}@${domain}>`

      const msg = {
        to: data.toEmail,
        from: {
          email: data.fromEmail,
          name: data.fromName || data.fromEmail,
        },
        subject: data.subject,
        headers: {} as Record<string, string>,
        text: undefined as string | undefined,
        html: undefined as string | undefined,
        cc: undefined as string[] | undefined,
        bcc: undefined as string[] | undefined,
        replyTo: undefined as string | undefined,
        attachments: undefined as SendGridAttachment[] | undefined,
      }

      // Message-ID 헤더 추가 (답장 추적용)
      msg.headers["Message-ID"] = generatedMessageId

      // 서명 추가 (기본값: true)
      const includeSignature = data.includeSignature !== false
      let finalBodyText = data.bodyText
      let finalBodyHtml = data.bodyHtml

      if (includeSignature) {
        try {
          let signatureHtml = ""
          let signatureText = ""

          // 직접 지정한 서명이 있으면 우선 사용
          if (data.signatureHtml) {
            signatureHtml = data.signatureHtml
            signatureText = htmlToText(data.signatureHtml)
            logger.info(
              { userId: data.userId, workspaceId: data.workspaceId },
              "Using provided signature HTML",
            )
          } else if (data.userId && data.workspaceId) {
            // Use user data to generate signature
            const userSignature = await this.generateUserSignature(data.userId, data.workspaceId)
            signatureHtml = userSignature.signatureHtml
            signatureText = userSignature.signatureText
          } else {
            // Fallback to default signature
            const defaultSignature = this.generateGrindaSignature(
              "김규동 Gyudong Kim",
              "Project Lead",
            )
            signatureHtml = defaultSignature.signatureHtml
            signatureText = defaultSignature.signatureText
          }

          if (finalBodyHtml) {
            finalBodyHtml = this.appendSignatureToEmail(
              finalBodyHtml,
              signatureHtml,
              signatureText,
              true,
            )
          }
          if (finalBodyText) {
            finalBodyText = this.appendSignatureToEmail(
              finalBodyText,
              signatureHtml,
              signatureText,
              false,
            )
          }
        } catch (error) {
          logger.warn({ err: error }, "Failed to add signature to email")
          // 서명 추가 실패해도 이메일 전송은 계속 진행
        }
      }

      // 본문 설정
      if (finalBodyText) {
        msg.text = finalBodyText
      }
      if (finalBodyHtml) {
        msg.html = finalBodyHtml
      }

      // CC/BCC 설정
      if (data.ccEmails && data.ccEmails.length > 0) {
        msg.cc = data.ccEmails
      }
      if (data.bccEmails && data.bccEmails.length > 0) {
        msg.bcc = data.bccEmails
      }

      // 답장 관련 헤더 설정
      if (data.replyTo) {
        msg.replyTo = data.replyTo
      }
      if (data.inReplyTo) {
        msg.headers["In-Reply-To"] = data.inReplyTo
      }
      if (data.references && data.references.length > 0) {
        msg.headers.References = data.references.join(" ")
      }

      // 첨부 파일 설정
      if (data.attachments && data.attachments.length > 0) {
        msg.attachments = data.attachments
        logger.info({ attachmentCount: data.attachments.length }, "Sending email with attachments")
      }

      const response = await sgMail.send(msg as never)

      // SendGrid 응답에서 x-message-id 추출
      const sendgridMessageId = response[0]?.headers["x-message-id"] || undefined

      return {
        success: true,
        messageId: generatedMessageId, // 우리가 생성한 Message-ID (답장 추적용)
        sendgridMessageId, // SendGrid의 내부 ID
      }
    } catch (error: unknown) {
      logger.error({ err: error }, "Failed to send email")
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      }
    } finally {
      // API Key 원복 (다른 요청에 영향 없도록)
      if (data.apiKey && config.sendgrid.apiKey) {
        sgMail.setApiKey(config.sendgrid.apiKey)
      }
    }
  }

  /**
   * Send email via Nylas
   * Used when apiKey is a Nylas grantId (doesn't start with "SG")
   */
  private async sendEmailViaNylas(
    data: {
      fromEmail: string
      fromName?: string
      toEmail: string
      subject: string
      bodyText?: string
      bodyHtml?: string
      ccEmails?: string[]
      bccEmails?: string[]
      inReplyTo?: string
      attachments?: SendGridAttachment[]
      includeSignature?: boolean
      userId?: string
      workspaceId?: string
      signatureHtml?: string
    },
    grantId: string,
  ): Promise<{
    success: boolean
    messageId?: string
    sendgridMessageId?: string
    nylasMessageId?: string
    nylasThreadId?: string
    error?: string
  }> {
    try {
      // Generate Message-ID for tracking
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const domain = data.fromEmail.split("@")[1] || "mail.grinda.ai"
      const generatedMessageId = `<${timestamp}.${randomString}@${domain}>`

      // Handle signature (reuse existing logic)
      let finalBodyHtml = data.bodyHtml || ""
      const includeSignature = data.includeSignature !== false

      if (includeSignature) {
        try {
          let signatureHtml = ""

          if (data.signatureHtml) {
            signatureHtml = data.signatureHtml
          } else if (data.userId && data.workspaceId) {
            const userSignature = await this.generateUserSignature(data.userId, data.workspaceId)
            signatureHtml = userSignature.signatureHtml
          } else {
            const defaultSignature = this.generateGrindaSignature(
              "김규동 Gyudong Kim",
              "Project Lead",
            )
            signatureHtml = defaultSignature.signatureHtml
          }

          if (finalBodyHtml && signatureHtml) {
            finalBodyHtml = this.appendSignatureToEmail(finalBodyHtml, signatureHtml, "", true)
          }
        } catch (error) {
          logger.warn({ err: error }, "Failed to add signature to Nylas email")
        }
      }

      // Convert CC/BCC to Nylas format: string[] → { email, name }[]
      const cc = data.ccEmails?.map((email) => ({ email }))
      const bcc = data.bccEmails?.map((email) => ({ email }))

      // Convert attachments to Nylas format
      // SendGrid: { content, filename, type, disposition, content_id }
      // Nylas: { content, filename, contentType, isInline, contentId, contentDisposition }
      const nylasAttachments = data.attachments?.map((att) => ({
        content: att.content,
        filename: att.filename,
        contentType: att.type || "application/octet-stream",
        isInline: att.disposition === "inline",
        contentId: att.content_id,
        contentDisposition: att.disposition,
      }))

      // Send via Nylas
      const result = await nylasService.sendEmail({
        grantId,
        to: [{ email: data.toEmail, name: data.fromName }],
        subject: data.subject,
        body: finalBodyHtml || data.bodyText || "",
        cc,
        bcc,
        replyToMessageId: data.inReplyTo,
        attachments: nylasAttachments,
        trackingLabel: data.workspaceId,

        // Disable tracking for now ( until google oauth application satisfied inproduction rules )
        disableTracking: true,
      })

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to send email via Nylas",
        }
      }

      logger.info(
        {
          grantId,
          nylasMessageId: result.messageId,
          nylasThreadId: result.threadId,
          generatedMessageId,
        },
        "Email sent via Nylas successfully",
      )

      return {
        success: true,
        messageId: generatedMessageId,
        sendgridMessageId: result.messageId, // Store Nylas messageId in sendgridMessageId for webhook matching
        nylasMessageId: result.messageId,
        nylasThreadId: result.threadId,
      }
    } catch (error) {
      logger.error({ err: error, grantId }, "Failed to send email via Nylas")
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email via Nylas",
      }
    }
  }

  async sendAutoReply(
    _from: string,
    to: string,
    subject: string,
    _originalContent: string,
    inReplyTo?: string,
    references?: string[],
  ): Promise<boolean> {
    try {
      if (!config.sendgrid.apiKey) {
        logger.warn("SendGrid API Key not configured")
        return false
      }

      const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`

      const msg = {
        to,
        from: {
          email: config.sendgrid.fromEmail,
          name: config.sendgrid.fromName,
        },
        subject: replySubject,
        text: `안녕하세요,\n\n메일을 잘 받았습니다. 확인 후 회신드리겠습니다.\n\n감사합니다.`,
        html: `<p>안녕하세요,</p><p>메일을 잘 받았습니다. 확인 후 회신드리겠습니다.</p><p>감사합니다.</p>`,
        headers: {
          ...(inReplyTo && { "In-Reply-To": inReplyTo }),
          ...(references && references.length > 0 && { References: references.join(" ") }),
        },
      }

      await sgMail.send(msg)
      return true
    } catch (error) {
      logger.error({ err: error }, "Failed to send auto-reply")
      return false
    }
  }
}

export const emailService = new EmailService()
