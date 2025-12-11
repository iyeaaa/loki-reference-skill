import { ArrowLeft, Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"

interface OnboardingStepperProps {
  currentStep: number
  completedSteps?: number[]
}

export function OnboardingStepper({ currentStep, completedSteps = [] }: OnboardingStepperProps) {
  const { t } = useTranslation()
  const [, setSearchParams] = useSearchParams()

  const steps = [
    { number: 1, label: t("app.onboarding.step1.label", "정보 입력") },
    { number: 2, label: t("app.onboarding.step2.label", "이메일 생성") },
    { number: 3, label: t("app.onboarding.step3.label", "이메일 연동") },
    { number: 4, label: t("app.onboarding.step4.label", "실행") },
  ]

  const handleGoBack = () => {
    if (currentStep > 1) {
      setSearchParams({ step: String(currentStep - 1) })
    }
  }

  return (
    <div className="flex items-center justify-between mb-8 max-w-2xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-0 justify-center">
        {steps.map((step, index) => {
          const isActive = step.number === currentStep
          const isCompleted = completedSteps.includes(step.number)
          const isLast = index === steps.length - 1

          return (
            <div key={step.number} className="flex items-center">
              {/* Step circle and label */}
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isActive && "bg-blue-500 text-white",
                    isCompleted && "bg-blue-500 text-white",
                    !isActive && !isCompleted && "bg-gray-200 text-gray-500",
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.number}
                </div>
                <span
                  className={cn(
                    "text-sm whitespace-nowrap",
                    isActive && "text-gray-900 font-medium",
                    !isActive && "text-gray-400",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {/* Dashed line connector */}
              {!isLast && <div className="w-10 mx-2 border-t-2 border-dashed border-gray-300" />}
            </div>
          )
        })}
      </div>

      {/* Back button - only show on step 2+ */}
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={handleGoBack}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 ml-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("app.onboarding.back", "before")}
        </button>
      ) : (
        <div className="w-20" /> // Placeholder to keep stepper centered
      )}
    </div>
  )
}
