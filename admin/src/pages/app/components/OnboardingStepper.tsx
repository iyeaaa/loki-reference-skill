import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

type OnboardingStepperProps = {
  currentStep: number
  completedSteps?: number[]
  totalSteps?: 2 | 4 // 2단계 또는 4단계 플로우
}

export function OnboardingStepper({
  currentStep,
  completedSteps = [],
  totalSteps = 2,
}: OnboardingStepperProps) {
  const { t } = useTranslation()

  // NEW: 2-step onboarding flow
  // Step 1: 회사 정보 입력
  // Step 2: AI 어시스턴트 (바이어 검색 + 이메일 작성 + 연동 + 발송)
  const twoSteps = [
    { number: 1, label: t("app.onboarding.step1.label", "회사 정보 입력") },
    { number: 2, label: t("app.onboarding.step2.chatLabel", "AI 어시스턴트") },
  ]

  // Legacy: 4-step onboarding flow (for backward compatibility)
  const fourSteps = [
    { number: 1, label: t("app.onboarding.step1.label", "정보 입력") },
    { number: 2, label: t("app.onboarding.step2.labelNew", "이메일 연동") },
    { number: 3, label: t("app.onboarding.step3.labelNew", "바이어 찾고 이메일 생성") },
    { number: 4, label: t("app.onboarding.step4.labelNew", "캠페인 실행") },
  ]

  const steps = totalSteps === 2 ? twoSteps : fourSteps

  return (
    <div className="mx-auto mb-8 max-w-2xl">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep
          const isCompleted = completedSteps.includes(step.number)
          const isLast = index === steps.length - 1

          return (
            <div className="flex items-center" key={step.number}>
              {/* Step circle and label */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full font-medium text-sm transition-colors",
                    isActive && "bg-blue-500 text-white",
                    isCompleted && "bg-blue-500 text-white",
                    !(isActive || isCompleted) && "bg-gray-200 text-gray-500",
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-sm",
                    isActive && "font-medium text-gray-900",
                    !isActive && "text-gray-400",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Dashed line connector */}
              {!isLast && <div className="mx-2 w-10 border-gray-300 border-t-2 border-dashed" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
