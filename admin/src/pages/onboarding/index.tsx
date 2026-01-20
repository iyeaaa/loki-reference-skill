import { AnimatePresence, motion } from "framer-motion"
import { useSetAtom } from "jotai"
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Globe,
  Globe2,
  Lightbulb,
  MessageCircle,
  Shirt,
  Smartphone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { ExitIntentModal } from "@/components/ExitIntentModal"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { useExitIntent } from "@/hooks/useExitIntent"
import { trackSurveyStep } from "@/lib/analytics"
import { slideMobileVariants, slideVariants } from "@/lib/animations"
import { apiFetch } from "@/lib/api/client"
import type { OnboardingStep } from "@/lib/exit-intent-messages"
import { cn } from "@/lib/utils"
import {
  getLastCompletedStep,
  getSurveyFromStorage,
  mergeSurveyData,
  surveyDataAtom,
} from "@/store/survey"
import { ValuePropsPanel } from "./components/ValuePropsPanel"
import {
  type ExportExperience,
  INDUSTRIES,
  type Industry,
  type OnboardingData,
  TARGET_COUNTRIES,
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

  // 자동 리다이렉트 처리 (기존 사용자)
  const [isRedirecting, setIsRedirecting] = useState(false)

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
      industry: (stored?.industry as Industry[]) ?? null,
      target: (stored?.target as TargetCustomer) ?? null,
      country: (stored?.country as TargetCountry[]) ?? null,
      experience: (stored?.experience as ExportExperience) ?? null,
    }
  })

  // 기존 로그인 체크 (Step 1에서만, 팝업 없이)
  const autoCheckRef = useRef(false)
  useEffect(() => {
    // Step 1에서만 실행
    if (currentStep !== 1) {
      return
    }
    // 이미 체크했으면 스킵
    if (autoCheckRef.current) {
      return
    }

    autoCheckRef.current = true

    const checkAndRedirect = async () => {
      // localStorage에서 authToken 확인
      const authToken = localStorage.getItem("authToken")

      if (authToken) {
        try {
          // 토큰 유효성 검증
          console.log("[Survey] Token found - verifying...")
          const response = await apiFetch<{ user: { id: string } }>("/api/v1/auth/verify", {
            method: "POST",
          })

          if (response.user?.id) {
            // 유효한 토큰 - 대시보드로 리다이렉트
            console.log("[Survey] Valid token - redirecting to dashboard")
            setIsRedirecting(true)
            setTimeout(() => {
              window.location.href = "/dashboard"
            }, 300)
            return
          }
        } catch (_error) {
          // 토큰 만료 또는 유효하지 않음 - 삭제
          console.log("[Survey] Token invalid or expired - removing")
          localStorage.removeItem("authToken")
          localStorage.removeItem("user")
        }
      }

      // 로그인 안 됨 - 최근 로그인 이메일 확인
      const recentEmail = localStorage.getItem("recent_google_email")

      if (recentEmail) {
        // 최근 로그인 기록 있음 - /trial로 리다이렉트
        console.log("[Survey] Recent email found - redirecting to /trial")
        setIsRedirecting(true)
        setTimeout(() => {
          window.location.href = "/trial"
        }, 300)
      } else {
        // 완전 신규 사용자 - 설문 계속
        console.log("[Survey] New user - continue survey")
      }
    }

    checkAndRedirect()
  }, [currentStep])

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

  // 이탈 감지 훅 - 화면 밖 이탈 감지 포함
  const exitIntent = useExitIntent({
    enabled: true,
    idleTimeout: 30_000,
    mouseLeaveEnabled: true, // 🆕 화면 상단으로 마우스 이탈 시 감지
  })

  // 현재 스텝을 OnboardingStep 타입으로 매핑
  const currentExitStep: OnboardingStep = currentStep === 1 ? "survey1" : "survey2"

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/trial/survey/${currentStep - 1}`)
    }
  }

  const canProceed = () => {
    if (currentStep === 1) {
      return data.industry && data.industry.length > 0
    }
    if (currentStep === 2) {
      return data.country && data.country.length > 0
    }
    return false
  }

  const handleNext = () => {
    if (currentStep === 1 && data.industry && data.industry.length > 0) {
      trackSurveyStep(1, TOTAL_STEPS, { industry: data.industry })
      exitIntent.reset()
      navigate("/trial/survey/2")
    } else if (currentStep === 2 && data.country && data.country.length > 0) {
      trackSurveyStep(2, TOTAL_STEPS, { country: data.country })
      exitIntent.reset()
      navigate("/trial")
    }
  }

  const handleSelectIndustry = (industry: Industry) => {
    setData((prev) => {
      const currentIndustries = prev.industry ?? []
      const isSelected = currentIndustries.includes(industry)
      const newIndustries = isSelected
        ? currentIndustries.filter((i) => i !== industry)
        : [...currentIndustries, industry]

      const updated = mergeSurveyData({ industry: newIndustries, lang: i18n.language })
      setSurveyData(updated)

      return { ...prev, industry: newIndustries }
    })
  }

  const handleSelectCountry = (country: TargetCountry) => {
    setData((prev) => {
      const currentCountries = prev.country ?? []
      const isSelected = currentCountries.includes(country)
      const newCountries = isSelected
        ? currentCountries.filter((c) => c !== country)
        : [...currentCountries, country]

      const updated = mergeSurveyData({ country: newCountries, lang: i18n.language })
      setSurveyData(updated)

      return { ...prev, country: newCountries }
    })
  }

  // Step별 격려 메시지 (2단계 플로우)
  const getStepCta = () => {
    switch (currentStep) {
      case 1:
        return isKorean ? "첫 번째 질문이에요!" : "First question!"
      case 2:
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
        return <Step3 isKorean={isKorean} onSelect={handleSelectCountry} selected={data.country} />
      default:
        return null
    }
  }

  // 자동 리다이렉트 중 로딩 화면
  if (isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
              <p className="text-gray-600 text-sm">
                {isKorean ? "로그인 페이지로 이동 중..." : "Redirecting to login page..."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
              {isKorean ? "간단한 질문 2개만 답해주세요" : "Just 2 quick questions"}
            </h1>
            <p className="text-gray-500">
              {isKorean
                ? "AI가 딱 맞는 해외 바이어를 찾아드릴게요"
                : "AI will find the perfect international buyers for you"}
            </p>
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

            {/* Mobile Navigation Buttons */}
            <div className="mt-6 flex items-center justify-center gap-3 lg:hidden">
              <Button
                className="h-10 min-w-[100px] border-gray-300"
                disabled={currentStep === 1}
                onClick={handleBack}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {isKorean ? "이전" : "Previous"}
              </Button>
              <Button
                className="h-10 min-w-[100px] bg-blue-600 hover:bg-blue-700"
                disabled={!canProceed()}
                onClick={handleNext}
              >
                {currentStep === TOTAL_STEPS
                  ? isKorean
                    ? "제출"
                    : "Submit"
                  : isKorean
                    ? "다음"
                    : "Next"}
              </Button>
            </div>
          </div>

          {/* Value Props Panel - Desktop only */}
          <div className="hidden lg:col-span-1 lg:block">
            <ValuePropsPanel currentStep={currentStep} data={data} isKorean={isKorean} />

            {/* Navigation Buttons */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                className="h-10 min-w-[100px] border-gray-300"
                disabled={currentStep === 1}
                onClick={handleBack}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {isKorean ? "이전" : "Previous"}
              </Button>
              <Button
                className="h-10 min-w-[100px] bg-blue-600 hover:bg-blue-700"
                disabled={!canProceed()}
                onClick={handleNext}
              >
                {currentStep === TOTAL_STEPS
                  ? isKorean
                    ? "제출"
                    : "Submit"
                  : isKorean
                    ? "다음"
                    : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 이탈 방지 모달 */}
      <ExitIntentModal
        isKorean={isKorean}
        onClose={exitIntent.dismiss}
        onStay={exitIntent.dismiss}
        open={exitIntent.isTriggered}
        step={currentExitStep}
      />
    </div>
  )
}

// 산업군별 아이콘 매핑 (소비재만 포함)
const INDUSTRY_ICONS: Record<Industry, React.ReactNode> = {
  beauty: <Sparkles className="h-6 w-6 text-gray-700" />,
  food: <UtensilsCrossed className="h-6 w-6 text-gray-700" />,
  fashion: <Shirt className="h-6 w-6 text-gray-700" />,
  electronics: <Smartphone className="h-6 w-6 text-gray-700" />,
}

// Step 1: Industry Selection
function Step1({
  selected,
  onSelect,
  isKorean,
}: {
  selected: Industry[] | null
  onSelect: (industry: Industry) => void
  isKorean: boolean
}) {
  const [showNonConsumerModal, setShowNonConsumerModal] = useState(false)
  const isMobile = useIsMobile()

  const industryLabels: Record<Industry, { ko: string; en: string }> = {
    beauty: { ko: "뷰티 / 화장품", en: "Beauty / Cosmetics" },
    food: { ko: "식품 / 건기식", en: "Food / Health" },
    fashion: { ko: "패션 / 의류", en: "Fashion / Apparel" },
    electronics: { ko: "전자제품", en: "Electronics" },
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">
            {isKorean ? "어떤 제품을 판매하세요?" : "What do you sell?"}
          </CardTitle>
          <CardDescription>
            {isKorean
              ? "분야에 맞는 바이어를 찾아드릴게요 (복수 선택 가능)"
              : "We'll find buyers that match your industry (multiple selection)"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            {INDUSTRIES.map((industry) => {
              const isSelected = selected?.includes(industry) ?? false
              return (
                <Button
                  className={cn(
                    "relative h-auto min-h-[56px] justify-start gap-3 rounded-xl border-2 p-4 text-left transition-all md:min-h-[64px] md:p-5",
                    // Touch feedback
                    "active:scale-[0.98] active:brightness-95",
                    // Desktop hover
                    "md:hover:scale-[1.01] md:hover:shadow-md",
                    // Selection states
                    isSelected
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
                  {isSelected && (
                    <motion.div
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute top-2 right-2"
                      initial={{ scale: 0, opacity: 0 }}
                    >
                      <Check className="h-5 w-5 text-blue-600" />
                    </motion.div>
                  )}
                </Button>
              )
            })}
          </div>

          {/* 비소비재 안내 배너 */}
          <NonConsumerBanner isKorean={isKorean} onCtaClick={() => setShowNonConsumerModal(true)} />
        </CardContent>
      </Card>

      {/* 비소비재 가치 제안 모달 */}
      <NonConsumerModal
        isKorean={isKorean}
        isMobile={isMobile}
        isOpen={showNonConsumerModal}
        onClose={() => setShowNonConsumerModal(false)}
      />
    </>
  )
}

/**
 * 비소비재 기업 안내 배너
 * 산업군 버튼 아래에 표시되어 딥테크/제조/IT 기업을 상담으로 유도
 */
function NonConsumerBanner({
  isKorean,
  onCtaClick,
}: {
  isKorean: boolean
  onCtaClick: () => void
}) {
  return (
    <div className="mt-6 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:gap-4">
        {/* 아이콘 + 텍스트 */}
        <div className="flex flex-1 items-start gap-3">
          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 sm:flex">
            <Lightbulb className="h-4 w-4 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-gray-900 text-sm md:text-base">
              {isKorean
                ? "딥테크, 제조/부품, IT/소프트웨어 기업이신가요?"
                : "In DeepTech, Manufacturing, or IT/Software?"}
            </h4>
            <p className="mt-1 text-gray-600 text-xs md:text-sm">
              {isKorean
                ? "산업 특성에 맞는 맞춤형 바이어 매칭 서비스를 제공해드려요"
                : "We offer customized buyer matching tailored to your industry"}
            </p>
          </div>
        </div>

        {/* CTA 버튼 */}
        <Button
          className="w-full border-blue-200 bg-white hover:bg-blue-50 md:w-auto"
          onClick={onCtaClick}
          variant="outline"
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {isKorean ? "맞춤 솔루션 알아보기" : "Discover Your Solution"}
        </Button>
      </div>
    </div>
  )
}

/**
 * 비소비재 기업 가치 제안 모달
 * 모바일: Drawer (바텀시트), 데스크톱: Dialog (중앙 모달)
 */
function NonConsumerModal({
  isOpen,
  onClose,
  isKorean,
  isMobile,
}: {
  isOpen: boolean
  onClose: () => void
  isKorean: boolean
  isMobile: boolean
}) {
  const handleConfirm = () => {
    window.open("https://rinda.ai/contact", "_blank")
    onClose()
  }

  const valueProps = [
    { ko: "전문 컨설턴트의 1:1 상담", en: "1:1 consultation with experts" },
    { ko: "24시간 내 연락드려요", en: "We'll contact you within 24h" },
    { ko: "무료 상담, 부담 없이", en: "Free consultation, no obligation" },
  ]

  // 모바일: Drawer (바텀시트)
  if (isMobile) {
    return (
      <Drawer onOpenChange={(o) => !o && onClose()} open={isOpen}>
        <DrawerContent className="max-h-[60vh]">
          <DrawerHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <DrawerTitle className="text-lg">
              {isKorean ? "전문가가 직접 도와드릴게요" : "Our experts will help you directly"}
            </DrawerTitle>
            <DrawerDescription className="mt-2 whitespace-pre-line text-sm">
              {isKorean
                ? "딥테크, 제조/부품, IT 산업은\n바이어 특성이 다양해요.\n전문 컨설턴트가 맞춤 바이어를 찾아드릴게요."
                : "DeepTech, Manufacturing, and IT industries\nhave diverse buyer profiles.\nOur consultants will find the perfect buyers for you."}
            </DrawerDescription>
          </DrawerHeader>

          {/* 가치 제안 체크리스트 */}
          <div className="space-y-3 px-4">
            {valueProps.map((item, i) => (
              <div className="flex items-center gap-3" key={i}>
                <div className="rounded-full bg-green-100 p-1">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-gray-700 text-sm">{isKorean ? item.ko : item.en}</span>
              </div>
            ))}
          </div>

          <DrawerFooter className="pb-6">
            <Button className="h-12 w-full bg-blue-600 hover:bg-blue-700" onClick={handleConfirm}>
              {isKorean ? "전문가와 대화하기" : "Talk to an Expert"}
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
            <Button className="h-12 w-full text-gray-500" onClick={onClose} variant="ghost">
              {isKorean ? "나중에 할게요" : "Maybe later"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  // 데스크톱: Dialog (중앙 모달)
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={isOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Sparkles className="h-6 w-6 text-blue-600" />
          </div>
          <DialogTitle className="text-xl">
            {isKorean ? "전문가가 직접 도와드릴게요" : "Our experts will help you directly"}
          </DialogTitle>
          <DialogDescription className="mt-2 whitespace-pre-line">
            {isKorean
              ? "딥테크, 제조/부품, IT 산업은\n바이어 특성이 다양해요.\n전문 컨설턴트가 맞춤 바이어를 찾아드릴게요."
              : "DeepTech, Manufacturing, and IT industries\nhave diverse buyer profiles.\nOur consultants will find the perfect buyers for you."}
          </DialogDescription>
        </DialogHeader>

        {/* 가치 제안 체크리스트 */}
        <div className="mt-4 space-y-3">
          {valueProps.map((item, i) => (
            <div className="flex items-center gap-3" key={i}>
              <div className="rounded-full bg-green-100 p-1">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-gray-700 text-sm">{isKorean ? item.ko : item.en}</span>
            </div>
          ))}
        </div>

        {/* 액션 버튼 */}
        <DialogFooter className="mt-6 flex-col gap-2 sm:flex-col">
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleConfirm}>
            {isKorean ? "전문가와 대화하기" : "Talk to an Expert"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
          <Button className="w-full text-gray-500" onClick={onClose} variant="ghost">
            {isKorean ? "나중에 할게요" : "Maybe later"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 국가별 아이콘 (중국 제외)
const COUNTRY_ICONS: Record<TargetCountry, React.ReactNode> = {
  jp: <Globe className="h-6 w-6 text-gray-700" />,
  us: <Globe className="h-6 w-6 text-gray-700" />,
  sea: <Globe className="h-6 w-6 text-gray-700" />,
  eu: <Globe className="h-6 w-6 text-gray-700" />,
  ae: <Globe className="h-6 w-6 text-gray-700" />,
}

// Step 3: Target Country
function Step3({
  selected,
  onSelect,
  isKorean,
}: {
  selected: TargetCountry[] | null
  onSelect: (country: TargetCountry) => void
  isKorean: boolean
}) {
  const countryLabels: Record<TargetCountry, { ko: string; en: string }> = {
    jp: { ko: "일본", en: "Japan" },
    us: { ko: "미국", en: "United States" },
    sea: { ko: "동남아시아", en: "Southeast Asia" },
    eu: { ko: "유럽", en: "Europe" },
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
            ? "해당 시장의 바이어를 찾아드릴게요 (복수 선택 가능)"
            : "We'll find buyers in that market for you (multiple selection)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {TARGET_COUNTRIES.map((country) => {
            const isSelected = selected?.includes(country) ?? false
            return (
              <Button
                className={cn(
                  "relative h-auto min-h-[56px] justify-start gap-3 rounded-xl border-2 p-4 text-left transition-all md:min-h-[64px] md:p-5",
                  // Touch feedback
                  "active:scale-[0.98] active:brightness-95",
                  // Desktop hover
                  "md:hover:scale-[1.01] md:hover:shadow-md",
                  // Selection states
                  isSelected
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
                {isSelected && (
                  <motion.div
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-2 right-2"
                    initial={{ scale: 0, opacity: 0 }}
                  >
                    <Check className="h-5 w-5 text-blue-600" />
                  </motion.div>
                )}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
