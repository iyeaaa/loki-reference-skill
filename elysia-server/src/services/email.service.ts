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
