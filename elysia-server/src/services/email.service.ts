import sgMail from '@sendgrid/mail'
import { config } from '../config'
import type { Attachment } from '../models/email.model'

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
              type: info.type || 'application/octet-stream',
              size: Number.parseInt(info['content-length'] || '0', 10),
            })
          }
        }
      }

      return parsedAttachments
    } catch (error) {
      console.error('첨부파일 파싱 중 오류:', error)
      return []
    }
  }

  extractEmailContent(text?: string, html?: string, email?: string): string {
    if (text) return text
    if (html) return html
    if (email) return email
    return ''
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
    apiKey?: string // 특정 계정의 API Key 사용
  }): Promise<{ success: boolean; messageId?: string; sendgridMessageId?: string; error?: string }> {
    try {
      const apiKey = data.apiKey || config.sendgrid.apiKey
      if (!apiKey) {
        return {
          success: false,
          error: 'SendGrid API Key가 설정되지 않았습니다.',
        }
      }

      // API Key 설정 (요청별로 다를 수 있음)
      if (data.apiKey) {
        sgMail.setApiKey(data.apiKey)
      }

      // RFC 2822 Message-ID 생성 (답장 추적을 위해 필요)
      const timestamp = Date.now()
      const randomString = Math.random().toString(36).substring(2, 15)
      const domain = data.fromEmail.split('@')[1] || 'mail.grinda.ai'
      const generatedMessageId = `<${timestamp}.${randomString}@${domain}>`

      const msg: any = {
        to: data.toEmail,
        from: {
          email: data.fromEmail,
          name: data.fromName || data.fromEmail,
        },
        subject: data.subject,
        headers: {},
      }

      // Message-ID 헤더 추가 (답장 추적용)
      msg.headers['Message-ID'] = generatedMessageId

      // 본문 설정
      if (data.bodyText) {
        msg.text = data.bodyText
      }
      if (data.bodyHtml) {
        msg.html = data.bodyHtml
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
        msg.headers['In-Reply-To'] = data.inReplyTo
      }
      if (data.references && data.references.length > 0) {
        msg.headers.References = data.references.join(' ')
      }

      const response = await sgMail.send(msg)

      // SendGrid 응답에서 x-message-id 추출
      const sendgridMessageId = response[0]?.headers['x-message-id'] || undefined

      return {
        success: true,
        messageId: generatedMessageId, // 우리가 생성한 Message-ID (답장 추적용)
        sendgridMessageId, // SendGrid의 내부 ID
      }
    } catch (error: any) {
      console.error('이메일 발송 실패:', error)
      return {
        success: false,
        error: error.message || '이메일 발송 중 오류가 발생했습니다.',
      }
    } finally {
      // API Key 원복 (다른 요청에 영향 없도록)
      if (data.apiKey && config.sendgrid.apiKey) {
        sgMail.setApiKey(config.sendgrid.apiKey)
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
        console.log('SendGrid API Key가 설정되지 않았습니다.')
        return false
      }

      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`

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
          ...(inReplyTo && { 'In-Reply-To': inReplyTo }),
          ...(references && references.length > 0 && { References: references.join(' ') }),
        },
      }

      await sgMail.send(msg)
      return true
    } catch (error) {
      console.error('자동 답장 발송 실패:', error)
      return false
    }
  }
}

export const emailService = new EmailService()
