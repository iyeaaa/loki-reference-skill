import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { emails as emailsTable, emailReplies } from '../db/schema/emails'
import { leads } from '../db/schema/leads'
import { userEmailAccounts } from '../db/schema/email-accounts'
import type { Email, FileData, FormData } from '../models/email.model'
import { emails } from '../types/email-storage'
import { emailService } from './email.service'

class WebhookService {
  async processInboundEmail(body: FormData, files: FileData[]) {
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
      console.error('Failed to store inbound email in DB:', error)
    }

    // Send auto-reply if needed
    if (body.from && body.subject) {
      this.handleAutoReply(body, headers)
    }

    return { status: 'OK' }
  }

  processInboundStore(body: FormData, files: FileData[]) {
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
            mimetype: f.mimetype,
          }))
        : [],
    }

    emails.push(email)
    console.log(`이메일 저장됨: ${email.subject} (ID: ${email.id})`)

    return { status: 'OK' }
  }

  private extractHeaders(headersString?: string) {
    let messageId: string | undefined
    let inReplyTo: string | undefined
    let references: string[] = []

    if (headersString) {
      try {
        const headers = JSON.parse(headersString)
        messageId = headers['Message-ID'] || headers['message-id']
        inReplyTo = headers['In-Reply-To'] || headers['in-reply-to']
        const referencesStr = headers.References || headers.references
        if (referencesStr) {
          references = referencesStr.split(/\s+/).filter((ref: string) => ref.length > 0)
        }
      } catch (e) {
        console.log('헤더 파싱 실패:', e)
      }
    }

    return { messageId, inReplyTo, references }
  }

  private logEmailInfo(body: FormData, headers: any, files: FileData[]) {
    console.log('\n========================================')
    console.log('         새 이메일 수신 알림')
    console.log('========================================')
    console.log('📅 수신 시간:', new Date().toISOString())

    console.log('\n📧 [이메일 기본 정보]')
    console.log('├─ From:', body.from || '없음')
    console.log('├─ To:', body.to || '없음')
    console.log('├─ CC:', body.cc || '없음')
    console.log('├─ Subject:', body.subject || '없음')
    console.log('├─ Message-ID:', headers.messageId || '없음')
    console.log('├─ In-Reply-To:', headers.inReplyTo || '없음')
    console.log(
      '└─ References:',
      headers.references.length > 0 ? headers.references.join(', ') : '없음',
    )

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
      })(),
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

    if (files && files.length > 0) {
      console.log('\n📁 [업로드된 파일 (Multipart)]')
      files.forEach((file: FileData) => {
        console.log(`├─ 파일명: ${file.originalname}`)
        console.log(`│  ├─ 필드명: ${file.fieldname}`)
        console.log(`│  ├─ MIME 타입: ${file.mimetype}`)
        console.log(`│  └─ 크기: ${file.size} bytes`)
      })
    }

    this.logMetadata(body)
    this.logAllKeys(body)
  }

  private logMetadata(body: FormData) {
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
  }

  private logAllKeys(body: FormData) {
    console.log('\n🔍 [전체 수신 데이터 키 목록]')
    const allKeys = Object.keys(body)
    console.log(`├─ 총 ${allKeys.length}개 필드`)
    allKeys.forEach((key, index) => {
      const isLast = index === allKeys.length - 1
      const value = body[key]
      const preview = value ? (value.length > 50 ? `${value.substring(0, 50)}...` : value) : '빈 값'
      console.log(`${isLast ? '└─' : '├─'} ${key}: ${preview}`)
    })
  }

  private async processAttachments(body: FormData) {
    const attachmentsJson = body.attachments || '[]'
    const attachmentInfo = body['attachment-info']
    return await emailService.processAttachments(attachmentsJson, attachmentInfo)
  }

  private createEmailData(body: FormData, attachments: any[]): Email {
    return {
      id: Date.now().toString(),
      from: body.from || 'Unknown',
      to: body.to || 'Unknown',
      subject: body.subject || 'No subject',
      text: body.text,
      html: body.html,
      attachments: attachments,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 인바운드 이메일을 DB에 저장하고 답장인 경우 email_replies 테이블에도 저장
   */
  private async storeInboundEmailInDB(body: FormData, headers: any, _attachments: any[]) {
    console.log('\n💾 DB에 인바운드 이메일 저장 중...')

    // 1. 수신 이메일 주소로 이메일 계정 찾기
    const toEmail = body.to || ''
    const fromEmail = body.from || ''

    const emailAccount = await db
      .select({
        id: userEmailAccounts.id,
        workspaceId: userEmailAccounts.workspaceId,
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.emailAddress, toEmail))
      .limit(1)

    if (emailAccount.length === 0) {
      console.log(`⚠️  이메일 계정을 찾을 수 없음: ${toEmail}`)
      return
    }

    const account = emailAccount[0]

    // 2. 발신자 이메일로 리드 찾기
    const leadResults = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.email, fromEmail))
      .limit(1)

    const leadId = leadResults.length > 0 ? leadResults[0].id : null

    // 3. 인바운드 이메일을 emails 테이블에 저장
    const [inboundEmail] = await db
      .insert(emailsTable)
      .values({
        workspaceId: account.workspaceId,
        userEmailAccountId: account.id,
        leadId,
        direction: 'inbound',
        fromEmail,
        toEmail,
        subject: body.subject || '',
        bodyText: body.text,
        bodyHtml: body.html,
        status: 'received',
        sentAt: new Date(),
        messageId: headers.messageId,
        inReplyTo: headers.inReplyTo,
      })
      .returning()

    console.log(`✅ 인바운드 이메일 저장 완료: ${inboundEmail.id}`)

    // 4. 답장인지 확인 (In-Reply-To 헤더가 있는 경우)
    if (headers.inReplyTo) {
      console.log(`\n🔍 답장 감지: In-Reply-To = ${headers.inReplyTo}`)

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
          and(
            eq(emailsTable.messageId, headers.inReplyTo),
            eq(emailsTable.direction, 'outbound'),
          ),
        )
        .limit(1)

      if (originalEmailResults.length > 0) {
        const originalEmail = originalEmailResults[0]

        console.log(`✅ 원본 이메일 찾음: ${originalEmail.id}`)

        // email_replies 테이블에 저장
        await db.insert(emailReplies).values({
          workspaceId: originalEmail.workspaceId,
          originalEmailId: originalEmail.id,
          replyEmailId: inboundEmail.id,
          isRead: false,
        })

        console.log(`✅ email_replies 테이블에 저장 완료`)

        // 원본 이메일의 repliedAt 업데이트
        await db
          .update(emailsTable)
          .set({
            repliedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailsTable.id, originalEmail.id))

        console.log(`✅ 원본 이메일 repliedAt 업데이트 완료`)
      } else {
        console.log(`⚠️  원본 이메일을 찾을 수 없음: ${headers.inReplyTo}`)
      }
    }
  }

  private async handleAutoReply(body: FormData, headers: any) {
    console.log('\n📤 자동 답장 발송 시도 중...')

    const emailContent = emailService.extractEmailContent(body.text, body.html, body.email)

    console.log('├─ 이메일 내용 길이:', emailContent.length, '자')

    const updatedReferences = headers.messageId
      ? [...headers.references, headers.messageId]
      : headers.references

    const autoReplySuccess = await emailService.sendAutoReply(
      body.to || '',
      body.from || '',
      body.subject || '',
      emailContent,
      headers.messageId,
      updatedReferences,
    )

    if (autoReplySuccess) {
      console.log('✅ 자동 답장 발송 완료!')
    } else {
      console.log('❌ 자동 답장 발송 실패!')
    }

    console.log('\n========================================')
    console.log('         이메일 처리 완료')
    console.log('========================================\n')
  }
}

export const webhookService = new WebhookService()
