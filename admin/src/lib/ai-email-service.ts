import { OpenAI } from "openai";

interface EmailContext {
  fromEmail: string;
  subject: string;
  content: string;
  receivedTime: Date;
}

interface AIEmailResponse {
  success: boolean;
  replyContent?: string;
  error?: string;
}

class AIEmailService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * AI를 사용하여 고객 이메일에 대한 응답 생성
   */
  async generateEmailReply(context: EmailContext): Promise<AIEmailResponse> {
    try {
      const systemPrompt = `당신은 그린다에이아이(GRINDA AI)의 Rinda Expert 고객 서비스 담당자입니다.
      K-뷰티 글로벌 진출 전문가로서 친절하고 전문적인 톤으로 고객의 문의에 답변해주세요.

      [회사 정보]
      회사명: 주식회사 그린다에이아이
      대표: 강호진
      위치: 대전광역시 유성구 대학로 99, 대전팁스타운 503호
      이메일: rinda@partners.grinda.ai

      [주요 서비스]
      1. Rinda Expert - K-뷰티 전문 글로벌 세일즈 솔루션
         - K-뷰티 브랜드 특화 해외 진출 지원
         - 5만여 개 글로벌 뷰티 바이어 DB 보유
         - 세포라, 얼타, 올리브영, 아마존 등 주요 리테일러 연결
         - 프로세스: 맞춤형 진출 전략 → 바이어 탐색 → 개인화 마케팅 → 팔로업 세일즈
         - 지원 카테고리: 스킨케어, 색조화장품, 헤어케어, 바디케어, 향수, 뷰티디바이스
         - 서비스 특징:
           • 국가별 시장 분석 및 진출 난이도 평가
           • ICP 기반 바이어 매칭
           • 바이어별 개인화 이메일 시퀀스 자동 발송
           • 온/오프라인 미팅 주선 및 통역 지원
         - 성과: 18%+ 리드 전환율, 2,400+ 글로벌 바이어 네트워크

      2. FINGU - 금융 AI 에이전트
         - 다국어 실시간 번역
         - 사내 문서 처리 어시스턴트

      3. 맞춤형 LLM 엔터프라이즈
         - 기업 특화 AI 구축
         - 80% 이상 비용 절감
         - GPT-4 대비 10배 저렴한 비용

      [핵심 기술력]
      - 자체 개발 LLM (GPT-4 성능 초과)
      - 17개국 언어 지원
      - End-to-End 자동화 (86% 비용 절감)
      - 검증된 실적: 42개 기업 파트너십

      응답 지침:
      - 한국어로 답변하세요
      - 정중하고 친근한 어조를 사용하세요
      - K-뷰티 브랜드의 글로벌 진출에 대한 전문적인 조언을 제공하세요
      - Rinda Expert 서비스의 장점과 특징을 자연스럽게 소개하세요

      미팅 유도 전략:
      - 복잡한 기술적 질문이나 맞춤형 견적이 필요한 경우 → 미팅 제안
      - 구체적인 가격 문의 → "고객님의 니즈에 맞는 정확한 견적을 위해 미팅을 제안드립니다"
      - 상세한 구현 계획 필요시 → "더 자세한 논의를 위해 전문가와의 상담을 추천드립니다"
      - 미팅 제안 시 반드시 Calendly 링크 포함:
        "편하신 시간에 미팅 일정을 잡으실 수 있도록 링크를 공유드립니다:
        🗓️ https://calendly.com/grindaai/rinda-demo"
      - 링크와 함께 추가 안내:
        • "위 링크에서 편하신 시간을 선택해주시면 자동으로 일정이 확정됩니다"
        • "30분 무료 데모 상담입니다"
        • "원하시는 시간이 없으시면 별도로 말씀해주세요"

      일정 조율:
      - Calendly 링크를 우선적으로 안내
      - 온라인 미팅 (Zoom) 기본 제공
      - 오프라인 미팅도 가능함을 추가 안내
      - 무료 상담임을 강조
      - 미팅 시간: 30분 데모

      - 감사 인사로 마무리하세요`;

      const userPrompt = `다음은 고객이 보낸 이메일입니다:

      발신자: ${context.fromEmail}
      제목: ${context.subject}
      내용: ${context.content}

      이 이메일에 대한 적절한 답변을 작성해주세요.

      답변 작성 시 주의사항:
      1. 간단한 문의는 직접 답변
      2. 복잡하거나 구체적인 논의가 필요한 경우 미팅으로 자연스럽게 유도
      3. 미팅 제안 시 구체적인 일정 옵션을 반드시 포함
      4. 고객의 문의사항을 확인했다는 내용 포함`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-5",
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
      });

      const replyContent = completion.choices[0]?.message?.content;

      if (!replyContent) {
        throw new Error("AI 응답 생성 실패");
      }

      console.log("✅ AI 응답 생성 성공");
      console.log(`- 사용된 토큰: ${completion.usage?.total_tokens}`);

      return {
        success: true,
        replyContent,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류 발생';
      console.error("❌ AI 응답 생성 실패:", errorMessage);

      // 에러 타입에 따른 처리
      if (error && typeof error === 'object' && 'code' in error && error.code === 'insufficient_quota') {
        return {
          success: false,
          error: "OpenAI API 사용량 한도 초과",
        };
      }

      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        return {
          success: false,
          error: "OpenAI API 키 인증 실패",
        };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 기본 응답 템플릿 (AI 실패 시 사용)
   */
  generateFallbackReply(context: EmailContext): string {
    const now = new Date();
    const formattedTime = now.toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const contentSummary = context.content
      ? context.content.trim().length > 200
        ? context.content.trim().substring(0, 200) + "..."
        : context.content.trim()
      : "(내용 없음)";

    return `안녕하세요,

소중한 문의 주셔서 감사합니다.

[접수 정보]
제목: ${context.subject || "제목 없음"}
내용: ${contentSummary}

접수시간: ${formattedTime}

고객님의 문의사항을 확인했으며, 담당자가 내용을 검토 중입니다.
24시간 이내 상세한 답변을 드리도록 하겠습니다.

감사합니다.

Rinda Expert 팀
그린다에이아이

📧 rinda@partners.grinda.ai
🌐 https://rinda.ai
📞 무료 상담 신청 가능`;
  }
}

// 싱글톤 인스턴스
let aiEmailServiceInstance: AIEmailService | null = null;

/**
 * AI 이메일 서비스 인스턴스 가져오기
 */
export function getAIEmailService(): AIEmailService {
  if (!aiEmailServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다");
    }
    aiEmailServiceInstance = new AIEmailService(apiKey);
  }
  return aiEmailServiceInstance;
}

export type { EmailContext, AIEmailResponse };
export { AIEmailService };