import { and, asc, eq, inArray, or } from "drizzle-orm"
import { Elysia, t } from "elysia"
import OpenAI from "openai"
import { db } from "../db/index"
import { emailReplies, emails } from "../db/schema/emails"
import { getAIEmailService } from "../lib/ai-email-service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import logger from "../utils/logger"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  .post(
    "/email-draft",
    async ({ body }) => {
      const aiService = getAIEmailService()
      const { fromEmail, subject, content } = body
      const normalizedSubject: string = subject ?? ""

      const result = await aiService.generateEmailReply({
        fromEmail,
        subject: normalizedSubject,
        content,
        receivedTime: new Date(),
      })

      if (!result.success) {
        return errorResponse(result.error || "AI 처리 실패")
      }

      return successResponse(
        {
          body: result.replyContent,
          subject: normalizedSubject || "Re: 문의 감사합니다",
        },
        "생성되었습니다.",
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
  .post(
    "/generate-followup",
    async ({ body }) => {
      try {
        const { threadId, workspaceId } = body

        logger.info({
          msg: "Generating AI follow-up suggestion",
          threadId,
          workspaceId,
        })

        // Fetch thread emails (same logic as /thread/:threadId endpoint)
        const initialConditions = [eq(emails.threadId, threadId)]
        if (workspaceId && workspaceId !== "all") {
          initialConditions.push(eq(emails.workspaceId, workspaceId))
        }

        const threadMessageIds = await db
          .select({ messageId: emails.messageId })
          .from(emails)
          .where(and(...initialConditions))

        const messageIdSet = new Set(threadMessageIds.map((e) => e.messageId).filter(Boolean))
        messageIdSet.add(threadId)

        const messageIdArray = Array.from(messageIdSet).filter(Boolean) as string[]
        const orConditions = [eq(emails.threadId, threadId)]

        if (messageIdArray.length > 0) {
          orConditions.push(inArray(emails.messageId, messageIdArray))
          orConditions.push(inArray(emails.inReplyTo, messageIdArray))
        }

        const conditions = [or(...orConditions)]
        if (workspaceId && workspaceId !== "all") {
          conditions.push(eq(emails.workspaceId, workspaceId))
        }

        // Get all emails in thread
        const threadEmails = await db
          .select({
            id: emails.id,
            direction: emails.direction,
            fromEmail: emails.fromEmail,
            toEmail: emails.toEmail,
            subject: emails.subject,
            bodyText: emails.bodyText,
            sentAt: emails.sentAt,
            createdAt: emails.createdAt,
            replyIntent: emailReplies.intent,
            replySentiment: emailReplies.sentiment,
          })
          .from(emails)
          .leftJoin(emailReplies, eq(emailReplies.replyEmailId, emails.id))
          .where(and(...conditions))
          .orderBy(asc(emails.createdAt))

        if (threadEmails.length === 0) {
          return errorResponse("Thread not found", ResponseCode.NOT_FOUND)
        }

        // Prepare conversation context for AI
        const subject = threadEmails[0]?.subject || "No subject"
        const conversationHistory = threadEmails
          .map((email, index) => {
            const direction = email.direction === "inbound" ? "Customer" : "You"
            const intent = email.replyIntent ? ` [Intent: ${email.replyIntent}]` : ""
            const sentiment = email.replySentiment ? ` [Sentiment: ${email.replySentiment}]` : ""
            return `${index + 1}. ${direction}${intent}${sentiment}:\n${email.bodyText || "(No content)"}\n`
          })
          .join("\n")

        // Call OpenAI API
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a professional email assistant helping to write follow-up email replies in Korean.
Analyze the email conversation thread and write a complete, professional follow-up email reply.

Your response should:
- Be written in Korean (한국어)
- Be professional and courteous
- Address the main points from the conversation
- Suggest next steps or actions
- Be ready to send as-is (complete email body)
- Use appropriate business email tone

DO NOT use JSON format or numbered lists with "action" and "description".
Write a natural, flowing email message that can be sent directly.`,
            },
            {
              role: "user",
              content: `Email Thread Subject: ${subject}

Conversation History:
${conversationHistory}

Please write a professional follow-up email reply in Korean based on this conversation thread.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        })

        const aiResponse = completion.choices[0]?.message?.content || ""

        logger.info({
          msg: "AI follow-up suggestion generated",
          threadId,
          responseLength: aiResponse.length,
        })

        return successResponse(
          {
            threadId,
            subject,
            emailCount: threadEmails.length,
            rawResponse: aiResponse,
          },
          "AI suggestion generated successfully",
        )
      } catch (error) {
        logger.error({
          msg: "Failed to generate AI follow-up suggestion",
          error: error instanceof Error ? error.message : String(error),
        })

        return errorResponse(
          error instanceof Error ? error.message : "Failed to generate AI suggestion",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        threadId: t.String({ minLength: 1 }),
        workspaceId: t.Optional(t.String()),
      }),
    },
  )
