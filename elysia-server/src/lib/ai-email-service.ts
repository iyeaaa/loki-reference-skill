// DEPRECATED: This feature is deprecated and only used in old workflows.

import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"
import logger from "../utils/logger"

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

class AIEmailService {
  private openai: ReturnType<typeof createOpenAI>

  constructor(apiKey: string) {
    this.openai = createOpenAI({
      apiKey: apiKey,
    })
  }

  /**
   * AI를 사용하여 시퀀스 이메일 초안 생성
   */
  async generateSequenceEmail(context: {
    companyName: string
    contactName?: string
    industry?: string
    website?: string
    prompt?: string
  }): Promise<{
    success: boolean
    subject?: string
    bodyText?: string
    error?: string
  }> {
    try {
      const systemPrompt = `당신은 전문적인 비즈니스 이메일 작성 전문가입니다.
고객 정보를 바탕으로 맞춤형 영업/제안 이메일을 작성해주세요.

[고객 정보]
- 회사명: ${context.companyName}
- 담당자: ${context.contactName || "담당자"}
${context.industry ? `- 업종: ${context.industry}` : ""}
${context.website ? `- 웹사이트: ${context.website}` : ""}

[작성 원칙]
1. 친근하면서도 전문적인 톤
2. 회사와 업종의 특성을 고려한 개인화된 내용
3. 명확한 가치 제안
4. 구체적인 행동 촉구 (CTA)
5. 간결하고 읽기 쉬운 구조

[이메일 구조]
제목: [한 줄로 명확한 제목]

본문:
[친근한 인사]
[회사/업종 맞춤 제안]
[구체적인 혜택]
[명확한 CTA]
[전문적인 마무리]

응답 형식은 반드시 다음과 같이 해주세요:
SUBJECT: [이메일 제목]
BODY:
[이메일 본문]`

      const userPrompt =
        context.prompt || "위 고객 정보를 바탕으로 맞춤형 영업 이메일을 작성해주세요."

      const { text } = await generateText({
        model: this.openai("gpt-4-turbo-preview"),
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.7,
      })

      if (!text || text.trim().length === 0) {
        throw new Error("AI 응답 생성 실패")
      }

      // Parse response
      const subjectMatch = text.match(/SUBJECT:\s*(.+)(?:\n|$)/)
      const bodyMatch = text.match(/BODY:\s*([\s\S]+)$/)

      if (!subjectMatch || !bodyMatch) {
        throw new Error("AI 응답 형식 오류")
      }

      return {
        success: true,
        subject: subjectMatch[1]?.trim() || "",
        bodyText: bodyMatch[1]?.trim() || "",
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류 발생"
      logger.error({ err: error }, "AI email draft generation failed")

      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  /**
   * AI를 사용하여 고객 이메일에 대한 응답 생성 (sendgrid inbound parse)
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

      const { text } = await generateText({
        model: this.openai("gpt-4o-mini"),
        system: systemPrompt,
        prompt: userPrompt,
      })

      if (!text || text.trim().length === 0) {
        throw new Error("AI 응답 생성 실패")
      }

      logger.info({ content: text }, "AI response generated successfully")

      return {
        success: true,
        replyContent: text,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류 발생"
      logger.error({ err: error }, "AI response generation failed")

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

export type { EmailContext, AIEmailResponse }
export { AIEmailService }
