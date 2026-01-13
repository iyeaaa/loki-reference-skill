import { GoogleGenAI } from "@google/genai"
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm"
import { Elysia, t } from "elysia"
import OpenAI from "openai"
import { config } from "../config"
import { db } from "../db/index"
import { emailReplies, emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { getAIEmailService } from "../lib/ai-email-service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import logger from "../utils/logger"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Lead 필드 정의 (프론트엔드와 동기화)
const LEAD_FIELD_DEFINITIONS = [
  { key: "companyName", label: "Company Name", labelKo: "회사명", required: true },
  { key: "primaryEmail", label: "Primary Email", labelKo: "대표 이메일", required: true },
  { key: "websiteUrl", label: "Website URL", labelKo: "웹사이트", required: true },
  { key: "contactName", label: "Contact Name", labelKo: "담당자명", required: false },
  { key: "primaryPhone", label: "Primary Phone", labelKo: "대표 전화번호", required: false },
  { key: "businessType", label: "Business Type", labelKo: "업종", required: false },
  { key: "description", label: "Description", labelKo: "설명", required: false },
  { key: "country", label: "Country", labelKo: "국가", required: false },
  { key: "city", label: "City", labelKo: "도시", required: false },
  { key: "state", label: "State/Province", labelKo: "주/도", required: false },
  { key: "address", label: "Address", labelKo: "주소", required: false },
  { key: "employeeCount", label: "Employee Count", labelKo: "직원 수", required: false },
  { key: "foundedYear", label: "Founded Year", labelKo: "설립년도", required: false },
  { key: "leadSource", label: "Lead Source", labelKo: "리드 소스", required: false },
  { key: "notes", label: "Notes", labelKo: "메모", required: false },
  { key: "secondaryEmail", label: "Secondary Email", labelKo: "보조 이메일", required: false },
  { key: "secondaryPhone", label: "Secondary Phone", labelKo: "보조 전화번호", required: false },
  {
    key: "foundCompanyName",
    label: "Found Company Name",
    labelKo: "검색된 회사명",
    required: false,
  },
  { key: "leadStatus", label: "Lead Status", labelKo: "리드 상태", required: false },
  { key: "leadScore", label: "Lead Score", labelKo: "리드 점수", required: false },
] as const

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
          model: "gpt-5-mini",
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
          reasoning_effort: "minimal",
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
  .post(
    "/generate-summary",
    async ({ body }) => {
      try {
        const { threadId, workspaceId, language = "ko" } = body

        logger.info({
          msg: "Generating AI conversation summary",
          threadId,
          workspaceId,
          language,
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
            const direction = email.direction === "inbound" ? "Customer" : "Company"
            const intent = email.replyIntent ? ` [Intent: ${email.replyIntent}]` : ""
            const sentiment = email.replySentiment ? ` [Sentiment: ${email.replySentiment}]` : ""
            return `${index + 1}. ${direction}${intent}${sentiment}:\n${email.bodyText || "(No content)"}\n`
          })
          .join("\n")

        // Determine language settings
        const languageMap: Record<string, { name: string; instruction: string }> = {
          ko: {
            name: "Korean (한국어)",
            instruction: "Please create a 3-line summary of this email conversation in Korean.",
          },
          en: {
            name: "English",
            instruction: "Please create a 3-line summary of this email conversation in English.",
          },
          vi: {
            name: "Vietnamese (Tiếng Việt)",
            instruction: "Please create a 3-line summary of this email conversation in Vietnamese.",
          },
          ja: {
            name: "Japanese (日本語)",
            instruction: "Please create a 3-line summary of this email conversation in Japanese.",
          },
          zh: {
            name: "Chinese (中文)",
            instruction: "Please create a 3-line summary of this email conversation in Chinese.",
          },
        }

        const selectedLanguage = languageMap[language] || {
          name: "Korean (한국어)",
          instruction: "Please create a 3-line summary of this email conversation in Korean.",
        }

        // Call OpenAI API for summary
        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant that creates concise email conversation summaries.
Analyze the email thread and create a brief summary in exactly 3 lines.

Your summary should:
- Be written in ${selectedLanguage.name}
- Capture the main topic and key points
- Include the current status or outcome
- Be concise but informative
- Each line should be a complete sentence
- Focus on business-relevant information

Format: Return exactly 3 lines, each ending with a period.`,
            },
            {
              role: "user",
              content: `Email Thread Subject: ${subject}

Conversation History:
${conversationHistory}

${selectedLanguage.instruction}`,
            },
          ],
          reasoning_effort: "minimal",
        })

        const aiSummary = completion.choices[0]?.message?.content || ""

        // Ensure the summary has exactly 3 lines
        const summaryLines = aiSummary.split("\n").filter((line) => line.trim().length > 0)
        const finalSummary = summaryLines.slice(0, 3).join("\n")

        logger.info({
          msg: "AI conversation summary generated",
          threadId,
          summaryLength: finalSummary.length,
          lineCount: summaryLines.length,
        })

        return successResponse(
          {
            threadId,
            subject,
            emailCount: threadEmails.length,
            summary: finalSummary,
          },
          "Conversation summary generated successfully",
        )
      } catch (error) {
        logger.error({
          msg: "Failed to generate AI conversation summary",
          error: error instanceof Error ? error.message : String(error),
        })

        return errorResponse(
          error instanceof Error ? error.message : "Failed to generate conversation summary",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        threadId: t.String({ minLength: 1 }),
        workspaceId: t.Optional(t.String()),
        language: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/translate-email",
    async ({ body, set }) => {
      try {
        const { subject, bodyText, targetLanguage } = body

        logger.info({
          msg: "Translating email",
          targetLanguage,
          subjectLength: subject.length,
          bodyLength: bodyText.length,
        })

        const { getAITemplateGenerationService } = await import(
          "../services/ai-template-generation.service"
        )
        const aiService = getAITemplateGenerationService()

        const result = await aiService.translateEmailTemplate({
          subject,
          bodyText,
          bodyHtml: null,
          targetLanguage,
        })

        logger.info({
          msg: "Email translated successfully",
          targetLanguage,
          resultSubjectLength: result.subject.length,
        })

        return successResponse(
          {
            subject: result.subject,
            bodyText: result.bodyText,
            bodyHtml: result.bodyHtml,
            detectedLanguage: result.detectedLanguage,
          },
          "Email translated successfully",
        )
      } catch (error) {
        logger.error({
          msg: "Failed to translate email",
          error: error instanceof Error ? error.message : String(error),
        })

        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to translate email",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        subject: t.String({ minLength: 1 }),
        bodyText: t.String({ minLength: 1 }),
        targetLanguage: t.String({ minLength: 2 }),
      }),
    },
  )
  .post(
    "/generate-overall-summary",
    async ({ body }) => {
      try {
        const { workspaceId, language = "ko", intent, limit = 50 } = body

        logger.info({
          msg: "Generating AI overall summary for replied emails",
          workspaceId,
          language,
          intent,
          limit,
        })

        // Build query conditions for emails
        const conditions: ReturnType<typeof eq>[] = [
          eq(emails.direction, "inbound"), // Only inbound emails (replies from customers)
        ]
        if (workspaceId && workspaceId !== "all") {
          conditions.push(eq(emails.workspaceId, workspaceId))
        }

        // Intent filtering needs to join emailReplies
        const intentConditions: ReturnType<typeof eq | typeof isNull>[] = []
        if (intent && intent !== "all") {
          if (intent === "unclassified") {
            intentConditions.push(isNull(emailReplies.intent))
          } else {
            intentConditions.push(eq(emailReplies.intent, intent))
          }
        }

        // Get recent inbound emails (replies) with their content
        // Join with emailReplies to get intent/sentiment and leads for company info
        const repliedEmailsData = await db
          .select({
            id: emails.id,
            threadId: emails.threadId,
            subject: emails.subject,
            intent: emailReplies.intent,
            sentiment: emailReplies.sentiment,
            bodyText: emails.bodyText,
            leadName: emails.leadName,
            companyName: leads.companyName,
            createdAt: emails.createdAt,
          })
          .from(emails)
          .leftJoin(emailReplies, eq(emailReplies.replyEmailId, emails.id))
          .leftJoin(leads, eq(leads.id, emails.leadId))
          .where(and(...conditions, ...(intentConditions.length > 0 ? intentConditions : [])))
          .orderBy(desc(emails.createdAt))
          .limit(limit)

        if (repliedEmailsData.length === 0) {
          return errorResponse("No replied emails found", ResponseCode.NOT_FOUND)
        }

        // Prepare conversation context for AI
        const emailSummaries = repliedEmailsData
          .map((email, index) => {
            const intentLabel = email.intent ? ` [Intent: ${email.intent}]` : ""
            const sentimentLabel = email.sentiment ? ` [Sentiment: ${email.sentiment}]` : ""
            const company = email.companyName || email.leadName || "Unknown"
            const preview = email.bodyText ? email.bodyText.substring(0, 200) : "(No content)"
            return `${index + 1}. ${company}${intentLabel}${sentimentLabel}\nSubject: ${email.subject || "(No subject)"}\nPreview: ${preview}\n`
          })
          .join("\n")

        // Determine language settings
        const languageMap: Record<string, { name: string; instruction: string }> = {
          ko: {
            name: "Korean (한국어)",
            instruction:
              "Please create an overall summary of these email conversations in Korean. Focus on key trends, common concerns, and actionable insights.",
          },
          en: {
            name: "English",
            instruction:
              "Please create an overall summary of these email conversations in English. Focus on key trends, common concerns, and actionable insights.",
          },
          vi: {
            name: "Vietnamese (Tiếng Việt)",
            instruction:
              "Please create an overall summary of these email conversations in Vietnamese. Focus on key trends, common concerns, and actionable insights.",
          },
          ja: {
            name: "Japanese (日本語)",
            instruction:
              "Please create an overall summary of these email conversations in Japanese. Focus on key trends, common concerns, and actionable insights.",
          },
          zh: {
            name: "Chinese (中文)",
            instruction:
              "Please create an overall summary of these email conversations in Chinese. Focus on key trends, common concerns, and actionable insights.",
          },
        }

        const defaultLanguage = {
          name: "Korean (한국어)",
          instruction:
            "Please create an overall summary of these email conversations in Korean. Focus on key trends, common concerns, and actionable insights.",
        }
        const selectedLanguage = languageMap[language] ?? defaultLanguage

        // Calculate intent distribution
        const intentCounts = repliedEmailsData.reduce(
          (acc, email) => {
            const key = email.intent || "unclassified"
            acc[key] = (acc[key] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        )

        // Call OpenAI API for overall summary
        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant that analyzes multiple email conversations and provides business insights.
Your task is to analyze the provided email summaries and create a comprehensive overview.

IMPORTANT: You MUST format your response using proper Markdown syntax:
- Use ## for section headers
- Use **bold** for emphasis on key terms
- Use bullet points (- or *) for lists
- Use > for important quotes or highlights

Your summary should:
- Be written in ${selectedLanguage.name}
- Include overall trends and patterns
- Highlight key concerns or interests from leads/customers
- Provide actionable insights for the sales/support team

Structure your response EXACTLY like this:

## 📊 개요
Brief overview of the email conversations (2-3 sentences)

## 💡 주요 인사이트
- **인사이트 1**: 설명
- **인사이트 2**: 설명
- **인사이트 3**: 설명

## ✅ 권장 조치
- **조치 1**: 구체적인 행동 제안
- **조치 2**: 구체적인 행동 제안

## 📈 주요 트렌드
- 트렌드 1
- 트렌드 2`,
            },
            {
              role: "user",
              content: `Analyze the following ${repliedEmailsData.length} email conversations and provide insights in Markdown format:

**Intent Distribution:**
${Object.entries(intentCounts)
  .map(([intent, count]) => `- ${intent}: ${count}`)
  .join("\n")}

**Email Summaries:**
${emailSummaries}

${selectedLanguage.instruction}`,
            },
          ],
          reasoning_effort: "medium",
        })

        const aiSummary = completion.choices[0]?.message?.content || ""

        logger.info({
          msg: "AI overall summary generated",
          workspaceId,
          emailCount: repliedEmailsData.length,
          summaryLength: aiSummary.length,
        })

        return successResponse(
          {
            emailCount: repliedEmailsData.length,
            intentDistribution: intentCounts,
            summary: aiSummary,
          },
          "Overall summary generated successfully",
        )
      } catch (error) {
        logger.error({
          msg: "Failed to generate AI overall summary",
          error: error instanceof Error ? error.message : String(error),
        })

        return errorResponse(
          error instanceof Error ? error.message : "Failed to generate overall summary",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        workspaceId: t.Optional(t.String()),
        language: t.Optional(t.String()),
        intent: t.Optional(t.String()),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      }),
    },
  )
  .post(
    "/edit-email",
    async ({ body, set }) => {
      try {
        const { subject, bodyText, editPrompt, targetLanguage } = body

        logger.info({
          msg: "Editing email with AI",
          promptPreview: editPrompt.substring(0, 50),
          targetLanguage,
        })

        const { getAITemplateGenerationService } = await import(
          "../services/ai-template-generation.service"
        )
        const aiService = getAITemplateGenerationService()

        const result = await aiService.editEmailWithAI({
          subject,
          bodyText,
          editPrompt,
          targetLanguage,
        })

        logger.info({
          msg: "Email edited successfully",
          resultSubjectLength: result.subject.length,
        })

        return successResponse(
          {
            subject: result.subject,
            bodyText: result.bodyText,
            bodyHtml: result.bodyHtml,
            detectedLanguage: result.detectedLanguage,
          },
          "Email edited successfully",
        )
      } catch (error) {
        logger.error({
          msg: "Failed to edit email",
          error: error instanceof Error ? error.message : String(error),
        })

        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to edit email",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        subject: t.String({ minLength: 1 }),
        bodyText: t.String({ minLength: 1 }),
        editPrompt: t.String({ minLength: 5 }),
        targetLanguage: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/column-mapping",
    async ({ body, set }) => {
      try {
        const { columns } = body

        logger.info({
          msg: "AI Column Mapping requested",
          columnCount: columns.length,
        })

        // Gemini AI 초기화
        const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })

        // 필드 정의 목록 생성
        const fieldList = LEAD_FIELD_DEFINITIONS.map(
          (f) => `- ${f.key}: ${f.labelKo} (${f.label})${f.required ? " [필수]" : ""}`,
        ).join("\n")

        // 컬럼 정보 포맷팅
        const columnInfo = columns
          .map((col, idx) => {
            const sampleStr = col.sampleValues.slice(0, 3).join(", ")
            return `${idx + 1}. 헤더: "${col.header}"\n   샘플 데이터: ${sampleStr || "(없음)"}`
          })
          .join("\n\n")

        const prompt = `You are an expert at mapping CSV columns to CRM lead fields.

## Available Lead Fields:
${fieldList}

## CSV Columns to Analyze:
${columnInfo}

## Instructions:
1. Map each CSV column to the most appropriate lead field.
2. Use null for columns that cannot be mapped.
3. Do NOT map the same field more than once.
4. Email patterns (data containing @) should map to primaryEmail or secondaryEmail.
5. URL patterns (http, www, .com, etc.) should map to websiteUrl.
6. Phone number patterns should map to primaryPhone or secondaryPhone.
7. Confidence levels: high (certain), medium (recommended), low (guess).

## Response Format (must be JSON array):
[
  {
    "header": "original header name",
    "mappedField": "mapped field key or null",
    "confidence": "high" | "medium" | "low",
    "reason": "brief reason for mapping in Korean"
  }
]

Output ONLY the JSON array. No additional explanation needed.`

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        })

        const responseText = response.text || ""

        // JSON 추출 (마크다운 코드블록 처리)
        let jsonStr = responseText.trim()
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
        }

        let mappingResult: Array<{
          header: string
          mappedField: string | null
          confidence: "high" | "medium" | "low"
          reason: string
        }>

        try {
          mappingResult = JSON.parse(jsonStr)
        } catch (parseError) {
          logger.error({
            msg: "Failed to parse AI response",
            responseText,
            error: parseError instanceof Error ? parseError.message : String(parseError),
          })
          throw new Error("AI 응답을 파싱할 수 없습니다.")
        }

        // 중복 매핑 제거 (먼저 매핑된 필드 우선)
        const usedFields = new Set<string>()
        const finalMappings = mappingResult.map((item) => {
          if (item.mappedField && usedFields.has(item.mappedField)) {
            return {
              ...item,
              mappedField: null,
              confidence: "low" as const,
              reason: "중복 매핑 제거됨",
            }
          }
          if (item.mappedField) {
            usedFields.add(item.mappedField)
          }
          return item
        })

        logger.info({
          msg: "AI Column Mapping completed",
          columnCount: columns.length,
          mappedCount: finalMappings.filter((m) => m.mappedField).length,
        })

        return successResponse(
          {
            mappings: finalMappings,
          },
          "AI 컬럼 매핑이 완료되었습니다.",
        )
      } catch (error) {
        logger.error({
          msg: "Failed to perform AI column mapping",
          error: error instanceof Error ? error.message : String(error),
        })

        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "AI 컬럼 매핑 실패",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      body: t.Object({
        columns: t.Array(
          t.Object({
            header: t.String(),
            sampleValues: t.Array(t.String()),
          }),
        ),
      }),
    },
  )
