import { AnimatePresence, motion } from "framer-motion"
import { useSetAtom } from "jotai"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Progress } from "@/components/ui/progress"
import {
  getLastCompletedStep,
  getSurveyFromStorage,
  mergeSurveyData,
  surveyDataAtom,
} from "@/store/survey"
import { ValuePropsPanel } from "./components/ValuePropsPanel"
import {
  EXPORT_EXPERIENCES,
  type ExportExperience,
  INDUSTRIES,
  type Industry,
  type OnboardingData,
  TARGET_COUNTRIES,
  TARGET_CUSTOMERS,
  type TargetCountry,
  type TargetCustomer,
  TOTAL_STEPS,
} from "./types"

export default function OnboardingPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { step } = useParams<{ step: string }>()
  const currentStep = Math.min(Math.max(Number(step) || 1, 1), TOTAL_STEPS)

  // Jotai atom setter (for syncing after localStorage update)
  const setSurveyData = useSetAtom(surveyDataAtom)

  // Local state for UI - initialized from localStorage
  const [data, setData] = useState<OnboardingData>(() => {
    // Hydration-safe: 초기 렌더링 시 localStorage에서 복원
    const stored = getSurveyFromStorage()
    return {
      industry: (stored?.industry as Industry) ?? null,
      target: (stored?.target as TargetCustomer) ?? null,
      country: (stored?.country as TargetCountry) ?? null,
      experience: (stored?.experience as ExportExperience) ?? null,
    }
  })

  // Redirect logic: invalid step or trying to skip ahead
  useEffect(() => {
    const stepNum = Number(step)

    // Invalid step format
    if (!step || Number.isNaN(stepNum) || stepNum < 1 || stepNum > TOTAL_STEPS) {
      navigate("/trial/survey/1", { replace: true })
      return
    }

    // Check if user is trying to skip steps
    const lastCompleted = getLastCompletedStep(getSurveyFromStorage())
    const maxAllowedStep = lastCompleted + 1

    // Allow going to any completed step or the next one
    if (stepNum > maxAllowedStep) {
      navigate(`/trial/survey/${maxAllowedStep}`, { replace: true })
    }
  }, [step, navigate])

  const progress = (currentStep / TOTAL_STEPS) * 100

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/trial/survey/${currentStep - 1}`)
    }
  }

  /**
   * 스텝 선택 핸들러 - 부분 업데이트로 기존 데이터 보존
   */
  const handleSelectIndustry = (industry: Industry) => {
    // 1. localStorage에 부분 업데이트 (기존 데이터 보존)
    const updated = mergeSurveyData({ industry, lang: i18n.language })

    // 2. 로컬 state 업데이트
    setData((prev) => ({ ...prev, industry }))

    // 3. Jotai atom 동기화
    setSurveyData(updated)

    navigate("/trial/survey/2")
  }

  const handleSelectTarget = (target: TargetCustomer) => {
    const updated = mergeSurveyData({ target, lang: i18n.language })
    setData((prev) => ({ ...prev, target }))
    setSurveyData(updated)
    navigate("/trial/survey/3")
  }

  const handleSelectCountry = (country: TargetCountry) => {
    const updated = mergeSurveyData({ country, lang: i18n.language })
    setData((prev) => ({ ...prev, country }))
    setSurveyData(updated)
    navigate("/trial/survey/4")
  }

  const handleSelectExperience = (experience: ExportExperience) => {
    const updated = mergeSurveyData({ experience, lang: i18n.language })
    setData((prev) => ({ ...prev, experience }))
    setSurveyData(updated)
    navigate("/trial")
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 onSelect={handleSelectIndustry} selected={data.industry} />
      case 2:
        return <Step2 onSelect={handleSelectTarget} selected={data.target} />
      case 3:
        return <Step3 onSelect={handleSelectCountry} selected={data.country} />
      case 4:
        return <Step4 onSelect={handleSelectExperience} selected={data.experience} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Language Switcher - Fixed top right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher className="rounded-lg border border-gray-200/50 bg-white/80 shadow-sm backdrop-blur-sm" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="mb-4 inline-block rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700 text-sm">
            {t("onboarding.header.badge")}
          </span>
          <h1 className="mb-2 font-bold text-2xl text-gray-900">{t("onboarding.header.title")}</h1>
          <p className="text-gray-600">{t("onboarding.header.subtitle")}</p>
        </div>

        {/* Navigation Bar */}
        <div className="mb-6 flex items-center justify-between">
          <button
            className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
            disabled={currentStep === 1}
            onClick={handleBack}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("onboarding.nav.back")}
          </button>

          <div className="mx-4 flex max-w-xs flex-1 items-center gap-3">
            <Progress className="h-2" value={progress} />
          </div>

          <span className="text-gray-500 text-sm">
            {currentStep} / {TOTAL_STEPS}
          </span>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
          {/* Question Card - Left side */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                initial={{ opacity: 0, x: -20 }}
                key={currentStep}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Value Props Panel - Right side */}
          <div className="hidden h-full lg:flex lg:flex-col lg:justify-between">
            <ValuePropsPanel currentStep={currentStep} data={data} />

            <div className="mt-auto flex flex-col gap-3">
              {/* CTA */}
              <p className="text-center font-medium text-blue-600 text-sm">
                {t(`onboarding.step${currentStep}.cta`)}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-center gap-4 text-gray-500 text-xs">
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  {t("onboarding.footer.freeTrial")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  {t("onboarding.footer.noCard")}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  {t("onboarding.footer.companies")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 1: Industry Selection
function Step1({
  selected,
  onSelect,
}: {
  selected: Industry | null
  onSelect: (industry: Industry) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-2 font-semibold text-gray-900 text-xl">{t("onboarding.step1.question")}</h2>
      <p className="mb-6 text-gray-500">{t("onboarding.step1.subtitle")}</p>

      <div className="grid grid-cols-2 gap-3">
        {INDUSTRIES.map((industry) => (
          <button
            className={`rounded-xl border-2 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === industry ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
            key={industry}
            onClick={() => onSelect(industry)}
            type="button"
          >
            <span className="font-medium text-gray-900 text-sm">
              {t(`onboarding.step1.${industry}`)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Step 2: Target Customer
function Step2({
  selected,
  onSelect,
}: {
  selected: TargetCustomer | null
  onSelect: (target: TargetCustomer) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-2 font-semibold text-gray-900 text-xl">{t("onboarding.step2.question")}</h2>
      <p className="mb-6 text-gray-500">{t("onboarding.step2.subtitle")}</p>

      <div className="space-y-3">
        {TARGET_CUSTOMERS.map((target) => (
          <button
            className={`w-full rounded-xl border-2 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === target ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
            key={target}
            onClick={() => onSelect(target)}
            type="button"
          >
            <span className="font-medium text-gray-900">{t(`onboarding.step2.${target}`)}</span>
            <p className="mt-1 text-gray-500 text-sm">{t(`onboarding.step2.${target}Desc`)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

// Step 3: Target Country
function Step3({
  selected,
  onSelect,
}: {
  selected: TargetCountry | null
  onSelect: (country: TargetCountry) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-2 font-semibold text-gray-900 text-xl">{t("onboarding.step3.question")}</h2>
      <p className="mb-6 text-gray-500">{t("onboarding.step3.subtitle")}</p>

      <div className="grid grid-cols-2 gap-3">
        {TARGET_COUNTRIES.map((country) => (
          <button
            className={`rounded-xl border-2 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === country ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
            key={country}
            onClick={() => onSelect(country)}
            type="button"
          >
            <span className="font-medium text-gray-900">{t(`onboarding.step3.${country}`)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Step 4: Export Experience
function Step4({
  selected,
  onSelect,
}: {
  selected: ExportExperience | null
  onSelect: (experience: ExportExperience) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-2 font-semibold text-gray-900 text-xl">{t("onboarding.step4.question")}</h2>
      <p className="mb-6 text-gray-500">{t("onboarding.step4.subtitle")}</p>

      <div className="space-y-3">
        {EXPORT_EXPERIENCES.map((experience) => (
          <button
            className={`w-full rounded-xl border-2 p-4 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === experience ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
            key={experience}
            onClick={() => onSelect(experience)}
            type="button"
          >
            <span className="font-medium text-gray-900">{t(`onboarding.step4.${experience}`)}</span>
            <p className="mt-1 text-gray-500 text-sm">{t(`onboarding.step4.${experience}Desc`)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
