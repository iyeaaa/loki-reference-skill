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
      model = "gpt-4o-mini",
      temperature = 0.7,
    } = options

    try {
      // 1. 랜덤 예시 5개 선택
      const examples = this.getRandomExamples(5)
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

      const systemPrompt = `당신은 전문적인 세일즈 이메일 템플릿 작성 전문가입니다.
다음 조건에 맞춰 이메일 템플릿을 작성해주세요:

[발신 회사 정보]
- 회사명: ${workspaceName}
${workspaceDescription ? `- 설명: ${workspaceDescription}` : ""}

[수신 대상]
- 국가: ${country}

[중요 지침]
1. ${targetLanguageInstruction}
2. 이메일에는 반드시 다음 한글 placeholder들을 적절히 활용하세요 (모든 placeholder를 사용할 필요는 없음):
   - {{회사명}}, {{웹사이트}}, {{업종}}, {{설명}}
   - {{국가}}, {{도시}}, {{주/도}}, {{주소}}
   - {{담당자명}}, {{이메일}}
   - {{직원수}}, {{설립연도}}
   - {{리드소스}}, {{리드상태}}, {{리드점수}}
3. **절대 영어 placeholder (예: {{company_name}}, {{website}} 등)를 사용하지 마세요. 반드시 한글 placeholder만 사용하세요.**
4. placeholder는 실제 값으로 치환하지 말고 그대로 {{변수명}} 형태로 유지하세요
5. 전문적이면서도 친근한 톤을 유지하세요
6. 명확한 가치 제안과 행동 촉구(CTA)를 포함하세요
7. 비즈니스 이메일 형식에 맞춰 작성하세요

${
  examplesText
    ? `
[참고할 실제 세일즈 이메일 예시]
아래는 성공적인 B2B 세일즈 이메일의 실제 예시들입니다. 이 예시들의 스타일, 구조, 톤을 참고하되, 
사용자의 요구사항과 ${country} 국가의 언어에 맞게 작성하세요:

${examplesText}

위 예시들처럼 간결하고 효과적인 이메일을 작성하세요.
`
    : ""
}

[이메일 구조]
- 제목: 한 줄로 명확하고 흥미로운 제목
- 본문: 인사 → 가치 제안 → 혜택 설명 → CTA → 마무리

응답 형식은 반드시 다음과 같이 해주세요:
LANGUAGE: [감지된 언어 코드 (예: en, ko, ja, zh, es 등)]
SUBJECT: [이메일 제목]
BODY:
[이메일 본문 - HTML 형식으로 작성, placeholder 포함]`

      const userMessage = `
사용자 요구사항: ${userPrompt}

위 요구사항에 맞춰 "${country}" 국가의 리드에게 보낼 세일즈 이메일 템플릿을 작성해주세요.
**중요: 반드시 한글 placeholder ({{회사명}}, {{담당자명}} 등)만 사용하고, 영어 placeholder ({{company_name}}, {{contact_name}} 등)는 절대 사용하지 마세요.**
placeholder를 적절히 활용하여 개인화가 가능하도록 만들어주세요.`

      // 2. AI API 호출
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: userMessage,
        temperature,
      })

      logger.info({ country, workspaceName }, "AI template generation successful")

      // 3. 응답 파싱
      const parsedTemplate = this.parseAIResponse(text)

      return parsedTemplate
    } catch (error) {
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
