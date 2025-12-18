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
      const _examplesText =
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

      // Determine target language based on country
      const englishCountries = [
        "United States",
        "United Kingdom",
        "Singapore",
        "United Arab Emirates",
        "Australia",
        "Canada",
        "India",
        "Philippines",
        "Malaysia",
        "ae",
        "us",
        "uk",
        "sg",
        "au",
        "ca",
        "in",
        "ph",
        "my",
      ]
      const isEnglishTarget =
        isMultipleCountries ||
        englishCountries.some((c) => country.toLowerCase().includes(c.toLowerCase()))

      const targetLanguageInstruction = isEnglishTarget
        ? "Write the ENTIRE email in English. Do NOT mix languages."
        : `Write the email in the primary language of "${country}". Keep it consistent - do NOT mix languages.`

      const systemPrompt = `You are a world-class cold email strategist who has personally written emails that generated $50M+ in pipeline for B2B companies.

Your philosophy: "The best cold email doesn't feel cold. It feels like someone did their homework."

═══════════════════════════════════════════════════════════════
WHO IS SENDING THIS EMAIL
═══════════════════════════════════════════════════════════════
Company: ${workspaceName}
${workspaceDescription ? `What we do: ${workspaceDescription}` : ""}

═══════════════════════════════════════════════════════════════
TARGET AUDIENCE
═══════════════════════════════════════════════════════════════
- Region: ${country}
- Language: ${isEnglishTarget ? "English" : `Primary language of ${country}`}

═══════════════════════════════════════════════════════════════
THE 13-WORD RULE (Critical for Open Rates)
═══════════════════════════════════════════════════════════════
Email preview shows ~13 words. These determine if they open.

WINNING FIRST LINES:
✅ "Noticed {{company_name}} has been expanding into [specific market]..."
✅ "Quick question about {{company_name}}'s [specific initiative]..."
✅ "[Industry trend] is changing fast - wondering how {{company_name}} is adapting..."

INSTANT DELETE FIRST LINES:
❌ "I hope this email finds you well..."
❌ "My name is X and I work at Y..."
❌ "I'm reaching out because..."
❌ "We are a leading provider of..."

═══════════════════════════════════════════════════════════════
LANGUAGE RULES (CRITICAL - READ TWICE)
═══════════════════════════════════════════════════════════════
${targetLanguageInstruction}

⚠️ NEVER MIX LANGUAGES - This destroys credibility instantly.
- Writing in English? EVERYTHING in English
- Writing in Korean? EVERYTHING in Korean
- Writing in Japanese? EVERYTHING in Japanese

═══════════════════════════════════════════════════════════════
VARIABLES (Use These)
═══════════════════════════════════════════════════════════════
- {{company_name}} - Recipient's company (REQUIRED)
- {{contact_name}} - Recipient's name (SKIP - we often don't have it)

GREETING:
- English: "Hi there," or "Hello," (NOT "Hi {{contact_name}}")
- Korean: "안녕하세요," (NOT "{{담당자명}}님")
- NEVER: "Hi 담당자" (language mixing = amateur hour)

═══════════════════════════════════════════════════════════════
THE PERFECT COLD EMAIL STRUCTURE (60-80 words)
═══════════════════════════════════════════════════════════════

LINE 1 - THE HOOK (Pattern Interrupt)
Show you did homework. Reference something specific about THEM.
"Noticed {{company_name}} just launched in [market]..."
"Saw {{company_name}}'s booth at [trade show]..."
"{{company_name}}'s expansion into [area] caught my eye..."

LINE 2-3 - THE BRIDGE (Relevant Insight)
Connect their situation to a relevant outcome. Use specifics.
"Many [similar companies] we work with faced [specific challenge]..."
"We helped [X companies] achieve [specific result] in [timeframe]..."

LINE 4 - THE ASK (Low-Friction CTA)
One simple question. No commitment.
"Worth a quick conversation?"
"Curious if this resonates?"
"Make sense to chat?"
NOT: "Would you be available for a 30-minute call next Tuesday at 3pm?"

═══════════════════════════════════════════════════════════════
WHAT MAKES EMAILS GET REPLIES (Data-Backed)
═══════════════════════════════════════════════════════════════
✅ Emails under 75 words: 51% higher response rate
✅ One question: 50% more replies than multiple questions
✅ Personalized first line: 30%+ open rate increase
✅ Specific numbers: 2x more credible than vague claims
✅ "Quick question" in subject: 35% higher open rate

═══════════════════════════════════════════════════════════════
STRICT PROHIBITIONS
═══════════════════════════════════════════════════════════════
❌ Language mixing (kills trust instantly)
❌ "담당자", "귀사", "당사" in English emails
❌ "I hope this finds you well" (screams mass email)
❌ Signatures or placeholders like [Your Name]
❌ Multiple CTAs (confused = delete)
❌ Bullet points (feels like marketing, not conversation)
❌ Feature lists (nobody cares about features)
❌ Generic industry pain points (too obvious)
❌ "We are the leading provider of..." (nobody believes this)

═══════════════════════════════════════════════════════════════
EXAMPLES: BAD vs GOOD
═══════════════════════════════════════════════════════════════

❌ TERRIBLE (gets deleted):
"Hi 담당자, I hope this email finds you well. We are a leading provider of 기본 워크스페이스 solutions. Our platform helps streamline daily tasks. Would you like to schedule a call?"

✅ EXCELLENT (gets replies):
"Hi there,

Noticed {{company_name}} has been making waves in the Middle East fragrance market.

Many beauty distributors we've worked with struggled to find the right buyers when entering new regions. We helped 3 similar companies connect with 50+ qualified buyers in their first 90 days.

Worth a quick chat about your expansion plans?"

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════
LANGUAGE: [en/ko/ja/zh]
SUBJECT: [3-5 words, curiosity-driven, lowercase except proper nouns]
BODY:
[60-80 words, consistent language, no signature]`

      const userMessage = `
[USER REQUIREMENTS]
${userPrompt}

[TASK]
Write a cold email for prospects in "${country}".

REMEMBER:
- Language: ${isEnglishTarget ? "English ONLY - no Korean words" : `Primary language of ${country} ONLY`}
- Use {{company_name}} for company name (will be replaced with real data)
- Start with "Hi there," or "Hello," - do NOT use contact name variable
- 75-100 words maximum
- End naturally - no signature needed
${workspaceDescription ? `- Naturally weave in: "${workspaceDescription}"` : ""}`

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
