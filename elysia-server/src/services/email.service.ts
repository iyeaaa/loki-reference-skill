import sgMail from '@sendgrid/mail'
import { getAIEmailService, type EmailContext } from '../lib/ai-email-service'
import { decodeBase64 } from '../utils/string.util'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

class EmailService {
  async sendAutoReply(
    _toEmail: string,
    fromEmail: string,
    subject: string,
    emailContent: string,
    inReplyTo?: string,
    references?: string[]
  ): Promise<boolean> {
    try {
      const aiService = getAIEmailService()
      const emailContext: EmailContext = {
        fromEmail,
        subject,
        content: emailContent,
        receivedTime: new Date()
      }

      console.log('🤖 AI 응답 생성 중...')
      const aiResponse = await aiService.generateEmailReply(emailContext)

      let replyText: string

      if (aiResponse.success && aiResponse.replyContent) {
        replyText = aiResponse.replyContent
        console.log('✅ AI 응답 사용')
      } else {
        console.log('⚠️ AI 응답 실패, 기본 템플릿 사용:', aiResponse.error)
        replyText = aiService.generateFallbackReply(emailContext)
      }

      const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 11)}@partners.grinda.ai>`

      const headers: Record<string, string> = {
        'Message-ID': messageId
      }

      if (inReplyTo) {
        headers['In-Reply-To'] = inReplyTo
      }

      if (references && references.length > 0) {
        headers['References'] = references.join(' ')
      }

      const msg = {
        to: fromEmail,
        from: {
          email: 'rinda@partners.grinda.ai',
          name: 'Rinda Expert - 그린다에이아이'
        },
        replyTo: 'rinda@partners.grinda.ai',
        subject: `Re: ${subject || '문의 감사합니다'}`,
        text: replyText,
        headers,
        trackingSettings: {
          clickTracking: {
            enable: true,
            enableText: true
          },
          openTracking: {
            enable: true
          },
          subscriptionTracking: {
            enable: false
          }
        }
      }

      await sgMail.send(msg)
      console.log(`✅ 자동 답장 이메일 발송 성공: ${fromEmail}`)
      return true
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ 자동 답장 이메일 발송 실패:', error.message)
        if ('response' in error && error.response) {
          console.error('에러 상세:', (error.response as { body?: unknown }).body)
        }
      } else {
        console.error('❌ 자동 답장 이메일 발송 실패:', error)
      }
      return false
    }
  }

  async processAttachments(
    attachmentsJson: string,
    attachmentInfo?: string
  ): Promise<{ filename: string; content: string }[]> {
    console.log('\n📎 [첨부파일 정보]')
    console.log('├─ attachment-info:', attachmentInfo || '없음')

    interface Attachment {
      filename: string
      type: string
      content?: string
    }

    if (attachmentInfo) {
      try {
        const parsedInfo = JSON.parse(attachmentInfo)
        console.log('├─ 파싱된 attachment-info:')
        Object.entries(parsedInfo).forEach(([key, value]) => {
          console.log(`│  └─ ${key}:`, value)
        })
      } catch {
        console.log('├─ attachment-info 파싱 실패')
      }
    }

    try {
      const attachments = JSON.parse(attachmentsJson || '[]') as Attachment[]
      const decodedAttachments = attachments.map((attachment: Attachment) => {
        console.log(`├─ 첨부파일: ${attachment.filename}`)
        console.log(`│  └─ 타입: ${attachment.type}`)
        console.log(`│  └─ 크기: ${attachment.content ? attachment.content.length : 0}자`)

        const decodedContent = attachment.content ? decodeBase64(attachment.content) : null

        return {
          ...attachment,
          content: decodedContent
        }
      })

      const parsedAttachments = decodedAttachments.filter(
        (att) => att.content !== null
      ) as { filename: string; content: string }[]

      if (parsedAttachments.length > 0) {
        console.log(`└─ ✅ 디코딩 성공: ${parsedAttachments.length}/${attachments.length}개 파일`)
      }

      return parsedAttachments
    } catch {
      console.log('└─ ❌ 첨부파일 처리 중 오류 발생')
      return []
    }
  }

  extractEmailContent(text?: string, html?: string, rawEmail?: string): string {
    let emailContent = text || ''

    if (!emailContent && html) {
      emailContent = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    if (!emailContent && rawEmail) {
      const plainTextMatch = rawEmail.match(
        /Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i
      )
      if (plainTextMatch?.[1]) {
        const extractedText = plainTextMatch[1].trim()
        const decodedText = decodeBase64(extractedText)
        if (decodedText) {
          emailContent = decodedText.trim()
        } else if (extractedText && !extractedText.match(/^[A-Za-z0-9+/=\s]+$/)) {
          emailContent = extractedText.trim()
        }
      }

      if (!emailContent) {
        const base64BodyMatch = rawEmail.match(
          /Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([\s\S]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i
        )
        if (base64BodyMatch?.[1]) {
          const decodedContent = decodeBase64(base64BodyMatch[1].trim())
          if (decodedContent) {
            emailContent = decodedContent.trim()
          }
        }
      }
    }

    emailContent = emailContent.trim()

    if (!emailContent || emailContent.includes('�')) {
      emailContent = '(내용을 확인할 수 없습니다. 원본 이메일을 확인해 주세요.)'
    }

    return emailContent
  }
}

export const emailService = new EmailService()