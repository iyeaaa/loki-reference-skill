import { NextRequest, NextResponse } from 'next/server'
import busboy from 'busboy'
import sgMail from '@sendgrid/mail'
import { Readable } from 'stream'

sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

function decodeBase64(str: string): string | null {
  try {
    const cleanStr = str.replace(/[\r\n\s]/g, '')
    const decoded = Buffer.from(cleanStr, 'base64').toString('utf-8')
    if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
      return decoded
    }
    return null
  } catch (error) {
    return null
  }
}

async function sendAutoReply(_toEmail: string, fromEmail: string, subject: string, emailContent: string): Promise<boolean> {
  const now = new Date()
  const formattedTime = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })

  const contentSummary = emailContent ?
    (emailContent.trim().length > 200 ? emailContent.trim().substring(0, 200) + '...' : emailContent.trim()) :
    '(내용 없음)'

  const msg = {
    to: fromEmail,
    from: {
      email: 'rinda@partners.grinda.ai',
      name: '린다 뷰티 (Rinda Beauty)'
    },
    replyTo: 'rinda@partners.grinda.ai',
    subject: `Re: ${subject || '문의 감사합니다'}`,
    text: `안녕하세요,

소중한 문의 주셔서 감사합니다.

[접수 정보]
제목: ${subject || '제목 없음'}
내용: ${contentSummary}

접수시간: ${formattedTime}

고객님의 문의사항을 확인했으며, 담당자가 내용을 검토 중입니다.
24시간 이내 상세한 답변을 드리도록 하겠습니다.

감사합니다.

린다 고객지원팀
rinda@partners.grinda.ai`,
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

  try {
    await sgMail.send(msg)
    console.log(`✅ 자동 답장 이메일 발송 성공: ${fromEmail}`)
    return true
  } catch (error: any) {
    console.error('❌ 자동 답장 이메일 발송 실패:', error.message)
    if (error.response) {
      console.error('에러 상세:', error.response.body)
    }
    return false
  }
}

function parseMultipartFormData(req: NextRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    const formData: any = {}
    const files: any[] = []

    const bb = busboy({
      headers: {
        'content-type': req.headers.get('content-type') || ''
      }
    })

    bb.on('field', (name: string, value: string) => {
      formData[name] = value
    })

    bb.on('file', (name: string, stream: any, info: any) => {
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

    const nodeStream = Readable.from(req.body as any)
    nodeStream.pipe(bb)
  })
}

