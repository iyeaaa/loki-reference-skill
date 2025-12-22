import { AnimatePresence, motion } from "framer-motion"
import { useSetAtom } from "jotai"
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Globe2,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
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
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const { step } = useParams<{ step: string }>()
  const currentStep = Math.min(Math.max(Number(step) || 1, 1), TOTAL_STEPS)
  const isKorean = i18n.language === "ko"

  // Jotai atom setter (for syncing after localStorage update)
  const setSurveyData = useSetAtom(surveyDataAtom)

  // Local state for UI - initialized from localStorage
  const [data, setData] = useState<OnboardingData>(() => {
    const stored = getSurveyFromStorage()
    return {
      industry: (stored?.industry as Industry) ?? null,
      target: (stored?.target as TargetCustomer) ?? null,
      country: (stored?.country as TargetCountry) ?? null,
      experience: (stored?.experience as ExportExperience) ?? null,
    }
  })

  // Redirect logic: invalid step or trying to skip ahead
  // data 상태 기반으로 검증 (localStorage 재호출 제거 - 동기화 문제 해결)
  useEffect(() => {
    const stepNum = Number(step)

    if (!step || Number.isNaN(stepNum) || stepNum < 1 || stepNum > TOTAL_STEPS) {
      navigate("/trial/survey/1", { replace: true })
      return
    }

    const lastCompleted = getLastCompletedStep(data)
    const maxAllowedStep = lastCompleted + 1

    if (stepNum > maxAllowedStep) {
      navigate(`/trial/survey/${maxAllowedStep}`, { replace: true })
    }
  }, [step, navigate, data])

  const progress = (currentStep / TOTAL_STEPS) * 100

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/trial/survey/${currentStep - 1}`)
    }
  }

  const handleSelectIndustry = (industry: Industry) => {
    const updated = mergeSurveyData({ industry, lang: i18n.language })
    setData((prev) => ({ ...prev, industry }))
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

  // Step별 격려 메시지
  const getStepCta = () => {
    switch (currentStep) {
      case 1:
        return isKorean ? "첫 번째 질문이에요!" : "First question!"
      case 2:
        return isKorean ? "좋아요! 3개 남았어요" : "Great! 3 left"
      case 3:
        return isKorean ? "거의 다 왔어요! 2개 남았어요" : "Almost there! 2 left"
      case 4:
        return isKorean ? "마지막이에요! 곧 AI가 시작해요" : "Last one! AI starts soon"
      default:
        return ""
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1 isKorean={isKorean} onSelect={handleSelectIndustry} selected={data.industry} />
        )
      case 2:
        return <Step2 isKorean={isKorean} onSelect={handleSelectTarget} selected={data.target} />
      case 3:
        return <Step3 isKorean={isKorean} onSelect={handleSelectCountry} selected={data.country} />
      case 4:
        return (
          <Step4 isKorean={isKorean} onSelect={handleSelectExperience} selected={data.experience} />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher className="rounded-lg border border-gray-200/50 bg-white/80 shadow-sm backdrop-blur-sm" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header - 토스 스타일 */}
        <div className="mb-8 text-center">
          <Badge className="mb-4 bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-1.5 text-white">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            RINDA AI
          </Badge>
          <h1 className="mb-2 font-bold text-2xl text-gray-900 tracking-tight">
            {isKorean ? "간단한 질문 4개만 답해주세요" : "Just 4 quick questions"}
          </h1>
          <p className="text-gray-500">
            {isKorean
              ? "AI가 딱 맞는 해외 바이어를 찾아드릴게요"
              : "AI will find the perfect international buyers for you"}
          </p>
        </div>

        {/* Navigation Bar */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            className="text-gray-500 hover:text-gray-700"
            disabled={currentStep === 1}
            onClick={handleBack}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {isKorean ? "이전" : "Back"}
          </Button>

          <div className="mx-4 flex max-w-xs flex-1 items-center gap-3">
            <Progress className="h-2" value={progress} />
          </div>

          <span className="font-medium text-gray-500 text-sm">
            {currentStep} / {TOTAL_STEPS}
          </span>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
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
          <div className="hidden lg:block">
            <ValuePropsPanel currentStep={currentStep} data={data} isKorean={isKorean} />

            {/* CTA & Footer */}
            <div className="mt-6 space-y-4">
              <p className="text-center font-medium text-blue-600 text-sm">{getStepCta()}</p>

              <div className="flex items-center justify-center gap-4 text-gray-400 text-xs">
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  {isKorean ? "무료 체험" : "Free trial"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  {isKorean ? "카드 불필요" : "No card"}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-green-500">✓</span>
                  {isKorean ? "200+ 기업" : "200+ companies"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 산업군별 아이콘 매핑
const INDUSTRY_ICONS: Record<Industry, React.ReactNode> = {
  manufacturing: <Building2 className="h-5 w-5" />,
  it_saas: <Briefcase className="h-5 w-5" />,
  beauty: <Sparkles className="h-5 w-5" />,
  food: <span className="text-lg">🍽️</span>,
  fashion: <span className="text-lg">👗</span>,
  electronics: <span className="text-lg">📱</span>,
  healthcare: <span className="text-lg">💊</span>,
  guitar: <span className="text-lg">🎸</span>,
}

// Step 1: Industry Selection
function Step1({
  selected,
  onSelect,
  isKorean,
}: {
  selected: Industry | null
  onSelect: (industry: Industry) => void
  isKorean: boolean
}) {
  const industryLabels: Record<Industry, { ko: string; en: string }> = {
    manufacturing: { ko: "제조 / 부품", en: "Manufacturing" },
    it_saas: { ko: "IT / 소프트웨어", en: "IT / Software" },
    beauty: { ko: "뷰티 / 화장품", en: "Beauty / Cosmetics" },
    food: { ko: "식품 / 건기식", en: "Food / Health" },
    fashion: { ko: "패션 / 의류", en: "Fashion / Apparel" },
    electronics: { ko: "전자제품", en: "Electronics" },
    healthcare: { ko: "헬스케어", en: "Healthcare" },
    guitar: { ko: "기타", en: "Other" },
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">
          {isKorean ? "어떤 제품을 판매하세요?" : "What do you sell?"}
        </CardTitle>
        <CardDescription>
          {isKorean
            ? "분야에 맞는 바이어를 찾아드릴게요"
            : "We'll find buyers that match your industry"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {INDUSTRIES.map((industry) => (
            <Button
              className={cn(
                "h-auto justify-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                selected === industry
                  ? "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
              )}
              key={industry}
              onClick={() => onSelect(industry)}
              variant="outline"
            >
              <span className="text-gray-600">{INDUSTRY_ICONS[industry]}</span>
              <span className="font-medium">
                {isKorean ? industryLabels[industry].ko : industryLabels[industry].en}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Step 2: Target Customer
function Step2({
  selected,
  onSelect,
  isKorean,
}: {
  selected: TargetCustomer | null
  onSelect: (target: TargetCustomer) => void
  isKorean: boolean
}) {
  const targetLabels: Record<
    TargetCustomer,
    { ko: string; en: string; descKo: string; descEn: string }
  > = {
    b2b: {
      ko: "기업에 판매해요 (B2B)",
      en: "Sell to businesses (B2B)",
      descKo: "도매, 유통사, 바이어 등",
      descEn: "Wholesale, distributors, buyers",
    },
    b2c: {
      ko: "소비자에게 판매해요 (B2C)",
      en: "Sell to consumers (B2C)",
      descKo: "온라인몰, 소매 등",
      descEn: "Online stores, retail",
    },
    both: {
      ko: "둘 다 해요",
      en: "Both",
      descKo: "기업과 소비자 모두",
      descEn: "Businesses and consumers",
    },
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">
          {isKorean ? "누구에게 판매하세요?" : "Who do you sell to?"}
        </CardTitle>
        <CardDescription>
          {isKorean
            ? "판매 대상에 맞는 전략을 세워드릴게요"
            : "We'll create a strategy for your target audience"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {TARGET_CUSTOMERS.map((target) => (
            <Button
              className={cn(
                "h-auto w-full flex-col items-start gap-1 rounded-xl border-2 p-4 text-left transition-all",
                selected === target
                  ? "border-blue-500 bg-blue-50 hover:bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
              )}
              key={target}
              onClick={() => onSelect(target)}
              variant="outline"
            >
              <span
                className={cn(
                  "font-medium",
                  selected === target ? "text-blue-700" : "text-gray-900",
                )}
              >
                {isKorean ? targetLabels[target].ko : targetLabels[target].en}
              </span>
              <span className="text-gray-500 text-sm">
                {isKorean ? targetLabels[target].descKo : targetLabels[target].descEn}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 국가별 플래그 이모지
const COUNTRY_FLAGS: Record<TargetCountry, string> = {
  jp: "🇯🇵",
  us: "🇺🇸",
  sea: "🌏",
  eu: "🇪🇺",
  cn: "🇨🇳",
  ae: "🇦🇪",
}

// Step 3: Target Country
function Step3({
  selected,
  onSelect,
  isKorean,
}: {
  selected: TargetCountry | null
  onSelect: (country: TargetCountry) => void
  isKorean: boolean
}) {
  const countryLabels: Record<TargetCountry, { ko: string; en: string }> = {
    jp: { ko: "일본", en: "Japan" },
    us: { ko: "미국", en: "United States" },
    sea: { ko: "동남아시아", en: "Southeast Asia" },
    eu: { ko: "유럽", en: "Europe" },
    cn: { ko: "중국", en: "China" },
    ae: { ko: "중동", en: "Middle East" },
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Globe2 className="h-5 w-5 text-blue-500" />
          {isKorean ? "어디로 진출하고 싶으세요?" : "Where do you want to expand?"}
        </CardTitle>
        <CardDescription>
          {isKorean
            ? "해당 시장의 바이어를 찾아드릴게요"
            : "We'll find buyers in that market for you"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {TARGET_COUNTRIES.map((country) => (
            <Button
              className={cn(
                "h-auto justify-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                selected === country
                  ? "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
              )}
              key={country}
              onClick={() => onSelect(country)}
              variant="outline"
            >
              <span className="text-xl">{COUNTRY_FLAGS[country]}</span>
              <span className="font-medium">
                {isKorean ? countryLabels[country].ko : countryLabels[country].en}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Step 4: Export Experience
function Step4({
  selected,
  onSelect,
  isKorean,
}: {
  selected: ExportExperience | null
  onSelect: (experience: ExportExperience) => void
  isKorean: boolean
}) {
  const experienceLabels: Record<
    ExportExperience,
    { ko: string; en: string; descKo: string; descEn: string; icon: React.ReactNode }
  > = {
    none: {
      ko: "처음이에요",
      en: "First time",
      descKo: "걱정 마세요, AI가 처음부터 도와드려요",
      descEn: "Don't worry, AI will help you from the start",
      icon: <Rocket className="h-5 w-5 text-blue-500" />,
    },
    some: {
      ko: "몇 번 해봤어요",
      en: "Some experience",
      descKo: "더 많은 바이어를 찾아드릴게요",
      descEn: "We'll help you find more buyers",
      icon: <Users className="h-5 w-5 text-green-500" />,
    },
    experienced: {
      ko: "꾸준히 하고 있어요",
      en: "Experienced",
      descKo: "영업을 더 효율적으로 만들어드릴게요",
      descEn: "We'll make your sales more efficient",
      icon: <Sparkles className="h-5 w-5 text-purple-500" />,
    },
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">
          {isKorean ? "해외 수출 경험이 있으세요?" : "Any export experience?"}
        </CardTitle>
        <CardDescription>
          {isKorean
            ? "경험에 맞춰 최적의 도움을 드릴게요"
            : "We'll customize our help based on your experience"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {EXPORT_EXPERIENCES.map((experience) => (
            <Button
              className={cn(
                "h-auto w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all",
                selected === experience
                  ? "border-blue-500 bg-blue-50 hover:bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
              )}
              key={experience}
              onClick={() => onSelect(experience)}
              variant="outline"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100">
                {experienceLabels[experience].icon}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "font-medium",
                    selected === experience ? "text-blue-700" : "text-gray-900",
                  )}
                >
                  {isKorean ? experienceLabels[experience].ko : experienceLabels[experience].en}
                </span>
                <span className="text-gray-500 text-sm">
                  {isKorean
                    ? experienceLabels[experience].descKo
                    : experienceLabels[experience].descEn}
                </span>
              </div>
              {selected === experience && (
                <ArrowRight className="ml-auto h-5 w-5 flex-shrink-0 text-blue-500" />
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
