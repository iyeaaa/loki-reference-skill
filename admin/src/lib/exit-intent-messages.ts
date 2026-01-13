/**
 * 온보딩 이탈 방지 모달 메시지
 * 각 단계별 고객 심리 기반 카피라이팅
 * - RINDA AI 에이전트 브랜딩 반영
 * - 수출 초보 기업을 위한 신뢰감 있는 톤
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
 * - RINDA 브랜딩 일관화
 * - 친근하면서 전문적인 톤
 * - 완료 근접감 강조
 */
export const exitIntentMessages: Record<OnboardingStep, ExitIntentMessage> = {
  // Survey Step 1: 산업군 선택
  survey1: {
    title: {
      ko: "잠깐, 거의 다 됐어요",
      en: "Wait, almost there",
    },
    description: {
      ko: "간단한 질문 2개만 답하면\n맞춤 바이어를 찾아드려요",
      en: "Answer just 2 questions\nand we'll find perfect buyers for you",
    },
    stayButton: {
      ko: "계속하기",
      en: "Continue",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },

  // Survey Step 2: 국가 선택
  survey2: {
    title: {
      ko: "마지막 질문이에요",
      en: "Last question",
    },
    description: {
      ko: "진출 국가만 선택하면\n바로 바이어를 찾기 시작해요",
      en: "Just pick your target market\nand we start finding buyers immediately",
    },
    stayButton: {
      ko: "마저 하기",
      en: "Finish",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },

  // Login/Signup
  login: {
    title: {
      ko: "가입하면 바로 시작해요",
      en: "Sign up to start now",
    },
    description: {
      ko: "간편 가입 후 바로\n해외 바이어를 찾아드려요",
      en: "Quick signup and\nwe start finding international buyers for you",
    },
    stayButton: {
      ko: "가입하기",
      en: "Sign up",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },

  // Onboarding Step 1: 회사 정보
  step1: {
    title: {
      ko: "곧 바이어를 찾아드려요",
      en: "We'll find buyers soon",
    },
    description: {
      ko: "회사 정보만 입력하면\n맞춤 바이어 검색을 시작해요",
      en: "Enter company info and\nwe start searching for matched buyers",
    },
    stayButton: {
      ko: "입력하기",
      en: "Enter info",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },

  // Onboarding Step 2: 이메일 연동
  step2: {
    title: {
      ko: "한 단계만 더, 곧 영업 시작",
      en: "One more step to start",
    },
    description: {
      ko: "이메일만 연동하면\n바이어에게 연락을 대신 드려요",
      en: "Connect your email and\nwe'll reach out to buyers for you",
    },
    stayButton: {
      ko: "연동하기",
      en: "Connect",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },

  // Onboarding Step 3: 진행 중
  step3: {
    title: {
      ko: "열심히 준비하고 있어요",
      en: "We're preparing for you",
    },
    description: {
      ko: "잠시만 기다려주세요\n곧 해외 영업을 시작할 수 있어요",
      en: "Just a moment\nYou'll start international sales soon",
    },
    stayButton: {
      ko: "기다리기",
      en: "Wait",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },

  // Onboarding Step 4: 최종 확인
  step4: {
    title: {
      ko: "마지막 확인만 하면 영업 시작",
      en: "One confirmation and we start",
    },
    description: {
      ko: "바이어와 이메일을 확인하고\n영업 시작 버튼을 눌러주세요",
      en: "Review buyers and emails\nthen click start to begin outreach",
    },
    stayButton: {
      ko: "시작하기",
      en: "Start",
    },
    leaveButton: {
      ko: "나중에",
      en: "Later",
    },
  },
}

/**
 * 단계명으로 메시지 가져오기 (헬퍼 함수)
 */
export function getExitIntentMessage(step: OnboardingStep): ExitIntentMessage {
  return exitIntentMessages[step]
}