export async function POST(request: NextRequest) {
  console.log('\n========================================')
  console.log('         새 이메일 수신 알림')
  console.log('========================================')
  console.log('📅 수신 시간:', new Date().toISOString())

  try {
    const { formData: body, files } = await parseMultipartFormData(request)

    console.log('\n📧 [이메일 기본 정보]')
    console.log('├─ From:', body.from || '없음')
    console.log('├─ To:', body.to || '없음')
    console.log('├─ CC:', body.cc || '없음')
    console.log('└─ Subject:', body.subject || '없음')

    console.log('\n🌐 [발신자 정보]')
    console.log('├─ Sender IP:', body.sender_ip || '없음')
    console.log('└─ Envelope From:', (() => {
      try {
        const envelope = JSON.parse(body.envelope || '{}')
        return envelope.from || '없음'
      } catch {
        return '파싱 실패'
      }
    })())

    console.log('\n🔒 [보안 검증]')
    console.log('├─ SPF:', body.SPF || '없음')
    console.log('├─ DKIM:', body.dkim || '없음')
    console.log('├─ Spam Score:', body.spam_score || '없음')
    console.log('└─ Spam Report:', body.spam_report ?
      body.spam_report.split('\n')[0].substring(0, 50) + '...' : '없음')

    console.log('\n📝 [이메일 본문]')
    if (body.text) {
      console.log('├─ Text 본문 (총 ' + body.text.length + ' 글자):')
      console.log('│')
      body.text.split('\n').forEach((line: string) => {
        console.log('│  ', line)
      })
      console.log('│')
    } else {
      console.log('├─ Text 본문: 없음')

      if (body.email) {
        console.log('│  (Raw Email에서 본문 추출 시도...)')
        const rawEmail = body.email
        const plainTextMatch = rawEmail.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i)
        if (plainTextMatch && plainTextMatch[1]) {
          const extractedText = plainTextMatch[1].trim()
          const decodedText = decodeBase64(extractedText)

          if (decodedText) {
            console.log('│  추출된 Text 본문 (Base64 디코딩됨):')
            console.log('│  ────────────────────────────────────')
            decodedText.split('\n').forEach((line: string) => {
              console.log('│   ', line.trim())
            })
          } else {
            console.log('│  추출된 Text 본문 (원본):')
            extractedText.split('\n').forEach((line: string) => {
              console.log('│   ', line.trim())
            })
          }
          console.log('│')
        }
      }
    }

    if (body.html) {
      console.log('└─ HTML 본문: 있음 (' + body.html.length + ' 글자)')
    } else {
      console.log('└─ HTML 본문: 없음')

      if (body.email) {
        const rawEmail = body.email
        const htmlMatch = rawEmail.match(/Content-Type:\s*text\/html[^]*?\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i)
        if (htmlMatch && htmlMatch[1]) {
          console.log('   (Raw Email에서 HTML 본문 감지됨)')
        }
      }
    }

    const attachmentCount = parseInt(body.attachments) || 0
    if (attachmentCount > 0 || (files && files.length > 0)) {
      console.log('\n📎 [첨부파일]')
      console.log('├─ 첨부파일 개수:', attachmentCount)

      if (body['attachment-info']) {
        try {
          const attachInfo = JSON.parse(body['attachment-info'])
          Object.keys(attachInfo).forEach((key, idx, arr) => {
            const isLast = idx === arr.length - 1
            const prefix = isLast ? '└─' : '├─'
            const info = attachInfo[key]
            console.log(`${prefix} ${info.filename || key}: ${info.type} (${info['content-id'] || 'no-id'})`)
          })
        } catch {
          console.log('└─ 첨부파일 정보 파싱 실패')
        }
      }

      if (files && files.length > 0) {
        console.log('   실제 업로드된 파일:')
        files.forEach((file: any, index: number) => {
          console.log(`   ${index + 1}. ${file.originalname || file.fieldname} (${file.size} bytes)`)
        })
      }
    }

    if (body.headers) {
      console.log('\n📋 [헤더 정보]')
      try {
        const headers = typeof body.headers === 'string' ?
          JSON.parse(body.headers) : body.headers

        const importantHeaders = ['Message-ID', 'Date', 'Reply-To',
                                  'List-Unsubscribe', 'List-ID', 'X-Mailer']

        importantHeaders.forEach(header => {
          if (headers[header]) {
            console.log(`├─ ${header}:`, headers[header].substring(0, 60))
          }
        })
      } catch {
        console.log('└─ 헤더 파싱 실패')
      }
    }

    if (body.email) {
      console.log('\n📄 [Raw Email (MIME)]')
      console.log('└─ 크기:', body.email.length, '바이트')

      const contentEncodingMatch = body.email.match(/Content-Transfer-Encoding:\s*(base64|quoted-printable)/i)
      if (contentEncodingMatch && contentEncodingMatch[1].toLowerCase() === 'base64') {
        const base64BodyMatch = body.email.match(/Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i)
        if (base64BodyMatch && base64BodyMatch[1]) {
          const decodedContent = decodeBase64(base64BodyMatch[1].trim())
          if (decodedContent) {
            console.log('\n📝 [디코딩된 이메일 내용]')
            console.log('────────────────────────────────────────')
            console.log(decodedContent)
            console.log('────────────────────────────────────────')
          }
        }
      }
    }

    if (body.charsets) {
      console.log('\n🔤 [문자 인코딩]')
      try {
        const charsets = JSON.parse(body.charsets)
        Object.keys(charsets).forEach(key => {
          console.log(`├─ ${key}:`, charsets[key])
        })
      } catch {
        console.log('└─ 인코딩 정보 파싱 실패')
      }
    }

    const knownFields = [
      'from', 'to', 'cc', 'subject', 'text', 'html', 'sender_ip',
      'spam_score', 'spam_report', 'SPF', 'dkim', 'headers',
      'envelope', 'attachments', 'attachment-info', 'charsets',
      'content-ids', 'email'
    ]

    const otherFields = Object.keys(body).filter(key => !knownFields.includes(key))
    if (otherFields.length > 0) {
      console.log('\n➕ [추가 필드]')
      otherFields.forEach((field: string) => {
        const value = body[field]
        const displayValue = typeof value === 'string' && value.length > 50 ?
          value.substring(0, 50) + '...' : value
        console.log(`├─ ${field}:`, displayValue)
      })
    }

    console.log('\n========================================')
    console.log('         이메일 처리 완료 ✓')
    console.log('========================================\n')

    if (body.to && (body.to.includes('admin@grinda.ai') || body.to.includes('rinda@partners.grinda.ai'))) {
      console.log('\n📮 [자동 답장 처리]')
      console.log('├─ 수신인이 자동 답장 대상으로 확인됨:', body.to)
      console.log('├─ 발신자:', body.from)

      const fromMatch = body.from.match(/<(.+)>/) || [null, body.from]
      const fromEmail = fromMatch[1] || body.from

      const emailSubject = body.subject || '제목 없음'
      let emailContent = body.text || ''

      if (!emailContent && body.email) {
        const rawEmail = body.email
        const plainTextMatch = rawEmail.match(/Content-Type:\s*text\/plain[^]*?\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i)
        if (plainTextMatch && plainTextMatch[1]) {
          const extractedText = plainTextMatch[1].trim()
          const decodedText = decodeBase64(extractedText)
          if (decodedText) {
            emailContent = decodedText.trim()
          } else if (extractedText && !extractedText.match(/^[A-Za-z0-9+/=\s]+$/)) {
            emailContent = extractedText.trim()
          }
        }

        if (!emailContent) {
          const base64BodyMatch = rawEmail.match(/Content-Transfer-Encoding:\s*base64\s*\r?\n\r?\n([^]*?)(\r?\n--|\r?\n\r?\nContent-Type:|$)/i)
          if (base64BodyMatch && base64BodyMatch[1]) {
            const decodedContent = decodeBase64(base64BodyMatch[1].trim())
            if (decodedContent) {
              emailContent = decodedContent.trim()
            }
          }
        }
      }

      if (!emailContent && body.html) {
        emailContent = body.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }

      emailContent = emailContent.trim()

      if (!emailContent || emailContent.includes('�')) {
        emailContent = '(내용을 확인할 수 없습니다. 원본 이메일을 확인해 주세요.)'
      }

      console.log('├─ 답장 대상 이메일:', fromEmail)
      console.log('├─ 이메일 제목:', emailSubject)
      console.log('├─ 이메일 내용 길이:', emailContent.length, '자')
      console.log('└─ 자동 답장 발송 시작...')

      sendAutoReply(body.to, fromEmail, emailSubject, emailContent).then(success => {
        if (success) {
          console.log('   → 자동 답장 발송 완료 ✓')
        } else {
          console.log('   → 자동 답장 발송 실패 ✗')
        }
      })
    } else {
      console.log('\n📮 [자동 답장 스킵]')
      console.log('└─ 수신인이 자동 답장 대상이 아님:', body.to)
    }

    return NextResponse.json({ status: 'OK' }, { status: 200 })
  } catch (error: any) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}