import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Progress } from "@/components/ui/progress"
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<OnboardingData>({
    industry: null,
    target: null,
    country: null,
    experience: null,
  })

  const progress = (currentStep / TOTAL_STEPS) * 100

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSelectIndustry = (industry: Industry) => {
    setData({ ...data, industry })
    setCurrentStep(2)
  }

  const handleSelectTarget = (target: TargetCustomer) => {
    setData({ ...data, target })
    setCurrentStep(3)
  }

  const handleSelectCountry = (country: TargetCountry) => {
    setData({ ...data, country })
    setCurrentStep(4)
  }

  const handleSelectExperience = (experience: ExportExperience) => {
    setData({ ...data, experience })
    // Navigate to /trial with query params
    const params = new URLSearchParams({
      industry: data.industry || "",
      target: data.target || "",
      country: data.country || "",
      experience: experience,
    })
    navigate(`/trial?${params.toString()}`)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1 selected={data.industry} onSelect={handleSelectIndustry} />
      case 2:
        return <Step2 selected={data.target} onSelect={handleSelectTarget} />
      case 3:
        return <Step3 selected={data.country} onSelect={handleSelectCountry} />
      case 4:
        return <Step4 selected={data.experience} onSelect={handleSelectExperience} />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Language Switcher - Fixed top right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher className="bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200/50 rounded-lg" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full mb-4">
            {t("onboarding.header.badge")}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("onboarding.header.title")}</h1>
          <p className="text-gray-600">{t("onboarding.header.subtitle")}</p>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("onboarding.nav.back")}
          </button>

          <div className="flex items-center gap-3 flex-1 max-w-xs mx-4">
            <Progress value={progress} className="h-2" />
          </div>

          <span className="text-sm text-gray-500">
            {currentStep} / {TOTAL_STEPS}
          </span>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Question Card - Left side */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Value Props Panel - Right side */}
          <div className="hidden lg:flex lg:flex-col lg:justify-between h-full">
            <ValuePropsPanel currentStep={currentStep} />

            <div className="flex flex-col gap-3 mt-auto">
              {/* CTA */}
              <p className="text-center text-sm text-blue-600 font-medium">
                {t(`onboarding.step${currentStep}.cta`)}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("onboarding.step1.question")}</h2>
      <p className="text-gray-500 mb-6">{t("onboarding.step1.subtitle")}</p>

      <div className="grid grid-cols-2 gap-3">
        {INDUSTRIES.map((industry) => (
          <button
            type="button"
            key={industry}
            onClick={() => onSelect(industry)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === industry ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
          >
            <span className="text-sm font-medium text-gray-900">
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("onboarding.step2.question")}</h2>
      <p className="text-gray-500 mb-6">{t("onboarding.step2.subtitle")}</p>

      <div className="space-y-3">
        {TARGET_CUSTOMERS.map((target) => (
          <button
            type="button"
            key={target}
            onClick={() => onSelect(target)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === target ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
          >
            <span className="font-medium text-gray-900">{t(`onboarding.step2.${target}`)}</span>
            <p className="text-sm text-gray-500 mt-1">{t(`onboarding.step2.${target}Desc`)}</p>
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("onboarding.step3.question")}</h2>
      <p className="text-gray-500 mb-6">{t("onboarding.step3.subtitle")}</p>

      <div className="grid grid-cols-2 gap-3">
        {TARGET_COUNTRIES.map((country) => (
          <button
            type="button"
            key={country}
            onClick={() => onSelect(country)}
            className={`p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === country ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
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
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("onboarding.step4.question")}</h2>
      <p className="text-gray-500 mb-6">{t("onboarding.step4.subtitle")}</p>

      <div className="space-y-3">
        {EXPORT_EXPERIENCES.map((experience) => (
          <button
            type="button"
            key={experience}
            onClick={() => onSelect(experience)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 hover:bg-blue-50 ${
              selected === experience ? "border-blue-500 bg-blue-50" : "border-gray-200"
            }`}
          >
            <span className="font-medium text-gray-900">{t(`onboarding.step4.${experience}`)}</span>
            <p className="text-sm text-gray-500 mt-1">{t(`onboarding.step4.${experience}Desc`)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
