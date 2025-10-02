import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

interface LeadContext {
  companyName: string
  contactName?: string
  contactEmail: string
  industry?: string
  website?: string
  size?: string
  [key: string]: string | undefined
}

interface GenerateEmailOptions {
  prompt: string
  lead: LeadContext
  model?: string
  temperature?: number
}

interface GeneratedEmail {
  subject: string
  bodyText: string
  bodyHtml?: string
}

class AIWorkflowEmailService {
  private openai: ReturnType<typeof createOpenAI>

  constructor(apiKey: string) {
    this.openai = createOpenAI({
      apiKey: apiKey,
    })
  }

  /**
   * 프롬프트의 변수를 실제 값으로 치환
   */
  private replaceVariables(template: string, context: LeadContext): string {
    let result = template

    // 영문 변수 치환
    for (const [key, value] of Object.entries(context)) {
      if (value) {
        const regex = new RegExp(`{{${key}}}`, 'gi')
        result = result.replace(regex, value)
      }
    }

    // 한글 변수 매핑 (모든 리드 필드)
    const koreanMap: Record<string, string> = {
      // 회사 정보
      회사명: context.companyName || '',
      웹사이트: context.website || '',
      업종: context.industry || '',
      설명: context.description || '',
      직원수: context.employeeCount || '',
      규모: context.size || '',
      설립연도: context.foundedYear || '',
      
      // 위치 정보
      국가: context.country || '',
      도시: context.city || '',
      주: context.state || '',
      '주/도': context.state || '',
      주소: context.address || '',
      
      // 연락처
      담당자명: context.contactName || '',
      이름: context.contactName || '',
      이메일: context.contactEmail || '',
      
      // 리드 관리
      리드소스: context.leadSource || '',
      리드상태: context.leadStatus || '',
      리드점수: context.leadScore || '',
    }

    for (const [key, value] of Object.entries(koreanMap)) {
      if (value) {
        const regex = new RegExp(`{{${key}}}`, 'g')
        result = result.replace(regex, value)
      }
    }

    return result
  }

  /**
   * AI를 사용하여 개별 이메일 생성
   */
  async generateEmail(options: GenerateEmailOptions): Promise<GeneratedEmail> {
    const { prompt, lead, model = 'gpt-3.5-turbo', temperature = 0.7 } = options

    try {
      // 1. 프롬프트 변수 치환
      const processedPrompt = this.replaceVariables(prompt, lead)

      // 2. 시스템 프롬프트 구성
      const systemPrompt = `당신은 전문적인 비즈니스 이메일 작성 전문가입니다.
고객 정보를 바탕으로 맞춤형 영업/제안 이메일을 작성해주세요.

[고객 정보]
- 회사명: ${lead.companyName}
- 담당자: ${lead.contactName || '담당자'}
- 이메일: ${lead.contactEmail}
- 업종: ${lead.industry || '알 수 없음'}
${lead.website ? `- 웹사이트: ${lead.website}` : ''}
${lead.size ? `- 규모: ${lead.size}` : ''}

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

      // 3. AI API 호출
      const { text } = await generateText({
        model: this.openai(model),
        system: systemPrompt,
        prompt: processedPrompt,
        temperature,
      })

      // 4. 응답 파싱
      const parsedEmail = this.parseAIResponse(text)

      return parsedEmail
    } catch (error) {
      console.error('[AI Email Generation] Failed:', error)
      throw error
    }
  }

  /**
   * AI 응답에서 제목과 본문 파싱
   */
  private parseAIResponse(response: string): GeneratedEmail {
    const lines = response.trim().split('\n')
    let subject = ''
    let bodyLines: string[] = []
    let inBody = false

    for (const line of lines) {
      if (line.startsWith('SUBJECT:')) {
        subject = line.substring('SUBJECT:'.length).trim()
      } else if (line.startsWith('BODY:')) {
        inBody = true
      } else if (inBody) {
        bodyLines.push(line)
      }
    }

    // SUBJECT/BODY 형식이 아니면 전체를 본문으로
    if (!subject && bodyLines.length === 0) {
      // 첫 줄을 제목으로, 나머지를 본문으로
      subject = lines[0] || '제목 없음'
      bodyLines = lines.slice(1)
    }

    const bodyText = bodyLines.join('\n').trim()

    // HTML 버전 생성 (간단한 변환)
    const bodyHtml = bodyText
      .split('\n\n')
      .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('\n')

    return {
      subject,
      bodyText,
      bodyHtml,
    }
  }

  /**
   * 여러 lead에 대해 일괄 생성 (순차 처리)
   */
  async generateBulkEmails(
    prompt: string,
    leads: LeadContext[],
    model?: string,
    onProgress?: (generated: number, total: number) => void,
  ): Promise<{
    results: Array<{ leadId?: string; email?: GeneratedEmail; error?: string }>
    generated: number
    failed: number
  }> {
    const results: Array<{ leadId?: string; email?: GeneratedEmail; error?: string }> = []
    let generated = 0
    let failed = 0

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      if (!lead) {
        continue
      }

      try {
        const email = await this.generateEmail({
          prompt,
          lead,
          model,
        })

        results.push({
          email,
        })
        generated++

        onProgress?.(generated + failed, leads.length)

        // Rate limiting: 1초 대기
        if (i < leads.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to generate email for ${lead.companyName}:`, errorMessage)

        results.push({
          error: errorMessage,
        })
        failed++

        onProgress?.(generated + failed, leads.length)
      }
    }

    return {
      results,
      generated,
      failed,
    }
  }
}

// 싱글톤 인스턴스
let aiWorkflowEmailServiceInstance: AIWorkflowEmailService | null = null

/**
 * AI 워크플로우 이메일 서비스 인스턴스 가져오기
 */
export function getAIWorkflowEmailService(): AIWorkflowEmailService {
  if (!aiWorkflowEmailServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다')
    }
    aiWorkflowEmailServiceInstance = new AIWorkflowEmailService(apiKey)
  }
  return aiWorkflowEmailServiceInstance
}

export type { GenerateEmailOptions, GeneratedEmail, LeadContext }
export { AIWorkflowEmailService }
