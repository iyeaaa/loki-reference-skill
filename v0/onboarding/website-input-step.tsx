"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import {
  Sparkles,
  ArrowLeft,
  Check,
  Building2,
  Package,
  MapPin,
  TrendingUp,
  FileText,
  Users,
  Mail,
  BarChart3,
} from "lucide-react"
import type { OnboardingData } from "../onboarding-flow"
import { useLanguage } from "@/lib/language-context"

type Props = {
  onSubmit: (data: OnboardingData) => void
}

type SelectionStep = "industry" | "product" | "market" | "experience"

export function WebsiteInputStep({ onSubmit }: Props) {
  const { t } = useLanguage()

  const [currentStep, setCurrentStep] = useState<SelectionStep>("industry")
  const [selections, setSelections] = useState({
    industry: "",
    productType: "",
    targetMarket: "",
    exportExperience: "",
  })

  const INDUSTRIES = [
    { id: "manufacturing", label: t("제조업", "Manufacturing"), icon: "🏭" },
    { id: "it-saas", label: t("IT / SaaS", "IT / SaaS"), icon: "💻" },
    { id: "beauty", label: t("뷰티 / 화장품", "Beauty"), icon: "💄" },
    { id: "food", label: t("식품 / F&B", "Food & Beverage"), icon: "🍜" },
    { id: "fashion", label: t("패션 / 의류", "Fashion"), icon: "👕" },
    { id: "electronics", label: t("전자제품", "Electronics"), icon: "📱" },
    { id: "medical", label: t("의료 / 헬스케어", "Healthcare"), icon: "🏥" },
    { id: "other", label: t("기타", "Other"), icon: "📦" },
  ]

  const PRODUCT_TYPES = [
    {
      id: "b2b",
      label: t("기업에 판매해요 (B2B)", "B2B (Business)"),
      desc: t("도매, 유통사, 바이어 등", "Wholesale, distributors"),
    },
    {
      id: "b2c",
      label: t("소비자에게 판매해요 (B2C)", "B2C (Consumer)"),
      desc: t("온라인몰, 소매 등", "Online, retail"),
    },
    { id: "both", label: t("둘 다 해요", "Both"), desc: t("기업과 소비자 모두", "B2B & B2C") },
  ]

  const TARGET_MARKETS = [
    { id: "japan", label: t("일본", "Japan"), flag: "🇯🇵" },
    { id: "usa", label: t("미국", "USA"), flag: "🇺🇸" },
    { id: "southeast-asia", label: t("동남아시아", "SE Asia"), flag: "🌏" },
    { id: "europe", label: t("유럽", "Europe"), flag: "🇪🇺" },
    { id: "china", label: t("중국", "China"), flag: "🇨🇳" },
    { id: "middle-east", label: t("중동", "Middle East"), flag: "🇦🇪" },
  ]

  const EXPORT_EXPERIENCES = [
    {
      id: "first-time",
      label: t("아직 해본 적 없어요", "Never exported"),
      desc: t("걱정 마세요, RINDA가 처음부터 도와드려요", "RINDA will guide you"),
    },
    {
      id: "some",
      label: t("몇 번 해봤어요", "Some experience"),
      desc: t("더 많은 바이어를 찾아드릴게요", "Find more buyers"),
    },
    {
      id: "experienced",
      label: t("꾸준히 하고 있어요", "Regularly exporting"),
      desc: t("영업을 자동화해드릴게요", "Automate your sales"),
    },
  ]

  const steps: SelectionStep[] = ["industry", "product", "market", "experience"]

  const STEP_INFO = {
    industry: {
      icon: Building2,
      title: t("어떤 제품을 판매하세요?", "What do you sell?"),
      subtitle: t("산업에 맞는 바이어를 찾아드려요", "We'll find buyers in your industry"),
    },
    product: {
      icon: Package,
      title: t("누구에게 판매하세요?", "Who are your customers?"),
      subtitle: t("판매 대상에 맞는 영업 전략을 세워드려요", "We'll create the right sales approach"),
    },
    market: {
      icon: MapPin,
      title: t("어느 나라로 진출하고 싶으세요?", "Which country interests you?"),
      subtitle: t("해당 시장의 잠재 바이어를 찾아드려요", "We'll find potential buyers there"),
    },
    experience: {
      icon: TrendingUp,
      title: t("수출 경험이 어느 정도 되세요?", "How much export experience?"),
      subtitle: t("경험에 맞춰 맞춤형으로 도와드려요", "We'll customize help for you"),
    },
  }

  const REWARDS = [
    {
      icon: Users,
      label: t("잠재 바이어 리스트", "Buyer List"),
      desc: t("연락 가능한 해외 바이어", "Contactable overseas buyers"),
    },
    {
      icon: FileText,
      label: t("맞춤 진출 전략", "Entry Strategy"),
      desc: t("시장별 영업 가이드", "Market-specific guide"),
    },
    {
      icon: Mail,
      label: t("영업 이메일 자동발송", "Auto Outreach"),
      desc: t("AI가 대신 연락해요", "AI contacts for you"),
    },
    { icon: BarChart3, label: t("실시간 성과 분석", "Performance"), desc: t("응답률, 관심도 추적", "Track responses") },
  ]

  const handleSelect = (field: string, value: string) => {
    setSelections((prev) => ({ ...prev, [field]: value }))

    setTimeout(() => {
      const currentIndex = steps.indexOf(currentStep)
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1])
      } else {
        const industryLabel = INDUSTRIES.find((i) => i.id === selections.industry)?.label || ""
        const marketLabel =
          TARGET_MARKETS.find((m) => m.id === (field === "targetMarket" ? value : selections.targetMarket))?.label || ""
        const productLabel = PRODUCT_TYPES.find((p) => p.id === selections.productType)?.label || ""

        onSubmit({
          companyName: t("분석 중...", "Analyzing..."),
          description: `${industryLabel} / ${productLabel} / ${t("타겟", "Target")}: ${marketLabel}`,
          industry: industryLabel,
        })
      }
    }, 300)
  }

  const handleBack = () => {
    const currentIndex = steps.indexOf(currentStep)
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1])
    }
  }

  const getProgress = () => {
    const currentIndex = steps.indexOf(currentStep)
    return ((currentIndex + 1) / steps.length) * 100
  }

  const currentStepIndex = steps.indexOf(currentStep)
  const StepIcon = STEP_INFO[currentStep].icon

  return (
    <div className="min-h-screen relative flex items-center justify-center p-3 sm:p-4 overflow-hidden bg-gradient-to-b from-secondary to-background">
      <div className="relative z-10 w-full max-w-2xl">
        <div className="text-center mb-4 sm:mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary rounded-full mb-2 sm:mb-3">
            <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary-foreground" />
            <span className="text-xs font-bold text-primary-foreground">RINDA AI</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-foreground">
            {t("간단한 질문 4개에 답하시면", "Answer 4 quick questions")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t("AI가 맞춤형 해외 영업 전략을 만들어드려요", "AI will create your custom export strategy")}
          </p>
        </div>

        <div className="mb-4 sm:mb-5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            {currentStepIndex > 0 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t("이전", "Back")}</span>
              </button>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground font-medium">
              {currentStepIndex + 1} / {steps.length}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card className="lg:col-span-3 p-4 sm:p-5 border border-border bg-card shadow-sm rounded-xl">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <StepIcon className="w-4 sm:w-5 h-4 sm:h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-card-foreground">{STEP_INFO[currentStep].title}</h2>
                <p className="text-xs text-muted-foreground">{STEP_INFO[currentStep].subtitle}</p>
              </div>
            </div>

            {currentStep === "industry" && (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {INDUSTRIES.map((industry) => (
                  <button
                    key={industry.id}
                    onClick={() => handleSelect("industry", industry.id)}
                    className={`p-2 sm:p-2.5 rounded-lg text-left transition-all border flex items-center gap-1.5 sm:gap-2 ${
                      selections.industry === industry.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <span className="text-sm sm:text-base">{industry.icon}</span>
                    <span className="font-medium text-foreground text-xs sm:text-sm">{industry.label}</span>
                    {selections.industry === industry.id && (
                      <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {currentStep === "product" && (
              <div className="space-y-1.5 sm:space-y-2">
                {PRODUCT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleSelect("productType", type.id)}
                    className={`w-full p-2.5 sm:p-3 rounded-lg text-left transition-all border ${
                      selections.productType === type.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-xs sm:text-sm">{type.label}</h3>
                        <p className="text-muted-foreground text-xs">{type.desc}</p>
                      </div>
                      {selections.productType === type.id && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {currentStep === "market" && (
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {TARGET_MARKETS.map((market) => (
                  <button
                    key={market.id}
                    onClick={() => handleSelect("targetMarket", market.id)}
                    className={`p-2 sm:p-2.5 rounded-lg text-left transition-all border flex items-center gap-1.5 sm:gap-2 ${
                      selections.targetMarket === market.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <span className="text-base sm:text-lg">{market.flag}</span>
                    <span className="font-medium text-foreground text-xs sm:text-sm">{market.label}</span>
                    {selections.targetMarket === market.id && (
                      <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {currentStep === "experience" && (
              <div className="space-y-1.5 sm:space-y-2">
                {EXPORT_EXPERIENCES.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => handleSelect("exportExperience", exp.id)}
                    className={`w-full p-2.5 sm:p-3 rounded-lg text-left transition-all border ${
                      selections.exportExperience === exp.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground text-xs sm:text-sm">{exp.label}</h3>
                        <p className="text-muted-foreground text-xs">{exp.desc}</p>
                      </div>
                      {selections.exportExperience === exp.id && <Check className="w-4 h-4 text-primary" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="lg:col-span-2 space-y-2 sm:space-y-3">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-3 sm:p-4 text-primary-foreground">
              <h3 className="text-xs sm:text-sm font-bold mb-1">{t("완료하면 바로 받아요", "You'll get instantly")}</h3>
              <p className="text-[10px] sm:text-xs text-primary-foreground/80 mb-2 sm:mb-3">
                {t("약 30초 후 AI가 준비해드려요", "AI prepares in ~30 seconds")}
              </p>
              <div className="space-y-1.5 sm:space-y-2">
                {REWARDS.map((reward, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all ${idx <= currentStepIndex ? "bg-primary-foreground/20" : "bg-primary-foreground/10 opacity-60"}`}
                  >
                    <div
                      className={`w-6 sm:w-7 h-6 sm:h-7 rounded-md flex items-center justify-center ${idx <= currentStepIndex ? "bg-primary-foreground" : "bg-primary-foreground/30"}`}
                    >
                      <reward.icon
                        className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${idx <= currentStepIndex ? "text-primary" : "text-primary-foreground"}`}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs font-semibold">{reward.label}</p>
                      <p className="text-[9px] sm:text-[10px] text-primary-foreground/80 hidden sm:block">
                        {reward.desc}
                      </p>
                    </div>
                    {idx < currentStepIndex && <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-green-300 ml-auto" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-muted rounded-xl p-2.5 sm:p-3 border border-border">
              <p className="text-xs sm:text-sm font-medium text-foreground text-center">
                {currentStepIndex === 0 && t("첫 번째 질문이에요!", "First question!")}
                {currentStepIndex === 1 && t("좋아요! 3개 남았어요", "Great! 3 left")}
                {currentStepIndex === 2 && t("잘하고 계세요! 2개 남았어요", "Nice! 2 more")}
                {currentStepIndex === 3 &&
                  t("마지막이에요! 선택하시면 바로 분석 시작", "Last one! AI starts right away")}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-x-2 sm:gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Check className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-green-600" />
                {t("무료 체험", "Free trial")}
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-green-600" />
                {t("카드 불필요", "No card")}
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-2.5 sm:w-3 h-2.5 sm:h-3 text-green-600" />
                {t("200+ 기업", "200+ companies")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
