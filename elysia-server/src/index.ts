import { Elysia, t } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { PostDrizzleService } from './services/post-drizzle.service'
import { migrateDatabase } from './db/migrate'
import { emails } from './lib/email-storage'
import sgMail from '@sendgrid/mail'
import busboy from 'busboy'
import { Readable } from 'stream'
import { getAIEmailService, type EmailContext } from './lib/ai-email-service'

// Initialize database
migrateDatabase().catch(console.error)

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const postService = new PostDrizzleService()

// Helper functions
function decodeBase64(str: string): string | null {
  try {
    const cleanStr = str.replace(/[\r\n\s]/g, '')
    const decoded = Buffer.from(cleanStr, 'base64').toString('utf-8')
    if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
      return decoded
    }
    return null
  } catch {
    return null
  }
}

async function sendAutoReply(
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

    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 11)}@partners.grinda.ai}`

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

interface FormData {
  [key: string]: string | undefined
}

interface FileData {
  fieldname: string
  originalname: string
  mimetype: string
  buffer: Buffer
  size: number
}

function parseMultipartFormData(
  contentType: string | null,
  body: ArrayBuffer
): Promise<{ formData: FormData; files: FileData[] }> {
  return new Promise((resolve, reject) => {
    const formData: FormData = {}
    const files: FileData[] = []

    const bb = busboy({
      headers: {
        'content-type': contentType || ''
      }
    })

    bb.on('field', (name: string, value: string) => {
      formData[name] = value
    })

    bb.on('file', (name: string, stream: NodeJS.ReadableStream, info: any) => {
      const chunks: Buffer[] = []

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      stream.on('end', () => {
        files.push({
          fieldname: name,
          originalname: info.filename,
          mimetype: info.mimeType,
          buffer: Buffer.concat(chunks),
          size: Buffer.concat(chunks).length
        })
      })
    })

    bb.on('finish', () => {
      resolve({ formData, files })
    })

    bb.on('error', (err: Error) => {
      reject(err)
    })

    const nodeStream = Readable.from(Buffer.from(body))
    nodeStream.pipe(bb)
  })
}

const app = new Elysia()
  .use(cors())
  .use(swagger({
    documentation: {
      info: {
        title: 'Bulletin Board API',
        version: '1.0.0',
        description: 'Simple CRUD API for bulletin board'
      }
    }
  }))
  .get('/', () => 'Bulletin Board API')

  // Health check endpoint
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))

  // API Health endpoint
  .get('/api/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString()
  }))

  // Emails endpoint
  .get('/api/emails', () => {
    return {
      count: emails.length,
      emails: emails.slice(-50)
    }
  })

  // Webhook inbound endpoint
  .post('/api/webhook/inbound', async ({ request }) => {
    console.log('\n========================================')
    console.log('         새 이메일 수신 알림')
    console.log('========================================')
    console.log('📅 수신 시간:', new Date().toISOString())

    try {
      const contentType = request.headers.get('content-type')
      const arrayBuffer = await request.arrayBuffer()
      const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

      // Message-ID와 References 헤더 추출
      let messageId: string | undefined
      let inReplyTo: string | undefined
      let references: string[] = []

      if (body.headers) {
        try {
          const headers = JSON.parse(body.headers)
          messageId = headers['Message-ID'] || headers['message-id']
          inReplyTo = headers['In-Reply-To'] || headers['in-reply-to']
          const referencesStr = headers['References'] || headers['references']
          if (referencesStr) {
            references = referencesStr.split(/\s+/).filter((ref: string) => ref.length > 0)
          }
        } catch (e) {
          console.log('헤더 파싱 실패:', e)
        }
      }

      console.log('\n📧 [이메일 기본 정보]')
      console.log('├─ From:', body.from || '없음')
      console.log('├─ To:', body.to || '없음')
      console.log('├─ CC:', body.cc || '없음')
      console.log('├─ Subject:', body.subject || '없음')
      console.log('├─ Message-ID:', messageId || '없음')
      console.log('├─ In-Reply-To:', inReplyTo || '없음')
      console.log('└─ References:', references.length > 0 ? references.join(', ') : '없음')

      console.log('\n🌐 [발신자 정보]')
      console.log('├─ Sender IP:', body.sender_ip || '없음')
      console.log(
        '└─ Envelope From:',
        (() => {
          try {
            const envelope = JSON.parse(body.envelope || '{}')
            return envelope.from || '없음'
          } catch {
            return '파싱 실패'
          }
        })()
      )

      console.log('\n📄 [이메일 내용]')
      if (body.text) {
        const textPreview = body.text.slice(0, 200)
        console.log('├─ Text 내용:')
        console.log(`│  ${textPreview}${body.text.length > 200 ? '...' : ''}`)
        console.log(`│  (총 ${body.text.length}자)`)
      }
      if (body.html) {
        console.log(`└─ HTML 내용: ${body.html.length}자`)
      }

      const parsedFormData: FormData = {
        to: body.to || '',
        from: body.from || '',
        subject: body.subject || '',
        text: body.text || '',
        html: body.html || '',
        attachments: body.attachments || '[]',
        charsets: body.charsets || '{}',
        sender_ip: body.sender_ip || '',
        envelope: body.envelope || '{}',
        'attachment-info': body['attachment-info'] || '{}',
        'content-ids': body['content-ids'] || '{}'
      }

      let parsedAttachments: { filename: string; content: string }[] = []

      console.log('\n📎 [첨부파일 정보]')
      console.log('├─ attachment-info:', body['attachment-info'] || '없음')

      interface Attachment {
        filename: string
        type: string
        content?: string
      }

      if (body['attachment-info']) {
        try {
          const attachmentInfo = JSON.parse(body['attachment-info'])
          console.log('├─ 파싱된 attachment-info:')
          Object.entries(attachmentInfo).forEach(([key, value]) => {
            console.log(`│  └─ ${key}:`, value)
          })
        } catch {
          console.log('├─ attachment-info 파싱 실패')
        }
      }

      try {
        const attachments = JSON.parse(parsedFormData.attachments || '[]') as Attachment[]
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

        parsedAttachments = decodedAttachments.filter(
          (att) => att.content !== null
        ) as { filename: string; content: string }[]

        if (parsedAttachments.length > 0) {
          console.log(`└─ ✅ 디코딩 성공: ${parsedAttachments.length}/${attachments.length}개 파일`)
        }
      } catch {
        console.log('└─ ❌ 첨부파일 처리 중 오류 발생')
      }

      if (files && files.length > 0) {
        console.log('\n📁 [업로드된 파일 (Multipart)]')
        files.forEach((file) => {
          console.log(`├─ 파일명: ${file.originalname}`)
          console.log(`│  ├─ 필드명: ${file.fieldname}`)
          console.log(`│  ├─ MIME 타입: ${file.mimetype}`)
          console.log(`│  └─ 크기: ${file.size} bytes`)
        })
      }

      console.log('\n📝 [추가 메타데이터]')
      if (body.charsets) {
        try {
          const charsets = JSON.parse(body.charsets)
          console.log('├─ 문자 인코딩:')
          Object.entries(charsets).forEach(([key, value]) => {
            console.log(`│  └─ ${key}: ${value}`)
          })
        } catch {
          console.log('├─ charsets 파싱 실패')
        }
      }

      if (body['content-ids']) {
        try {
          const contentIds = JSON.parse(body['content-ids'])
          if (Object.keys(contentIds).length > 0) {
            console.log('├─ Content-IDs:')
            Object.entries(contentIds).forEach(([key, value]) => {
              console.log(`│  └─ ${key}: ${value}`)
            })
          }
        } catch {
          console.log('├─ content-ids 파싱 실패')
        }
      }

      console.log('\n🔍 [전체 수신 데이터 키 목록]')
      const allKeys = Object.keys(body)
      console.log(`├─ 총 ${allKeys.length}개 필드`)
      allKeys.forEach((key, index) => {
        const isLast = index === allKeys.length - 1
        const value = body[key]
        const preview = value
          ? value.length > 50
            ? `${value.substring(0, 50)}...`
            : value
          : '빈 값'
        console.log(`${isLast ? '└─' : '├─'} ${key}: ${preview}`)
      })

      const emailData = {
        id: Date.now().toString(),
        from: parsedFormData.from || 'Unknown',
        to: parsedFormData.to || 'Unknown',
        subject: parsedFormData.subject || 'No subject',
        text: parsedFormData.text,
        html: parsedFormData.html,
        attachments: parsedAttachments,
        timestamp: new Date().toISOString()
      }

      emails.push(emailData)

      if (parsedFormData.from && parsedFormData.subject) {
        console.log('\n📤 자동 답장 발송 시도 중...')

        let emailContent = parsedFormData.text || ''

        if (!emailContent && parsedFormData.html) {
          emailContent = parsedFormData.html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        }

        if (!emailContent && body.email) {
          const rawEmail = body.email
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

        console.log('├─ 이메일 내용 길이:', emailContent.length, '자')

        const updatedReferences = messageId ? [...references, messageId] : references

        const autoReplySuccess = await sendAutoReply(
          parsedFormData.to || '',
          parsedFormData.from,
          parsedFormData.subject,
          emailContent,
          messageId,
          updatedReferences
        )

        if (autoReplySuccess) {
          console.log('✅ 자동 답장 발송 완료!')
        } else {
          console.log('❌ 자동 답장 발송 실패!')
        }
      }

      console.log('\n========================================')
      console.log('         이메일 처리 완료')
      console.log('========================================\n')

      return { status: 'OK' }
    } catch (error) {
      console.error('Error processing webhook:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { error: errorMessage }
    }
  })

  // Webhook inbound-store endpoint
  .post('/api/webhook/inbound-store', async ({ request }) => {
    try {
      const contentType = request.headers.get('content-type')
      const arrayBuffer = await request.arrayBuffer()
      const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

      const email = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        from: body.from || '',
        to: body.to || '',
        subject: body.subject || '',
        text: body.text || '',
        html: body.html || '',
        attachments: files
          ? files.map((f: FileData) => ({
              filename: f.originalname,
              size: f.size,
              mimetype: f.mimetype
            }))
          : []
      }

      emails.push(email)
      console.log(`이메일 저장됨: ${email.subject} (ID: ${email.id})`)

      return { status: 'OK' }
    } catch (error) {
      console.error('Error storing email:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { error: errorMessage }
    }
  })

  // CRUD Endpoints for posts
  .get('/api/posts', async () => {
    try {
      const posts = await postService.getAllPosts()
      return { success: true, data: posts }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  })

  .post('/api/posts', async ({ body }) => {
    try {
      const post = await postService.createPost(body)
      return { success: true, data: post }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }, {
    body: t.Object({
      title: t.String({ minLength: 1, maxLength: 255 }),
      content: t.String({ minLength: 1 }),
      author: t.String({ minLength: 1, maxLength: 100 })
    })
  })

  .put('/api/posts/:id', async ({ params, body }) => {
    try {
      const post = await postService.updatePost(parseInt(params.id), body)
      if (!post) {
        return { success: false, error: 'Post not found' }
      }
      return { success: true, data: post }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }, {
    params: t.Object({
      id: t.String()
    }),
    body: t.Object({
      title: t.Optional(t.String({ minLength: 1, maxLength: 255 })),
      content: t.Optional(t.String({ minLength: 1 })),
      author: t.Optional(t.String({ minLength: 1, maxLength: 100 }))
    })
  })

  .delete('/api/posts/:id', async ({ params }) => {
    try {
      const success = await postService.deletePost(parseInt(params.id))
      if (!success) {
        return { success: false, error: 'Post not found' }
      }
      return { success: true, message: 'Post deleted successfully' }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: errorMessage }
    }
  }, {
    params: t.Object({
      id: t.String()
    })
  })

  .listen(3001)

console.log(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`)