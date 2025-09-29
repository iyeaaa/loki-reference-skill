import { Elysia, t } from 'elysia'
import { getAIEmailService } from '../lib/ai-email-service'
import { errorResponse, ResponseCode, successResponse } from '../types/response.types'

export const aiRoutes = new Elysia({ prefix: '/api/ai' }).post(
  '/email-draft',
  async ({ body }) => {
    const aiService = getAIEmailService()
    const { fromEmail, subject, content } = body
    const normalizedSubject: string = subject ?? ''

    const result = await aiService.generateEmailReply({
      fromEmail,
      subject: normalizedSubject,
      content,
      receivedTime: new Date(),
    })

    if (!result.success) {
      return errorResponse(result.error || 'AI 처리 실패')
    }

    return successResponse(
      {
        body: result.replyContent,
        subject: normalizedSubject || 'Re: 문의 감사합니다',
      },
      '생성되었습니다.',
      ResponseCode.CREATED,
    )
  },
  {
    body: t.Object({
      fromEmail: t.String({ minLength: 3 }),
      subject: t.Optional(t.String()),
      content: t.String({ minLength: 1 }),
    }),
  },
)
