import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AnimatePresence, motion } from "framer-motion"
import { useAtom } from "jotai"
import { AlertTriangle, ArrowRight, Bot } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { PageSkeleton } from "@/components/PageSkeleton"
import { Button } from "@/components/ui/button"
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { useLocalStorageEnabled } from "@/hooks/useLocalStorageEnabled"
import { useOnboardingProgress, useSaveSurvey } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { cn } from "@/lib/utils"
import { isValidSurveyData, migrateFromSessionStorage, surveyDataAtom } from "@/store/survey"
import { OnboardingStepper } from "./components/OnboardingStepper"
import { StepBuyerLoading } from "./components/StepBuyerLoading"
import { StepCompanyInfo } from "./components/StepCompanyInfo"
import { StepConfirmation } from "./components/StepConfirmation"
import { StepEmailLink } from "./components/StepEmailLink"

const WELCOME_POPUP_KEY = "rinda_welcome_popup_seen"

type WelcomeStep = {
  title: string
  description: string
}

function WelcomePopup({ open, onComplete }: { open: boolean; onComplete: () => void }) {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)

  const steps: WelcomeStep[] = [
    {
      title: t("app.welcome.step1.title", "Welcome to RINDA!"),
      description: t(
        "app.welcome.step1.description",
        "AI automatically finds overseas buyers and sells to them. Leave the complexities of overseas sales to RINDA.",
      ),
    },
    {
      title: t("app.welcome.step2.title", "Smart Lead Discovery"),
      description: t(
        "app.welcome.step2.description",
        "Our AI analyzes millions of potential buyers to find the perfect match for your business.",
      ),
    },
    {
      title: t("app.welcome.step3.title", "Let's start with 4 steps"),
      description: t(
        "app.welcome.step3.description",
        "1. Enter your company information → 2. Generate emails → 3. Link your email → 4. Execute. Everything can be done in just 5 minutes.",
      ),
    },
  ]

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const isLastStep = currentStep === steps.length - 1

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed top-[50%] left-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-xl shadow-2xl outline-none">
          {/* Blue Header */}
          <div className="flex flex-col items-center bg-blue-500 px-8 py-10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
              <Bot className="h-10 w-10 text-white" />
            </div>
            <span className="font-semibold text-lg text-white">RINDA Agent</span>
          </div>

          {/* White Content */}
          <div className="bg-white p-8">
            <AnimatePresence mode="wait">
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                initial={{ opacity: 0, x: 20 }}
                key={currentStep}
                transition={{ duration: 0.2 }}
              >
                <h2 className="mb-3 font-bold text-gray-900 text-xl">{steps[currentStep].title}</h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {steps[currentStep].description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Footer with dots and button */}
            <div className="mt-8 flex items-center justify-between">
              {/* Pagination Dots */}
              <div className="flex gap-2">
                {steps.map((_, index) => (
                  <button
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      index === currentStep ? "bg-blue-500" : "bg-gray-300",
                    )}
                    key={index}
                    onClick={() => setCurrentStep(index)}
                    type="button"
                  />
                ))}
              </div>

              {/* Next/Finish Button */}
              <Button
                className="bg-blue-500 px-6 text-white hover:bg-blue-600"
                onClick={handleNext}
              >
                {isLastStep ? t("app.welcome.finish", "Finish") : t("app.welcome.next", "Next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

function LocalStorageWarning({ open }: { open: boolean }) {
  const { i18n } = useTranslation()
  const isKorean = i18n.language === "ko"

  return (
    <Dialog open={open}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed top-[50%] left-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-xl shadow-2xl outline-none">
          {/* Warning Header */}
          <div className="flex flex-col items-center bg-yellow-500 px-8 py-10">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
              <AlertTriangle className="h-10 w-10 text-white" />
            </div>
            <span className="font-semibold text-lg text-white">
              {isKorean ? "브라우저 설정 확인 필요" : "Browser Settings Required"}
            </span>
          </div>

          {/* Warning Content */}
          <div className="bg-white p-8">
            <h2 className="mb-3 font-bold text-gray-900 text-xl">
              {isKorean ? "시크릿 모드를 해제해주세요" : "Please Disable Private Browsing"}
            </h2>
            <p className="mb-4 text-gray-600 text-sm leading-relaxed">
              {isKorean
                ? "현재 시크릿/사설 브라우징 모드를 사용 중입니다. RINDA를 이용하시려면 일반 브라우징 모드로 전환해주세요."
                : "You are currently using private/incognito browsing mode. Please switch to normal browsing mode to use RINDA."}
            </p>
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="font-medium text-gray-900 text-sm">
                {isKorean ? "해결 방법:" : "How to fix:"}
              </p>
              <ul className="mt-2 space-y-1 text-gray-600 text-sm">
                <li>
                  •{" "}
                  {isKorean
                    ? "시크릿 모드 창을 닫고 일반 창에서 다시 접속"
                    : "Close private window and open in normal window"}
                </li>
                <li>
                  •{" "}
                  {isKorean
                    ? "Safari: 개인정보 보호 브라우징 끄기"
                    : "Safari: Turn off Private Browsing"}
                </li>
                <li>
                  •{" "}
                  {isKorean
                    ? "Chrome: 시크릿 모드 대신 일반 모드 사용"
                    : "Chrome: Use normal mode instead of incognito"}
                </li>
              </ul>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export default function CompanyInformation() {
  const [searchParams, _setSearchParams] = useSearchParams()
  const [showWelcome, setShowWelcome] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const autoSaveAttempted = useRef(false)
  const [redirectLoopDetected, setRedirectLoopDetected] = useState(false)

  // Check if localStorage is enabled
  const isLocalStorageEnabled = useLocalStorageEnabled()

  // Jotai atom for survey data (from localStorage)
  const [jotaiSurveyData, setJotaiSurveyData] = useAtom(surveyDataAtom)

  // Save survey mutation
  const saveSurveyMutation = useSaveSurvey()

  // Get current user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

  console.log("[CompanyInformation] 1. userId:", userId)

  // Redirect loop detection - 무한루프 방지
  useEffect(() => {
    const REDIRECT_COUNT_KEY = "company_redirect_count"
    const REDIRECT_THRESHOLD = 5
    const currentCount = Number.parseInt(sessionStorage.getItem(REDIRECT_COUNT_KEY) || "0", 10)
    const newCount = currentCount + 1

    sessionStorage.setItem(REDIRECT_COUNT_KEY, newCount.toString())

    console.log(
      "[CompanyInformation] Redirect loop detection - count:",
      newCount,
      "threshold:",
      REDIRECT_THRESHOLD,
    )

    if (newCount >= REDIRECT_THRESHOLD) {
      console.error(
        `[CompanyInformation] ❌ Redirect loop detected! Count: ${newCount}. Breaking the loop.`,
      )
      // 루프 감지됨 - 상태 업데이트하여 에러 화면 표시
      setRedirectLoopDetected(true)
      // 카운트 리셋하여 사용자가 다시 시도할 수 있도록
      sessionStorage.removeItem(REDIRECT_COUNT_KEY)
    }
  }, [])

  // Get user's workspace
  const { data: userWorkspaces, isLoading: workspacesLoading } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  console.log(
    "[CompanyInformation] 2. workspacesLoading:",
    workspacesLoading,
    "workspaceId:",
    workspaceId,
  )

  // Get onboarding progress to check if survey was completed
  const {
    data: onboardingProgress,
    isLoading: onboardingLoading,
    refetch: refetchOnboarding,
  } = useOnboardingProgress(workspaceId, !!workspaceId)

  console.log("[CompanyInformation] 3. onboardingLoading:", onboardingLoading)
  console.log(
    "[CompanyInformation] 4. onboardingProgress:",
    JSON.stringify(onboardingProgress, null, 2),
  )

  // Check if survey data exists in DB
  const hasSurveyDataInDb = !!onboardingProgress?.surveyData

  console.log("[CompanyInformation] 5. hasSurveyDataInDb:", hasSurveyDataInDb)
  console.log("[CompanyInformation] 6. jotaiSurveyData:", JSON.stringify(jotaiSurveyData, null, 2))

  // Reset redirect count when onboarding progress is made
  useEffect(() => {
    const REDIRECT_COUNT_KEY = "company_redirect_count"

    if (hasSurveyDataInDb) {
      const currentCount = sessionStorage.getItem(REDIRECT_COUNT_KEY)
      if (currentCount && Number.parseInt(currentCount, 10) > 0) {
        console.log(
          "[CompanyInformation] Onboarding progress detected, resetting redirect count from",
          currentCount,
          "to 0",
        )
        sessionStorage.removeItem(REDIRECT_COUNT_KEY)
      }
    }
  }, [hasSurveyDataInDb])

  // Get current step from URL, default to 1
  const currentStep = Number.parseInt(searchParams.get("step") || "1", 10)

  // Migrate from sessionStorage if needed (backward compatibility)
  useEffect(() => {
    const migrated = migrateFromSessionStorage()
    if (migrated && isValidSurveyData(migrated)) {
      console.log("[CompanyInformation] Migrated survey data from sessionStorage:", migrated)
      setJotaiSurveyData(migrated)
    }
  }, [setJotaiSurveyData])

  // Auto-save survey data from Jotai to DB if DB is empty
  useEffect(() => {
    console.log("[CompanyInformation] 7. Auto-save check")
    console.log("[CompanyInformation] 8. Conditions:", {
      workspacesLoading,
      onboardingLoading,
      hasSurveyDataInDb,
      jotaiHasValidData: isValidSurveyData(jotaiSurveyData),
      autoSaveAttempted: autoSaveAttempted.current,
      isAutoSaving,
    })

    // Skip if still loading or already saving
    if (workspacesLoading || onboardingLoading || isAutoSaving) {
      console.log("[CompanyInformation] 9. Still loading or saving, skip")
      return
    }

    // Skip if no workspace
    if (!workspaceId) {
      console.log("[CompanyInformation] 10. No workspaceId, skip")
      return
    }

    // Skip if DB already has survey data
    if (hasSurveyDataInDb) {
      console.log("[CompanyInformation] 11. ✅ DB already has surveyData, no action needed")
      // Clear Jotai if DB has data (cleanup)
      if (jotaiSurveyData) {
        setJotaiSurveyData(null)
      }
      return
    }

    // Skip if already attempted
    if (autoSaveAttempted.current) {
      console.log("[CompanyInformation] 12. Already attempted auto-save, skip")
      return
    }

    // Check if Jotai has valid survey data
    if (isValidSurveyData(jotaiSurveyData)) {
      console.log("[CompanyInformation] 13. 📤 Auto-saving survey data from Jotai to DB...")
      autoSaveAttempted.current = true
      setIsAutoSaving(true)

      saveSurveyMutation.mutate(
        {
          workspaceId,
          surveyData: {
            industry: jotaiSurveyData.industry || "",
            target: jotaiSurveyData.target || "",
            country: jotaiSurveyData.country || "",
            experience: jotaiSurveyData.experience || "",
            lang: jotaiSurveyData.lang,
          },
          userId,
        },
        {
          onSuccess: () => {
            console.log("[CompanyInformation] 14. ✅ Survey data saved to DB successfully")
            // Clear Jotai after successful save
            setJotaiSurveyData(null)
            // Refetch onboarding progress
            refetchOnboarding()
            setIsAutoSaving(false)
          },
          onError: (error) => {
            console.error("[CompanyInformation] 15. ❌ Failed to auto-save survey data:", error)
            setIsAutoSaving(false)
          },
        },
      )
    } else {
      console.log("[CompanyInformation] 16. No valid survey data in Jotai")
    }
  }, [
    workspaceId,
    workspacesLoading,
    onboardingLoading,
    hasSurveyDataInDb,
    jotaiSurveyData,
    userId,
    isAutoSaving,
    saveSurveyMutation,
    setJotaiSurveyData,
    refetchOnboarding,
  ])

  useEffect(() => {
    // Check if user has seen the welcome popup
    const hasSeenWelcome = localStorage.getItem(WELCOME_POPUP_KEY)
    if (!hasSeenWelcome) {
      setShowWelcome(true)
    }
  }, [])

  const handleWelcomeComplete = () => {
    localStorage.setItem(WELCOME_POPUP_KEY, "true")
    setShowWelcome(false)
  }

  // 리다이렉트 루프 감지 시 에러 화면 표시
  if (redirectLoopDetected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-6">
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-lg">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="mb-2 font-bold text-gray-900 text-xl">
              {currentUser?.lang === "ko" ? "페이지 오류가 발생했습니다" : "Page Error Detected"}
            </h2>
            <p className="mb-6 text-gray-600 text-sm">
              {currentUser?.lang === "ko"
                ? "페이지가 반복적으로 새로고침되고 있습니다. 이 문제가 계속되면 다시 로그인해주세요."
                : "The page is refreshing repeatedly. If this persists, please log in again."}
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setRedirectLoopDetected(false)
                  window.location.reload()
                }}
                variant="outline"
              >
                {currentUser?.lang === "ko" ? "다시 시도" : "Try Again"}
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  localStorage.removeItem("authToken")
                  localStorage.removeItem("user")
                  sessionStorage.clear()
                  window.location.href = "/auth"
                }}
              >
                {currentUser?.lang === "ko" ? "다시 로그인" : "Log In Again"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show loading while checking onboarding status
  if (workspacesLoading || onboardingLoading) {
    return <PageSkeleton />
  }

  // If auto-saving survey data, show loading
  if (isAutoSaving) {
    return <PageSkeleton />
  }

  // If no survey data and Jotai has data, show loading (auto-save in progress)
  if (workspaceId && !hasSurveyDataInDb && isValidSurveyData(jotaiSurveyData)) {
    return <PageSkeleton />
  }

  // Calculate completed steps (all steps before current step)
  const completedSteps = Array.from({ length: currentStep - 1 }, (_, i) => i + 1)

  // Updated: New onboarding flow
  // Step 1: 정보 입력 (+ 백그라운드 작업 시작)
  // Step 2: 유니파일 이메일 연동 (백그라운드 병렬 실행)
  // Step 3: 바이어 찾고 이메일 생성 (조건부 - 백그라운드 미완료 시)
  // Step 4: 캠페인 확인 및 실행
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepCompanyInfo />
      case 2:
        return <StepEmailLink />
      case 3:
        return <StepBuyerLoading />
      case 4:
        return <StepConfirmation />
      default:
        return <StepCompanyInfo />
    }
  }

  return (
    <div className="py-6">
      {/* localStorage Warning - Show if localStorage is disabled */}
      <LocalStorageWarning open={!isLocalStorageEnabled} />

      <WelcomePopup onComplete={handleWelcomeComplete} open={showWelcome} />

      {/* Stepper */}
      <OnboardingStepper completedSteps={completedSteps} currentStep={currentStep} />

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          initial={{ opacity: 0, y: 10 }}
          key={currentStep}
          transition={{ duration: 0.2 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
