import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import { parse } from "csv-parse/sync"
import logger from "../utils/logger"

interface GenerateTemplateOptions {
  workspaceName: string
  workspaceDescription?: string
  country: string
  userPrompt: string
  model?: string
  temperature?: number
}

interface GeneratedTemplate {
  subject: string
  bodyText: string
  bodyHtml: string
  detectedLanguage?: string
}

interface EmailExample {
  company: string
  day: string
  subject: string
  content: string
}

class AITemplateGenerationService {
  private openai: ReturnType<typeof createOpenAI>
  private emailExamples: EmailExample[] = []

  constructor(apiKey: string) {
    this.openai = createOpenAI({
      apiKey: apiKey,
    })
    this.loadEmailExamples()
  }

  /**
   * CSV 파일에서 이메일 예시 로드
   */
  private loadEmailExamples() {
    try {
      const csvPath = join(__dirname, "../../data/email-examples.csv")
      const csvContent = readFileSync(csvPath, "utf-8")

      // CSV 파싱 (csv-parse 라이브러리 사용)
      const records = parse(csvContent, {
        columns: true, // 첫 번째 행을 헤더로 사용
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        escape: '"',
        relax_column_count: true, // 컬럼 수가 다른 행 허용
      }) as Array<{
        Company: string
        Day: string
        Subject: string
        Content: string
      }>

      this.emailExamples = records
        .filter((record) => record.Company && record.Subject && record.Content)
        .map((record) => ({
          company: record.Company,
          day: record.Day,
          subject: record.Subject,
          content: record.Content,
        }))

      logger.info({ count: this.emailExamples.length }, "Email examples loaded from CSV")
    } catch (error) {
      logger.warn({ err: error }, "Failed to load email examples, continuing without examples")
      this.emailExamples = []
    }
  }

