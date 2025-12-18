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

      const systemPrompt = `당신은 자연스럽고 효과적인 콜드 이메일 작성 전문가입니다.
처음 연락하는 잠재 고객에게 보내는 이메일을 작성합니다.

[발신자 정보]
- 회사: ${workspaceName}
${workspaceDescription ? `- 서비스: ${workspaceDescription}` : ""}

[수신자 정보]
- 국가: ${country}

[콜드 이메일 작성 핵심 원칙]
1. ${targetLanguageInstruction}
2. **자연스러운 대화체**: 템플릿처럼 느껴지지 않게 자연스러운 어조로 작성
3. **간결함**: 3-5문장으로 핵심만 전달 (200단어 이내)
4. **개인화**: 받는 사람의 회사나 상황에 맞춘 느낌 (placeholder 활용)
5. **명확한 가치**: 상대방이 얻을 수 있는 이점을 구체적으로 제시
6. **부담 없는 CTA**: "관심 있으시면 답장 주세요" 정도의 가벼운 행동 유도

[사용 가능한 변수 (필요한 것만 선택적으로 사용)]
- {{회사명}} - 받는 회사명
- {{담당자명}} - 받는 담당자명 (없으면 사용하지 마세요)

[절대 하지 말아야 할 것]
- "귀사", "당사" 같은 딱딱한 표현 사용 금지
- "워크스페이스", "담당자 & 워크스페이스" 같은 부자연스러운 표현 금지
- 너무 많은 정보 나열 금지
- 영어 placeholder 사용 금지 ({{company_name}} 등 사용 금지)
- {{리드점수}}, {{리드상태}}, {{리드소스}} 같은 내부 데이터 placeholder 사용 금지

${
  examplesText
    ? `
[참고 예시 - 자연스러운 콜드 이메일]
${examplesText}
`
    : ""
}

[응답 형식]
LANGUAGE: [언어 코드]
SUBJECT: [이메일 제목 - 궁금증을 유발하는 짧은 제목]
BODY:
[이메일 본문 - 자연스럽고 간결하게]`

      const userMessage = `
요구사항: ${userPrompt}

"${country}" 국가의 잠재 고객에게 보내는 첫 콜드 이메일을 작성해주세요.
- 자연스럽고 친근한 톤 유지
- {{회사명}} 변수만 사용해도 충분함 (담당자명은 선택)
- 딱딱한 비즈니스 형식 피하기`

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
