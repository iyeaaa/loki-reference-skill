/**
 * 온보딩 이탈 방지 모달 메시지
 * 각 단계별 고객 심리 기반 카피라이팅
 *
 * 심리 원칙:
 * 1. 손실 회피 (Loss Aversion): 놓치면 아쉬운 것 강조
 * 2. 희소성/긴급성: 지금이 기회라는 느낌
 * 3. 사회적 증거: 다른 기업들도 사용 중
 * 4. 구체적 가치: 명확한 혜택 제시
 */

export type OnboardingStep = "survey1" | "survey2" | "login" | "step1" | "step2" | "step3" | "step4"

export type ExitIntentMessage = {
  title: { ko: string; en: string }
  description: { ko: string; en: string }
  stayButton: { ko: string; en: string }
  leaveButton: { ko: string; en: string }
  // 🆕 UX 개선: 추가 심리적 요소
  urgencyBadge?: { ko: string; en: string } // 긴급성 배지
  benefits?: Array<{ ko: string; en: string }> // 혜택 체크리스트
  socialProof?: { ko: string; en: string } // 사회적 증거
  lossMessage?: { ko: string; en: string } // 손실 회피 메시지
}

/**
 * 단계별 이탈 방지 메시지
 * - 고객친화적 톤
 * - 손실 회피 심리 활용
 * - 구체적 가치 제안
 * - 긴급성/희소성 강조
 */
export const exitIntentMessages: Record<OnboardingStep, ExitIntentMessage> = {
  // Survey Step 1: 산업군 선택
  survey1: {
    title: {
      ko: "잠깐! 이대로 가시면 아까워요",
      en: "Wait! Don't miss this opportunity",
    },
    description: {
      ko: "딱 1분만 투자하시면\n맞춤 해외 바이어를 무료로 찾아드려요",
      en: "Invest just 1 minute\nand get free access to matched international buyers",
    },
    stayButton: {
      ko: "무료로 바이어 찾기",
      en: "Find Buyers for Free",
    },
    leaveButton: {
      ko: "다음에 할게요",
      en: "I'll do it later",
    },
    urgencyBadge: {
      ko: "무료 체험 중",
      en: "Free Trial",
    },
    benefits: [
      { ko: "AI가 24시간 바이어 탐색", en: "AI searches buyers 24/7" },
      { ko: "검증된 해외 바이어 매칭", en: "Verified international buyer matching" },
      { ko: "200개+ 기업이 사용 중", en: "Used by 200+ companies" },
    ],
    socialProof: {
      ko: "오늘만 12개 기업이 바이어를 찾았어요",
      en: "12 companies found buyers today",
    },
    lossMessage: {
      ko: "지금 떠나시면, 해외 진출 기회를 놓칠 수 있어요",
      en: "Leaving now may mean missing export opportunities",
    },
  },

  // Survey Step 2: 국가 선택
  survey2: {
    title: {
      ko: "마지막 한 단계만 남았어요!",
      en: "Just one step left!",
    },
    description: {
      ko: "진출 국가만 선택하면\n바로 AI가 바이어를 찾기 시작해요",
      en: "Just pick your target market\nand AI starts finding buyers immediately",
    },
    stayButton: {
      ko: "지금 완료하기",
      en: "Complete Now",
    },
    leaveButton: {
      ko: "다음에 할게요",
      en: "I'll do it later",
    },
    urgencyBadge: {
      ko: "거의 다 됐어요!",
      en: "Almost done!",
    },
    benefits: [
      { ko: "클릭 한 번이면 끝", en: "Just one click away" },
      { ko: "바로 AI 바이어 탐색 시작", en: "AI buyer search starts immediately" },
      { ko: "평균 3일 내 바이어 매칭", en: "Buyer matching in avg. 3 days" },
    ],
    lossMessage: {
      ko: "여기서 멈추면 지금까지 입력이 모두 사라져요",
      en: "Your progress will be lost if you leave now",
    },
  },

  // Login/Signup
  login: {
    title: {
      ko: "가입하면 바로 시작해요!",
      en: "Sign up to start now!",
    },
    description: {
      ko: "간편 가입 후 바로\n해외 바이어 탐색을 시작할 수 있어요",
      en: "Quick signup and you can\nstart exploring international buyers right away",
    },
    stayButton: {
      ko: "가입할게요",
      en: "I'll sign up",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
    },
  },

  // Onboarding Step 1: 회사 정보
  step1: {
    title: {
      ko: "회사 정보만 입력하면 돼요!",
      en: "Just enter company info!",
    },
    description: {
      ko: "기본 정보 입력 후\nAI가 맞춤 바이어를 찾기 시작해요",
      en: "Enter basic info and\nAI starts finding perfect buyers for you",
    },
    stayButton: {
      ko: "입력할게요",
      en: "I'll enter it",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
    },
  },

  // Onboarding Step 2: 이메일 연동
  step2: {
    title: {
      ko: "이메일 연동하면 자동 영업 시작!",
      en: "Connect email for auto-sales!",
    },
    description: {
      ko: "이메일만 연동하면\nAI가 자동으로 바이어에게 연락해요",
      en: "Connect your email and\nAI automatically contacts buyers for you",
    },
    stayButton: {
      ko: "연동할게요",
      en: "I'll connect",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
    },
  },

  // Onboarding Step 3: 진행 중
  step3: {
    title: {
      ko: "조금만 기다려주세요!",
      en: "Just a moment!",
    },
    description: {
      ko: "AI가 열심히 준비하고 있어요\n곧 해외 영업을 시작할 수 있어요",
      en: "AI is working hard\nYou'll start international sales soon",
    },
    stayButton: {
      ko: "기다릴게요",
      en: "I'll wait",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
    },
  },

  // Onboarding Step 4: 최종 확인
  step4: {
    title: {
      ko: "한 클릭으로 해외 영업 시작!",
      en: "One click to start!",
    },
    description: {
      ko: "마지막 확인만 하면\n해외 바이어 발굴이 시작돼요",
      en: "One final confirmation and\ninternational buyer discovery begins",
    },
    stayButton: {
      ko: "시작할게요",
      en: "I'll start",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
    },
  },
}

/**
 * 단계명으로 메시지 가져오기 (헬퍼 함수)
 */
export function getExitIntentMessage(step: OnboardingStep): ExitIntentMessage {
  return exitIntentMessages[step]
}
