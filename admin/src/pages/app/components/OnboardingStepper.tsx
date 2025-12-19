import { ArrowLeft, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"

type OnboardingStepperProps = {
  currentStep: number
  completedSteps?: number[]
}

export function OnboardingStepper({ currentStep, completedSteps = [] }: OnboardingStepperProps) {
  const { t } = useTranslation()
  const [, setSearchParams] = useSearchParams()

  // Updated: 5 steps → 4 steps (combined lead discovery + email generation)
  // 토스 스타일: 사용자 행동/결과 중심의 친근한 라벨
  const steps = [
    { number: 1, label: t("app.onboarding.step1.label", "회사 소개") },
    { number: 2, label: t("app.onboarding.step2.labelNew", "AI가 준비") },
    { number: 3, label: t("app.onboarding.step3.labelNew", "발송 연결") },
    { number: 4, label: t("app.onboarding.step4.labelNew", "시작하기") },
  ]

  const handleGoBack = () => {
    if (currentStep > 1) {
      setSearchParams({ step: String(currentStep - 1) })
    }
  }

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

      {/* Back button - only show on step 2+, positioned below stepper */}
      {currentStep > 1 && (
        <div className="mt-4 flex justify-start">
          <button
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-gray-500 text-sm transition-colors hover:bg-gray-100 hover:text-gray-700"
            onClick={handleGoBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("app.onboarding.back", "이전")}
          </button>
        </div>
      )}
    </div>
  )
}
