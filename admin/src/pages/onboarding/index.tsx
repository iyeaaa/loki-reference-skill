import { AnimatePresence, motion } from "framer-motion"
import { useSetAtom } from "jotai"
import {
  ArrowLeft,
  Building2,
  Check,
  Code2,
  Globe,
  Globe2,
  Heart,
  MoreHorizontal,
  Rocket,
  Shirt,
  Smartphone,
  Sparkles,
  Users,
  UtensilsCrossed,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useIsMobile } from "@/hooks/use-mobile"
import { trackSurveyStep } from "@/lib/analytics"
import { slideMobileVariants, slideVariants } from "@/lib/animations"
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
  const isMobile = useIsMobile()

  // Jotai atom setter (for syncing after localStorage update)
  const setSurveyData = useSetAtom(surveyDataAtom)

  // Slide animation direction tracking (동기적 계산으로 타이밍 문제 해결)
  const prevStepRef = useRef(currentStep)
  const direction = useMemo(() => {
    const prev = prevStepRef.current
    const dir = currentStep > prev ? 1 : currentStep < prev ? -1 : 0
    prevStepRef.current = currentStep
    return dir
  }, [currentStep])

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
  // localStorage 기반으로 검증 (state 타이밍 문제 해결)
  useEffect(() => {
    const stepNum = Number(step)

    if (!step || Number.isNaN(stepNum) || stepNum < 1 || stepNum > TOTAL_STEPS) {
      navigate("/trial/survey/1", { replace: true })
      return
    }

    // ✅ FIX: localStorage에서 직접 읽기 (React state 대신)
    // mergeSurveyData()가 동기적으로 localStorage를 업데이트하므로
    // state보다 항상 최신 데이터를 가지고 있음
    const storedData = getSurveyFromStorage()
    const lastCompleted = getLastCompletedStep(storedData)
    const maxAllowedStep = lastCompleted + 1

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

  const handleSelectIndustry = (industry: Industry) => {
    const updated = mergeSurveyData({ industry, lang: i18n.language })
    setData((prev) => ({ ...prev, industry }))
    setSurveyData(updated)
    // 📊 Analytics: Survey Step 1 완료
    trackSurveyStep(1, 4, { industry })
    navigate("/trial/survey/2")
  }

  const handleSelectTarget = (target: TargetCustomer) => {
    const updated = mergeSurveyData({ target, lang: i18n.language })
    setData((prev) => ({ ...prev, target }))
    setSurveyData(updated)
    // 📊 Analytics: Survey Step 2 완료
    trackSurveyStep(2, 4, { target })
    navigate("/trial/survey/3")
  }

  const handleSelectCountry = (country: TargetCountry) => {
    const updated = mergeSurveyData({ country, lang: i18n.language })
    setData((prev) => ({ ...prev, country }))
    setSurveyData(updated)
    // 📊 Analytics: Survey Step 3 완료
    trackSurveyStep(3, 4, { country })
    navigate("/trial/survey/4")
  }

  const handleSelectExperience = (experience: ExportExperience) => {
    const updated = mergeSurveyData({ experience, lang: i18n.language })
    setData((prev) => ({ ...prev, experience }))
    setSurveyData(updated)
    // 📊 Analytics: Survey Step 4 완료 (마지막)
    trackSurveyStep(4, 4, { experience })
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

      <div className="mx-auto max-w-5xl px-3 py-4 md:px-4 md:py-8">
        {/* Header - 토스 스타일 */}
        <div className="mb-3 text-center md:mb-6">
          {/* 모바일: 간소화된 헤더 */}
          <div className="mb-2 md:mb-4">
            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1 text-white text-xs md:px-4 md:py-1.5 md:text-sm">
              <Sparkles className="mr-1 h-3 w-3 md:mr-1.5 md:h-3.5 md:w-3.5" />
              RINDA AI
            </Badge>
          </div>

          {/* 모바일: h1 제거, dots만 표시 */}
          <div className="flex items-center justify-center gap-2 md:hidden">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i + 1 === currentStep
                    ? "w-8 bg-blue-600"
                    : i + 1 < currentStep
                      ? "w-1.5 bg-blue-400"
                      : "w-1.5 bg-gray-300",
                )}
                key={i}
              />
            ))}
          </div>

          {/* 데스크톱: 기존 유지 */}
          <div className="hidden md:block">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Badge className="border-blue-200 text-blue-600" variant="outline">
                Step {currentStep} / {TOTAL_STEPS}
              </Badge>
              <Badge className="text-xs" variant="secondary">
                {getStepCta()}
              </Badge>
            </div>
            <h1 className="mb-2 font-bold text-2xl text-gray-900 tracking-tight">
              {isKorean ? "간단한 질문 4개만 답해주세요" : "Just 4 quick questions"}
            </h1>
            <p className="text-gray-500">
              {isKorean
                ? "AI가 딱 맞는 해외 바이어를 찾아드릴게요"
                : "AI will find the perfect international buyers for you"}
            </p>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="mb-2 flex items-center justify-between md:mb-4">
          {/* 모바일: 뒤로가기만 표시 (좌상단) */}
          <Button
            className={cn("text-gray-500 hover:text-gray-700", "h-8 w-8 p-0 md:h-10 md:w-10")}
            disabled={currentStep === 1}
            onClick={handleBack}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            <span className="sr-only">{isKorean ? "이전" : "Back"}</span>
          </Button>

          {/* 데스크톱: Progress bar + Step counter */}
          <div className="hidden flex-1 items-center gap-3 md:flex">
            <Progress className="h-2" value={progress} />
            <span className="font-medium text-gray-500 text-sm">
              {currentStep} / {TOTAL_STEPS}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Question Card - Left side */}
          <div className="relative lg:col-span-2">
            <AnimatePresence custom={direction} initial={false} mode="wait">
              <motion.div
                animate="center"
                className="w-full"
                custom={direction}
                exit="exit"
                initial="enter"
                key={currentStep}
                variants={isMobile ? slideMobileVariants : slideVariants}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Value Props Panel - Desktop only */}
          <div className="hidden lg:col-span-1 lg:block">
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