  /**
   * 랜덤으로 5개의 이메일 예시 선택
   */
  private getRandomExamples(count = 5): EmailExample[] {
    if (this.emailExamples.length === 0) {
      return []
    }

    const shuffled = [...this.emailExamples].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, Math.min(count, this.emailExamples.length))
  }

  /**
   * 국가 정보로부터 언어 감지 및 이메일 템플릿 생성
   */
  async generateEmailTemplate(options: GenerateTemplateOptions): Promise<GeneratedTemplate> {
    const {
      workspaceName,
      workspaceDescription,
      country,
      userPrompt,
      model = "gpt-4.1-mini",
      temperature = 0.7,
    } = options

    console.log(`[AITemplate] Starting email template generation`)
    console.log(`[AITemplate]   - workspace: ${workspaceName}`)
    console.log(`[AITemplate]   - country: ${country}`)
    console.log(`[AITemplate]   - model: ${model}`)

    try {
      // 1. 랜덤 예시 5개 선택
      const examples = this.getRandomExamples(5)
      console.log(`[AITemplate] Selected ${examples.length} random email examples`)
      const examplesText =
        examples.length > 0
          ? examples
              .map(
                (ex, idx) => `
예시 ${idx + 1}:
회사: ${ex.company}
발송 시점: ${ex.day}
제목: ${ex.subject}
본문:
${ex.content}
`,
              )
              .join("\n---\n")
          : ""

      // 2. 시스템 프롬프트 구성
      // 국가가 여러 개인 경우 (comma로 구분) 영어로 고정
      const isMultipleCountries = country.includes(",")
      const targetLanguageInstruction = isMultipleCountries
        ? "여러 국가를 대상으로 하므로 이메일을 영어로 작성하세요"
        : `"${country}" 국가에서 사용하는 주요 언어로 이메일을 작성하세요`

      const systemPrompt = `You are a world-class cold email copywriter with expertise in B2B sales outreach.
Your emails have consistently achieved 40%+ open rates and 15%+ response rates.

[SENDER COMPANY INFORMATION]
- Company: ${workspaceName}
${workspaceDescription ? `- About: ${workspaceDescription}` : ""}

[TARGET RECIPIENT]
- Country: ${country}

[CORE PRINCIPLES - The REPLY Framework]
1. **Relevance**: Connect the sender's solution to the recipient's likely pain points
2. **Empathy**: Write as a helpful peer, not a salesperson
3. **Personalization**: Use {{회사명}} and {{담당자명}} variables naturally
4. **Lightness**: Keep it conversational - no corporate jargon
5. **Yield**: End with a low-friction CTA (simple reply, not a calendar link)

[CRITICAL INSTRUCTIONS]
${workspaceDescription ? `- **MUST incorporate sender's business context**: "${workspaceDescription}" - weave this naturally into the value proposition without being promotional` : "- Focus on recipient benefits"}
- ${targetLanguageInstruction}
- Write like a human, not a template - vary sentence length, use contractions
- Lead with curiosity or insight, not a pitch
- One clear idea per email - don't overwhelm
- Subject line: 3-6 words, spark curiosity, avoid spam triggers

[AVAILABLE VARIABLES]
- {{회사명}} - Recipient company name (required)
- {{담당자명}} - Recipient contact name (optional - omit if uncertain)

[STRICT PROHIBITIONS]
- No formal expressions like "귀사", "당사" (too stiff)
- No English placeholders like {{company_name}}
- No internal data variables like {{리드점수}}, {{리드상태}}
- No signature placeholders like [Your Name], [Your Position] - signatures are added automatically by the system
- No "I hope this email finds you well" or similar clichés
- No multiple CTAs - one clear ask only

${
  examplesText
    ? `
[REFERENCE EXAMPLES - Study the tone and structure]
${examplesText}
`
    : ""
}

[OUTPUT FORMAT]
LANGUAGE: [language code, e.g., ko, en, ja]
SUBJECT: [compelling subject line - curiosity-driven, 3-6 words]
BODY:
[email body - conversational, value-focused, ends naturally without signature]`

      const userMessage = `
[USER REQUIREMENTS]
${userPrompt}

[TASK]
Write a cold email targeting prospects in "${country}".
${workspaceDescription ? `Remember to naturally incorporate our value proposition based on: "${workspaceDescription}"` : ""}

Guidelines:
- Sound like a real person wrote this, not a marketing team
- {{회사명}} is required; {{담당자명}} is optional
- Match the cultural communication style of ${country}
- End the email naturally - no signature needed`

      // 2. AI API 호출
      console.log(`[AITemplate] Calling OpenAI API...`)
      const startTime = Date.now()
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: userMessage,
        temperature,
      })
      const elapsed = Date.now() - startTime
      console.log(`[AITemplate] OpenAI API response received (${elapsed}ms)`)

      logger.info({ country, workspaceName }, "AI template generation successful")

      // 3. 응답 파싱
      console.log(`[AITemplate] Parsing AI response...`)
      const parsedTemplate = this.parseAIResponse(text)
      console.log(`[AITemplate] ✅ Template generated successfully`)
      console.log(`[AITemplate]   - subject: ${parsedTemplate.subject.substring(0, 50)}...`)
      console.log(`[AITemplate]   - language: ${parsedTemplate.detectedLanguage}`)
      console.log(`[AITemplate]   - bodyLength: ${parsedTemplate.bodyText.length} chars`)

      return parsedTemplate
    } catch (error) {
      console.error(`[AITemplate] ❌ Template generation failed:`, error)
      logger.error({ err: error, country, workspaceName }, "AI template generation failed")
      throw error
    }
  }

  /**
   * AI 응답에서 언어, 제목, 본문 파싱
   */
  private parseAIResponse(response: string): GeneratedTemplate {
    const lines = response.trim().split("\n")
    let language = "en"
    let subject = ""
    let bodyLines: string[] = []
    let inBody = false

    for (const line of lines) {
      if (line.startsWith("LANGUAGE:")) {
        language = line.substring("LANGUAGE:".length).trim()
      } else if (line.startsWith("SUBJECT:")) {
        subject = line.substring("SUBJECT:".length).trim()
      } else if (line.startsWith("BODY:")) {
        inBody = true
      } else if (inBody) {
        bodyLines.push(line)
      }
    }

    // SUBJECT/BODY 형식이 아니면 전체를 본문으로
    if (!subject && bodyLines.length === 0) {
      subject = lines[0] || "제목 없음"
      bodyLines = lines.slice(1)
    }

    const bodyText = bodyLines.join("\n").trim()

    // HTML 버전 생성 (단락 구분 및 줄바꿈 처리)
    const bodyHtml = bodyText
      .split("\n\n")
      .map((para) => {
        // 빈 단락 스킵
        if (!para.trim()) return ""

        // 리스트 항목 처리
        if (para.includes("\n-") || para.includes("\n•") || para.includes("\n*")) {
          const listItems = para
            .split("\n")
            .filter((line) => line.trim())
            .map((line) => {
              if (
                line.trim().startsWith("-") ||
                line.trim().startsWith("•") ||
                line.trim().startsWith("*")
              ) {
                return `<li>${line.trim().substring(1).trim()}</li>`
              }
              return `<p>${line}</p>`
            })
            .join("\n")
          return `<ul>\n${listItems}\n</ul>`
        }

        // 일반 단락
        return `<p>${para.replace(/\n/g, "<br>")}</p>`
      })
      .filter((para) => para)
      .join("\n")

    return {
      subject,
      bodyText,
      bodyHtml,
      detectedLanguage: language,
    }
  }

  /**
   * 이메일 템플릿을 특정 언어로 번역
   * 리드의 국가에 맞게 이메일을 번역할 때 사용
   */
  async translateEmailTemplate(options: {
    subject: string
    bodyText: string
    bodyHtml: string | null
    targetLanguage: string // e.g., "Japanese", "Korean", "Chinese"
    model?: string
    temperature?: number
  }): Promise<GeneratedTemplate> {
    const {
      subject,
      bodyText,
      bodyHtml,
      targetLanguage,
      model = "gpt-4.1-mini",
      temperature = 0.3, // Lower temperature for more consistent translations
    } = options

    console.log(`[AITemplate] Translating email to ${targetLanguage}`)

    try {
      const systemPrompt = `You are a professional translator specializing in business emails.
Translate the following email to ${targetLanguage}.

IMPORTANT RULES:
1. Keep the same tone and style as the original
2. Preserve all placeholders exactly as they are (e.g., {{회사명}}, {{담당자명}})
3. Make the translation sound natural, not literal
4. Keep the email concise and professional
5. Do NOT translate placeholder names - keep them in Korean ({{회사명}}, {{담당자명}})

Respond in this format:
SUBJECT: [translated subject]
BODY:
[translated body]`

      const userMessage = `Please translate this email to ${targetLanguage}:

SUBJECT: ${subject}

BODY:
${bodyText}`

      const startTime = Date.now()
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: userMessage,
        temperature,
      })
      const elapsed = Date.now() - startTime
      console.log(`[AITemplate] Translation completed (${elapsed}ms)`)

      // Parse the response
      const lines = text.trim().split("\n")
      let translatedSubject = subject
      const translatedBodyLines: string[] = []
      let inBody = false

      for (const line of lines) {
        if (line.startsWith("SUBJECT:")) {
          translatedSubject = line.substring("SUBJECT:".length).trim()
        } else if (line.startsWith("BODY:")) {
          inBody = true
        } else if (inBody) {
          translatedBodyLines.push(line)
        }
      }

      const translatedBodyText = translatedBodyLines.join("\n").trim()

      // Generate HTML version
      const translatedBodyHtml = translatedBodyText
        .split("\n\n")
        .map((para) => {
          if (!para.trim()) return ""
          return `<p>${para.replace(/\n/g, "<br>")}</p>`
        })
        .filter((para) => para)
        .join("\n")

      // Map language name to language code
      const languageCodeMap: Record<string, string> = {
        Japanese: "ja",
        Korean: "ko",
        Chinese: "zh",
        English: "en",
        German: "de",
        French: "fr",
        Spanish: "es",
        Portuguese: "pt",
        Vietnamese: "vi",
        Thai: "th",
        Indonesian: "id",
      }

      return {
        subject: translatedSubject,
        bodyText: translatedBodyText,
        bodyHtml: translatedBodyHtml,
        detectedLanguage: languageCodeMap[targetLanguage] || "en",
      }
    } catch (error) {
      console.error(`[AITemplate] Translation failed:`, error)
      // Return original if translation fails
      return {
        subject,
        bodyText,
        bodyHtml: bodyHtml || "",
        detectedLanguage: "en",
      }
    }
  }
}

// 싱글톤 인스턴스
let aiTemplateServiceInstance: AITemplateGenerationService | null = null

/**
 * AI 템플릿 생성 서비스 인스턴스 가져오기
 */
export function getAITemplateGenerationService(): AITemplateGenerationService {
  if (!aiTemplateServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다")
    }
    aiTemplateServiceInstance = new AITemplateGenerationService(apiKey)
  }
  return aiTemplateServiceInstance
}

export type { GenerateTemplateOptions, GeneratedTemplate }
export { AITemplateGenerationService }
