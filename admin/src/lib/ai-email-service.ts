import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import pRetry from "p-retry"
import { z } from "zod"

interface EmailContext {
  fromEmail: string
  subject: string
  content: string
  receivedTime: Date
}

interface AIEmailResponse {
  success: boolean
  replyContent?: string
  error?: string
}

// New interfaces for personalized email generation
interface PersonalizedEmailContext extends EmailContext {
  additionalContext?: string // Extra parameter for personalized generation
}

interface JudgmentResult {
  pass: boolean
  qualityScore: number // 0-10
  accuracyScore: number // 0-10
  feedback: string
  issues?: string[]
}

interface EmailMetadata {
  sentiment: "positive" | "neutral" | "negative"
  intent: string[]
  topics: string[]
  actionItems: string[]
}

interface ParsedEmailData {
  subject: string
  body: string
  greeting: string
  signature: string
  metadata: EmailMetadata
}

interface PersonalizedEmailResponse {
  success: boolean
  parsedEmail?: ParsedEmailData
  error?: string
  attempts?: number
}

class AIEmailService {
  private openai: OpenAI

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    })
  }

  /**
   * AI를 사용하여 고객 이메일에 대한 응답 생성
   */
  async generateEmailReply(context: EmailContext): Promise<AIEmailResponse> {
    try {
      const systemPrompt = `당신은 그린다에이아이의 Rinda Expert 담당자입니다.
      간결하고 핵심적으로 답변하세요. 최대 5-7문장으로 답변하세요.

      [회사 정보]
      - Rinda Expert: K-뷰티 글로벌 세일즈 솔루션
      - 5만개 바이어 DB, 18%+ 리드 전환율
      - 주요 파트너: 세포라, 얼타, 아마존 등

      [답변 원칙]
      1. 매우 간단하고 짧게 답변 (5-7문장)
      2. 핵심만 전달
      3. 불필요한 설명 제거
      4. 구체적 논의 필요시 즉시 미팅 제안
      5. 연락처나 전화번호 문의 시: 고객이 남긴 번호로 연락드리겠다고 안내

      [연락처 문의 대응]
      고객이 연락처나 전화번호를 요청하는 경우:
      "강호진 대표(010-6326-9009)에게 직접 연락 부탁드립니다."

      [미팅 제안 시]
      "더 자세히 도와드리기 위해 30분 정도 시간 내어 직접 설명드리고 싶습니다.

      🗓️ https://calendly.com/grindaai/rinda-demo"`

      const userPrompt = `고객 이메일:
      발신자: ${context.fromEmail}
      제목: ${context.subject}
      내용: ${context.content}

      위 문의에 대해 5-7문장 이내로 간결하게 답변하세요.
      인사말 포함, 핵심 답변, 필요시 미팅 링크만 포함하세요.`

      const completion = await pRetry(
        () =>
          this.openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: userPrompt,
              },
            ],
          }),
        { retries: 3 },
      )

      const replyContent = completion.choices[0]?.message?.content

      if (!replyContent) {
        throw new Error("AI 응답 생성 실패")
      }

      console.log("✅ AI 응답 생성 성공")
      console.log(`- 사용된 토큰: ${completion.usage?.total_tokens}`)

      return {
        success: true,
        replyContent,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류 발생"
      console.error("❌ AI 응답 생성 실패:", errorMessage)

      // 에러 타입에 따른 처리
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "insufficient_quota"
      ) {
        return {
          success: false,
          error: "OpenAI API 사용량 한도 초과",
        }
      }

      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        return {
          success: false,
          error: "OpenAI API 키 인증 실패",
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * Generate personalized email with quality judgment and parsing
   * @param context - Email context with optional additional context
   * @param customPrompt - Custom system prompt for email generation
   * @param maxRetries - Maximum number of generation attempts (default: 3)
   */
  async generatePersonalizedEmail(
    context: PersonalizedEmailContext,
    customPrompt: string,
    maxRetries: number = 3,
  ): Promise<PersonalizedEmailResponse> {
    let attempts = 0
    let lastError: string = ""

    while (attempts < maxRetries) {
      attempts++

      try {
        console.log(`🔄 이메일 생성 시도 ${attempts}/${maxRetries}`)

        // Step 1: Generate draft
        const draft = await this.generatePersonalizedEmailDraft(context, customPrompt)
        console.log("✅ 초안 생성 완료")

        // Step 2: Judge quality
        const judgment = await this.judgeEmailQuality(draft, context)
        console.log(
          `📊 품질 평가: ${judgment.qualityScore}/10, 정확성: ${judgment.accuracyScore}/10`,
        )

        if (!judgment.pass) {
          lastError = `품질 평가 불합격: ${judgment.feedback}`
          console.log(`❌ ${lastError}`)

          if (attempts < maxRetries) {
            console.log("🔄 재생성 시도...")
            continue
          } else {
            // Max retries reached, return fallback
            console.log("⚠️ 최대 재시도 횟수 도달, 폴백 사용")
            return {
              success: false,
              error: `${lastError} (${attempts}회 시도 후 실패)`,
              attempts,
            }
          }
        }

        // Step 3: Parse email content
        console.log("📝 이메일 파싱 중...")
        const parsedEmail = await this.parseEmailContent(draft)
        console.log("✅ 파싱 완료")

        return {
          success: true,
          parsedEmail,
          attempts,
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류 발생"
        lastError = errorMessage
        console.error(`❌ 시도 ${attempts} 실패:`, errorMessage)

        // Handle specific errors that shouldn't retry
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "insufficient_quota"
        ) {
          return {
            success: false,
            error: "OpenAI API 사용량 한도 초과",
            attempts,
          }
        }

        if (error && typeof error === "object" && "status" in error && error.status === 401) {
          return {
            success: false,
            error: "OpenAI API 키 인증 실패",
            attempts,
          }
        }

        // If last attempt, return error
        if (attempts >= maxRetries) {
          return {
            success: false,
            error: `${errorMessage} (${attempts}회 시도 후 실패)`,
            attempts,
          }
        }

        // Otherwise, retry
        console.log("🔄 재시도 중...")
      }
    }

    // Shouldn't reach here, but just in case
    return {
      success: false,
      error: lastError || "알 수 없는 오류로 실패",
      attempts,
    }
  }

  /**
   * Generate personalized email draft (private helper)
   */
  private async generatePersonalizedEmailDraft(
    context: PersonalizedEmailContext,
    customPrompt: string,
  ): Promise<string> {
    const userPrompt = `고객 이메일:
발신자: ${context.fromEmail}
제목: ${context.subject}
내용: ${context.content}
${context.additionalContext ? `추가 컨텍스트: ${context.additionalContext}` : ""}

위 정보를 바탕으로 이메일 답변을 작성하세요.`

    const completion = await pRetry(
      () =>
        this.openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: customPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      { retries: 3 },
    )

    const draft = completion.choices[0]?.message?.content
    if (!draft) {
      throw new Error("이메일 초안 생성 실패")
    }

    return draft
  }

  /**
   * Judge email quality (private helper)
   */
  private async judgeEmailQuality(
    emailContent: string,
    originalContext: PersonalizedEmailContext,
  ): Promise<JudgmentResult> {
    const judgePrompt = `당신은 이메일 품질 평가 전문가입니다. 다음 기준으로 이메일을 평가하세요:

1. 품질/톤 (0-10점): 전문성, 적절한 어조, 문법
2. 정확성 (0-10점): 고객 질문에 올바르게 답변했는지
3. 합격/불합격: 7점 미만이면 불합격

원본 고객 이메일:
제목: ${originalContext.subject}
내용: ${originalContext.content}

평가할 답변 이메일:
${emailContent}`

    const judgmentSchema = z.object({
      pass: z.boolean(),
      qualityScore: z.number().min(0).max(10),
      accuracyScore: z.number().min(0).max(10),
      feedback: z.string(),
      issues: z.array(z.string()).optional(),
    })

    const response = await pRetry(
      () =>
        this.openai.responses.parse({
          model: "gpt-4",
          input: [
            {
              role: "system",
              content: "당신은 이메일 품질 평가 전문가입니다.",
            },
            {
              role: "user",
              content: judgePrompt,
            },
          ],
          text: {
            format: zodTextFormat(judgmentSchema, "JudgmentResult"),
          },
        }),
      { retries: 3 },
    )

    const result = response.output_parsed
    if (!result) {
      throw new Error("이메일 평가 실패")
    }

    return result as JudgmentResult
  }

  /**
   * Parse email content into structured format (private helper)
   */
  private async parseEmailContent(emailContent: string): Promise<ParsedEmailData> {
    const parsePrompt = `다음 이메일을 분석하여 구조화된 데이터로 추출하세요:

${emailContent}`

    const emailMetadataSchema = z.object({
      sentiment: z.enum(["positive", "neutral", "negative"]),
      intent: z.array(z.string()),
      topics: z.array(z.string()),
      actionItems: z.array(z.string()),
    })

    const parsedEmailSchema = z.object({
      subject: z.string(),
      body: z.string(),
      greeting: z.string(),
      signature: z.string(),
      metadata: emailMetadataSchema,
    })

    const response = await pRetry(
      () =>
        this.openai.responses.parse({
          model: "gpt-4",
          input: [
            {
              role: "system",
              content: "당신은 이메일 파싱 전문가입니다.",
            },
            {
              role: "user",
              content: parsePrompt,
            },
          ],
          text: {
            format: zodTextFormat(parsedEmailSchema, "ParsedEmail"),
          },
        }),
      { retries: 3 },
    )

    const result = response.output_parsed
    if (!result) {
      throw new Error("이메일 파싱 실패")
    }

    return result as ParsedEmailData
  }

  /**
   * 기본 응답 템플릿 (AI 실패 시 사용)
   */
  generateFallbackReply(context: EmailContext): string {
    return `안녕하세요,

문의 주셔서 감사합니다.
"${context.subject || "문의사항"}"에 대해 확인했습니다.

담당자가 24시간 이내 답변 드리겠습니다.

감사합니다.

Rinda Expert 팀
📧 rinda@send.grinda.ai`
  }
}

// 싱글톤 인스턴스
let aiEmailServiceInstance: AIEmailService | null = null

/**
 * AI 이메일 서비스 인스턴스 가져오기
 */
export function getAIEmailService(): AIEmailService {
  if (!aiEmailServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다")
    }
    aiEmailServiceInstance = new AIEmailService(apiKey)
  }
  return aiEmailServiceInstance
}

export type {
  EmailContext,
  AIEmailResponse,
  PersonalizedEmailContext,
  JudgmentResult,
  EmailMetadata,
  ParsedEmailData,
  PersonalizedEmailResponse,
}
export { AIEmailService }