// 산업군별 아이콘 매핑 (lucide로 통일)
const INDUSTRY_ICONS: Record<Industry, React.ReactNode> = {
  manufacturing: <Building2 className="h-6 w-6 text-gray-700" />,
  it_saas: <Code2 className="h-6 w-6 text-gray-700" />,
  beauty: <Sparkles className="h-6 w-6 text-gray-700" />,
  food: <UtensilsCrossed className="h-6 w-6 text-gray-700" />,
  fashion: <Shirt className="h-6 w-6 text-gray-700" />,
  electronics: <Smartphone className="h-6 w-6 text-gray-700" />,
  healthcare: <Heart className="h-6 w-6 text-gray-700" />,
  guitar: <MoreHorizontal className="h-6 w-6 text-gray-700" />,
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
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {INDUSTRIES.map((industry) => (
            <Button
              className={cn(
                "relative h-auto min-h-[56px] justify-start gap-3 rounded-xl border-2 p-4 text-left transition-all md:min-h-[64px] md:p-5",
                // Touch feedback
                "active:scale-[0.98] active:brightness-95",
                // Desktop hover
                "md:hover:scale-[1.01] md:hover:shadow-md",
                // Selection states
                selected === industry
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-blue-100 shadow-md hover:bg-blue-50"
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
              {selected === industry && (
                <motion.div
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-2 right-2"
                  initial={{ scale: 0, opacity: 0 }}
                >
                  <Check className="h-5 w-5 text-blue-600" />
                </motion.div>
              )}
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
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="space-y-4 md:space-y-5">
          {TARGET_CUSTOMERS.map((target) => (
            <Button
              className={cn(
                "relative h-auto min-h-[68px] w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all md:min-h-[80px] md:p-5",
                // Touch feedback
                "active:scale-[0.98] active:brightness-95",
                // Desktop hover
                "md:hover:scale-[1.01] md:hover:shadow-md",
                // Selection states
                selected === target
                  ? "border-blue-500 bg-blue-50 shadow-blue-100 shadow-md hover:bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
              )}
              key={target}
              onClick={() => onSelect(target)}
              variant="outline"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
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
              </div>
              {selected === target && (
                <motion.div
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-2 right-2"
                  initial={{ scale: 0, opacity: 0 }}
                >
                  <Check className="h-5 w-5 text-blue-600" />
                </motion.div>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 국가별 아이콘
const COUNTRY_ICONS: Record<TargetCountry, React.ReactNode> = {
  jp: <Globe className="h-6 w-6 text-gray-700" />,
  us: <Globe className="h-6 w-6 text-gray-700" />,
  sea: <Globe className="h-6 w-6 text-gray-700" />,
  eu: <Globe className="h-6 w-6 text-gray-700" />,
  cn: <Globe className="h-6 w-6 text-gray-700" />,
  ae: <Globe className="h-6 w-6 text-gray-700" />,
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
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {TARGET_COUNTRIES.map((country) => (
            <Button
              className={cn(
                "relative h-auto min-h-[56px] justify-start gap-3 rounded-xl border-2 p-4 text-left transition-all md:min-h-[64px] md:p-5",
                // Touch feedback
                "active:scale-[0.98] active:brightness-95",
                // Desktop hover
                "md:hover:scale-[1.01] md:hover:shadow-md",
                // Selection states
                selected === country
                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-blue-100 shadow-md hover:bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50",
              )}
              key={country}
              onClick={() => onSelect(country)}
              variant="outline"
            >
              <span className="text-gray-600">{COUNTRY_ICONS[country]}</span>
              <span className="font-medium">
                {isKorean ? countryLabels[country].ko : countryLabels[country].en}
              </span>
              {selected === country && (
                <motion.div
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-2 right-2"
                  initial={{ scale: 0, opacity: 0 }}
                >
                  <Check className="h-5 w-5 text-blue-600" />
                </motion.div>
              )}
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
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="space-y-4 md:space-y-5">
          {EXPORT_EXPERIENCES.map((experience) => (
            <Button
              className={cn(
                "relative h-auto min-h-[68px] w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all md:min-h-[80px] md:p-5",
                // Touch feedback
                "active:scale-[0.98] active:brightness-95",
                // Desktop hover
                "md:hover:scale-[1.01] md:hover:shadow-md",
                // Selection states
                selected === experience
                  ? "border-blue-500 bg-blue-50 shadow-blue-100 shadow-md hover:bg-blue-50"
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
                <motion.div
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-2 right-2"
                  initial={{ scale: 0, opacity: 0 }}
                >
                  <Check className="h-5 w-5 text-blue-600" />
                </motion.div>
              )}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
