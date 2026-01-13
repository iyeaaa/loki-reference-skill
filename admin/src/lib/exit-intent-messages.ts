/**
 * 온보딩 이탈 방지 모달 메시지
 * 각 단계별 고객 심리 기반 카피라이팅
 */

export type OnboardingStep =
  | "survey1"
  | "survey2"
  | "login"
  | "step1"
  | "step2"
  | "step3"
  | "step4"

export interface ExitIntentMessage {
  title: { ko: string; en: string }
  description: { ko: string; en: string }
  stayButton: { ko: string; en: string }
  leaveButton: { ko: string; en: string }
}

/**
 * 단계별 이탈 방지 메시지
 * - 고객친화적 톤
 * - 부담 최소화 + 가치 제안
 * - 완료 근접감 강조
 */
export const exitIntentMessages: Record<OnboardingStep, ExitIntentMessage> = {
  // Survey Step 1: 산업군 선택
  survey1: {
    title: {
      ko: "잠깐만요! 딱 1분이면 돼요",
      en: "Wait! Just 1 minute",
    },
    description: {
      ko: "간단한 질문 2개만 답하면\nAI가 맞춤 바이어를 찾아드려요",
      en: "Answer just 2 questions\nand AI will find perfect buyers for you",
    },
    stayButton: {
      ko: "계속할게요",
      en: "I'll continue",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
    },
  },

  // Survey Step 2: 국가 선택
  survey2: {
    title: {
      ko: "마지막 질문이에요!",
      en: "Last question!",
    },
    description: {
      ko: "진출 국가만 선택하면\n바로 AI가 바이어를 찾기 시작해요",
      en: "Just pick your target market\nand AI starts finding buyers immediately",
    },
    stayButton: {
      ko: "마저 할게요",
      en: "I'll finish",
    },
    leaveButton: {
      ko: "나중에 할게요",
      en: "Maybe later",
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
