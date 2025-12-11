import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Globe,
  Loader2,
  Rocket,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface MarketRecommendation {
  rank: number
  countryCode: string
  countryName: string
  countryNameEn: string
  flag: string
  isBestMatch: boolean
  score: number
  marketSize: { kr: string; en: string }
  companyCount: { kr: string; en: string }
  entryTime: { kr: string; en: string }
  highlights: { kr: string; en: string }[]
  reasonTitle: { kr: string; en: string }
  marketTrend: { kr: string; en: string }
  salesStrategy: { kr: string; en: string }
  emailStrategy: {
    subjectLine: string
    keyFocus: { kr: string; en: string }
  }
  metrics: {
    openRate: number
    responseRate: number
  }
}

interface TrialResultData {
  userContext: {
    industryLabel: string
    experienceLabel: string
  }
  lindaSolution: {
    directionTitle: { kr: string; en: string }
    actionSteps: Array<{
      step: number
      text_kr: string
      text_en: string
    }>
    checklist: Array<{
      item_kr: string
      item_en: string
    }>
  }
  recommendedMarkets: MarketRecommendation[]
  totalLeadsCount: string
}

// Analysis phases for loading animation
type AnalysisPhase = {
  id: string
  labelKo: string
  labelEn: string
  icon: React.ElementType
  duration: number
}

const analysisPhases: AnalysisPhase[] = [
  {
    id: "industry",
    labelKo: "산업 분석 중",
    labelEn: "Analyzing industry",
    icon: TrendingUp,
    duration: 1200,
  },
  {
    id: "market",
    labelKo: "시장 데이터 수집",
    labelEn: "Gathering market data",
    icon: Globe,
    duration: 1300,
  },
  {
    id: "matching",
    labelKo: "타겟 고객 매칭",
    labelEn: "Matching target customers",
    icon: Users,
    duration: 1200,
  },
  {
    id: "strategy",
    labelKo: "맞춤 전략 생성 완료",
    labelEn: "Strategy generation complete",
    icon: Sparkles,
    duration: 1300,
  },
]

// Country flags mapping
const COUNTRY_FLAGS: Record<string, string> = {
  JP: "🇯🇵",
  US: "🇺🇸",
  CN: "🇨🇳",
  SEA: "🌏",
  EU: "🇪🇺",
  ME: "🕌",
}

// Mock data generator based on survey params
function generateMockResultData(
  industry: string,
  _targetType: string,
  targetCountry: string,
  exportExp: string,
  lang: string,
): TrialResultData {
  const isKorean = lang === "ko"
  const isTrendDriven = ["beauty", "fashion", "food", "living"].includes(industry)
  const isBeginnerOrJunior = ["none", "some"].includes(exportExp)

  const markets: MarketRecommendation[] = isTrendDriven
    ? [
        {
          rank: 1,
          countryCode: "JP",
          countryName: "일본",
          countryNameEn: "Japan",
          flag: COUNTRY_FLAGS.JP,
          isBestMatch: targetCountry === "jp",
          score: 94,
          marketSize: { kr: "¥450억 규모", en: "¥45B Market" },
          companyCount: { kr: "약 157만 기업", en: "~1.57M companies" },
          entryTime: { kr: "3-4개월", en: "3-4 months" },
          highlights: [
            { kr: "아시아 최대 뷰티 시장", en: "Largest beauty market in Asia" },
            { kr: "K-Beauty 선호도 매우 높음", en: "Very high K-Beauty preference" },
            { kr: "평균 구매력 한국 대비 1.8배", en: "1.8x higher purchasing power vs Korea" },
          ],
          reasonTitle: {
            kr: "브랜드 스토리와 디테일을 중시하는 시장",
            en: "A market valuing brand story and details",
          },
          marketTrend: {
            kr: "패키지 디자인과 성분을 꼼꼼히 확인하며, 오프라인 편집숍 입점이 주요 트렌드입니다.",
            en: "Scrutinizes packaging & ingredients; offline select shop entry is a key trend.",
          },
          salesStrategy: {
            kr: "텍스트 설명보다 고화질 '룩북'과 '샘플 제안'이 필수적입니다.",
            en: "High-res 'Lookbooks' & 'Sample offers' work better than text-heavy descriptions.",
          },
          emailStrategy: {
            subjectLine: "Exclusive Proposal: K-Beauty Trend for [Company]",
            keyFocus: {
              kr: "시각적 자료(Visuals) + 무료 샘플 제안",
              en: "Visual Assets + Free Sample Proposal",
            },
          },
          metrics: {
            openRate: 45,
            responseRate: 6.2,
          },
        },
        {
          rank: 2,
          countryCode: "US",
          countryName: "미국",
          countryNameEn: "United States",
          flag: COUNTRY_FLAGS.US,
          isBestMatch: targetCountry === "us",
          score: 92,
          marketSize: { kr: "$380억 규모", en: "$38B Market" },
          companyCount: { kr: "약 142만 기업", en: "~1.42M companies" },
          entryTime: { kr: "2-3개월", en: "2-3 months" },
          highlights: [
            { kr: "클린 뷰티 트렌드 선도", en: "Clean beauty trend leader" },
            { kr: "인디 브랜드 높은 수요", en: "High demand for indie brands" },
            { kr: "SNS 마케팅 최적화", en: "SNS marketing optimized" },
          ],
          reasonTitle: {
            kr: "클린 뷰티 및 인디 브랜드 수요 폭발",
            en: "High demand for Clean Beauty & Indie Brands",
          },
          marketTrend: {
            kr: "틱톡/릴스 등 숏폼 마케팅과 연계된 B2B 소싱이 활발합니다.",
            en: "B2B sourcing linked with short-form marketing (TikTok/Reels) is active.",
          },
          salesStrategy: {
            kr: "FDA 등록 여부와 현지 물류(3PL) 가능성을 강조하세요.",
            en: "Highlight FDA registration & local logistics (3PL) capabilities.",
          },
          emailStrategy: {
            subjectLine: "Next Viral Brand: Partnership Opportunity",
            keyFocus: {
              kr: "소셜 증명(Social Proof) + 성분 안전성",
              en: "Social Proof + Ingredient Safety",
            },
          },
          metrics: {
            openRate: 33,
            responseRate: 5.1,
          },
        },
        {
          rank: 3,
          countryCode: "SEA",
          countryName: "동남아",
          countryNameEn: "Southeast Asia",
          flag: COUNTRY_FLAGS.SEA,
          isBestMatch: targetCountry === "sea",
          score: 89,
          marketSize: { kr: "$280억 규모", en: "$28B Market" },
          companyCount: { kr: "약 68만 기업", en: "~680K companies" },
          entryTime: { kr: "2-3개월", en: "2-3 months" },
          highlights: [
            { kr: "빠르게 성장하는 시장", en: "Fast-growing market" },
            { kr: "온라인 마켓플레이스 중심", en: "Online marketplace focus" },
            { kr: "가성비 중시", en: "Value-focused buyers" },
          ],
          reasonTitle: {
            kr: "빠르게 성장하는 K-뷰티 선호 시장",
            en: "Fast-growing K-beauty preference market",
          },
          marketTrend: {
            kr: "온라인 마켓플레이스(Shopee, Lazada) 중심으로 빠르게 확산됩니다.",
            en: "Rapidly expanding through online marketplaces (Shopee, Lazada).",
          },
          salesStrategy: {
            kr: "가격 경쟁력과 할랄 인증을 강조하세요.",
            en: "Emphasize price competitiveness and Halal certification.",
          },
          emailStrategy: {
            subjectLine: "K-Beauty Excellence for SEA Market",
            keyFocus: {
              kr: "가성비 + 인증서",
              en: "Value for Money + Certifications",
            },
          },
          metrics: {
            openRate: 38,
            responseRate: 4.8,
          },
        },
      ]
    : [
        {
          rank: 1,
          countryCode: "US",
          countryName: "미국",
          countryNameEn: "United States",
          flag: COUNTRY_FLAGS.US,
          isBestMatch: targetCountry === "us",
          score: 94,
          marketSize: { kr: "$580억 규모", en: "$58B Market" },
          companyCount: { kr: "약 187만 기업", en: "~1.87M companies" },
          entryTime: { kr: "3-4개월", en: "3-4 months" },
          highlights: [
            { kr: "세계 최대 IT/제조 시장", en: "World's largest IT/Manufacturing market" },
            { kr: "혁신 기술 높은 수요", en: "High demand for innovation" },
            { kr: "ROI 중심 의사결정", en: "ROI-focused decision making" },
          ],
          reasonTitle: {
            kr: "혁신과 ROI를 중시하는 기술 시장",
            en: "Innovation and ROI-focused tech market",
          },
          marketTrend: {
            kr: "공급망 안정성과 데이터 보안이 핵심 구매 요소입니다.",
            en: "Supply chain stability and data security are key purchasing factors.",
          },
          salesStrategy: {
            kr: "구체적인 사양서와 비용 절감 사례를 제시하세요.",
            en: "Present detailed specifications and cost reduction case studies.",
          },
          emailStrategy: {
            subjectLine: "Cost Reduction Solution: ROI-Proven Technology",
            keyFocus: {
              kr: "데이터 기반 ROI + 레퍼런스",
              en: "Data-driven ROI + References",
            },
          },
          metrics: {
            openRate: 29,
            responseRate: 7.5,
          },
        },
        {
          rank: 2,
          countryCode: "EU",
          countryName: "유럽",
          countryNameEn: "Europe",
          flag: COUNTRY_FLAGS.EU,
          isBestMatch: targetCountry === "eu",
          score: 92,
          marketSize: { kr: "€420억 규모", en: "€42B Market" },
          companyCount: { kr: "약 152만 기업", en: "~1.52M companies" },
          entryTime: { kr: "4-5개월", en: "4-5 months" },
          highlights: [
            { kr: "품질 인증 필수", en: "Quality certification required" },
            { kr: "지속가능성 중시", en: "Sustainability focus" },
            { kr: "장기 파트너십 선호", en: "Prefer long-term partnerships" },
          ],
          reasonTitle: {
            kr: "품질 인증과 지속가능성을 중시",
            en: "Quality certification and sustainability focus",
          },
          marketTrend: {
            kr: "CE 인증, GDPR 준수 등 규제 대응이 필수입니다.",
            en: "Regulatory compliance like CE marking and GDPR is essential.",
          },
          salesStrategy: {
            kr: "인증서와 환경 친화적 프로세스를 강조하세요.",
            en: "Emphasize certifications and eco-friendly processes.",
          },
          emailStrategy: {
            subjectLine: "Certified Excellence: Premium Solutions for EU",
            keyFocus: {
              kr: "인증서 + 지속가능성",
              en: "Certifications + Sustainability",
            },
          },
          metrics: {
            openRate: 25,
            responseRate: 6.8,
          },
        },
        {
          rank: 3,
          countryCode: "ME",
          countryName: "중동",
          countryNameEn: "Middle East",
          flag: COUNTRY_FLAGS.ME,
          isBestMatch: targetCountry === "ae",
          score: 89,
          marketSize: { kr: "$320억 규모", en: "$32B Market" },
          companyCount: { kr: "약 85만 기업", en: "~850K companies" },
          entryTime: { kr: "3-4개월", en: "3-4 months" },
          highlights: [
            { kr: "인프라 투자 활발", en: "Active infrastructure investment" },
            { kr: "현지화 전략 중요", en: "Localization strategy important" },
            { kr: "장기 계약 선호", en: "Long-term contract preference" },
          ],
          reasonTitle: {
            kr: "인프라 투자가 활발한 신흥 시장",
            en: "Emerging market with active infrastructure investment",
          },
          marketTrend: {
            kr: "장기 파트너십과 현지화 전략이 중요합니다.",
            en: "Long-term partnerships and localization strategies are important.",
          },
          salesStrategy: {
            kr: "글로벌 레퍼런스와 맞춤형 솔루션을 제시하세요.",
            en: "Present global references and customized solutions.",
          },
          emailStrategy: {
            subjectLine: "Strategic Partnership: Proven Solutions for MENA",
            keyFocus: {
              kr: "글로벌 레퍼런스 + 커스터마이징",
              en: "Global References + Customization",
            },
          },
          metrics: {
            openRate: 31,
            responseRate: 5.9,
          },
        },
      ]

  // Calculate total leads
  const totalLeads = markets.reduce((sum, m) => {
    const count = Number.parseFloat(m.companyCount.kr.replace(/[^\d.]/g, ""))
    return sum + count
  }, 0)

  return {
    userContext: {
      industryLabel: isKorean
        ? industry === "beauty"
          ? "뷰티 / 화장품"
          : industry === "fashion"
            ? "패션 / 의류"
            : industry === "food"
              ? "식품 / 건기식"
              : industry === "it_saas"
                ? "IT / 소프트웨어"
                : industry === "manufacturing"
                  ? "제조 / 부품"
                  : "기타"
        : industry === "beauty"
          ? "Beauty / Cosmetics"
          : industry === "fashion"
            ? "Fashion / Apparel"
            : industry === "food"
              ? "Food / Health Supple."
              : industry === "it_saas"
                ? "IT / Software"
                : industry === "manufacturing"
                  ? "Manufacturing / Parts"
                  : "Other",
      experienceLabel: isKorean
        ? exportExp === "none"
          ? "처음입니다"
          : exportExp === "some"
            ? "1~3회 (초기)"
            : "능숙함 (4회 이상)"
        : exportExp === "none"
          ? "First time"
          : exportExp === "some"
            ? "1-3 times (Early stage)"
            : "Experienced (4+ times)",
    },
    lindaSolution: {
      directionTitle: {
        kr: isBeginnerOrJunior
          ? "수출 초보시군요? 린다가 바이어 발굴부터 도와드려요."
          : "경험자를 위한 자동화 전략으로 효율을 극대화하세요.",
        en: isBeginnerOrJunior
          ? "New to export? Linda helps from buyer sourcing to contact."
          : "Maximize efficiency with automation strategies for experienced exporters.",
      },
      actionSteps: isBeginnerOrJunior
        ? [
            {
              step: 1,
              text_kr: "잠재 고객 발굴 - AI가 타겟 기업의 의사결정권자를 자동으로 찾아요",
              text_en:
                "Lead Discovery - AI automatically finds decision-makers at target companies",
            },
            {
              step: 2,
              text_kr: "맞춤 이메일 발송 - 각 기업에 개인화된 영업 메일을 자동 발송해요",
              text_en:
                "Personalized Emails - Automatically send customized sales emails to each company",
            },
            {
              step: 3,
              text_kr: "응답 관리 - 관심있는 고객의 응답을 분석하고 후속 조치해요",
              text_en: "Response Management - Analyze interested customer responses and follow up",
            },
            {
              step: 4,
              text_kr: "미팅 조율 - 구매 의향이 높은 고객과 미팅을 자동 세팅해요",
              text_en:
                "Meeting Coordination - Automatically set up meetings with high-intent customers",
            },
          ]
        : [
            {
              step: 1,
              text_kr: "CRM 연동 - 리드를 자동으로 동기화하여 효율을 높여요",
              text_en: "CRM Integration - Sync leads automatically to increase efficiency",
            },
            {
              step: 2,
              text_kr: "멀티채널 시퀀스 - 이메일, 링크드인 등 다채널로 접근해요",
              text_en: "Multi-channel Sequences - Reach out via email, LinkedIn, and more",
            },
            {
              step: 3,
              text_kr: "AI 분석 - 최적의 접근 시간과 메시지를 AI가 학습해요",
              text_en: "AI Analysis - AI learns optimal outreach timing and messaging",
            },
            {
              step: 4,
              text_kr: "파이프라인 자동화 - 영업 프로세스를 완전 자동화해요",
              text_en: "Pipeline Automation - Fully automate your sales process",
            },
          ],
      checklist: isBeginnerOrJunior
        ? [
            { item_kr: "영문 회사 소개서", item_en: "English company profile" },
            { item_kr: "제품 데모 자료", item_en: "Product demo materials" },
            { item_kr: "가격표 (MOQ 포함)", item_en: "Price list (incl. MOQ)" },
            { item_kr: "샘플 제품", item_en: "Sample products" },
            { item_kr: "레퍼런스 고객 사례", item_en: "Reference customer cases" },
            { item_kr: "현지 결제 시스템", item_en: "Local payment system" },
          ]
        : [
            { item_kr: "기술 사양서 / 화이트페이퍼", item_en: "Tech specifications / Whitepaper" },
            { item_kr: "ISO 인증서", item_en: "ISO certifications" },
            { item_kr: "영문 웹사이트", item_en: "English website" },
            { item_kr: "레퍼런스 리스트", item_en: "Reference list" },
            { item_kr: "계약서 템플릿", item_en: "Contract templates" },
            { item_kr: "다국어 고객지원", item_en: "Multilingual support" },
          ],
    },
    recommendedMarkets: markets,
    totalLeadsCount: `${Math.round(totalLeads * 10) / 10}만`,
  }
}

export default function TrialResultPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { i18n } = useTranslation()
  const [resultData, setResultData] = useState<TrialResultData | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [currentPhase, setCurrentPhase] = useState(0)
  const [progress, setProgress] = useState(0)
  const [completedPhases, setCompletedPhases] = useState<string[]>([])
  const [showCTA, setShowCTA] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<MarketRecommendation | null>(null)

  // Analysis animation effect
  useEffect(() => {
    if (!isAnalyzing) return
    if (currentPhase >= analysisPhases.length) {
      setIsAnalyzing(false)
      return
    }

    const phase = analysisPhases[currentPhase]
    const progressIncrement = 100 / (phase.duration / 30)

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + progressIncrement
        return next >= 100 ? 100 : next
      })
    }, 30)

    const phaseTimer = setTimeout(() => {
      setCompletedPhases((prev) => [...prev, phase.id])
      setProgress(0)
      setCurrentPhase((prev) => prev + 1)
    }, phase.duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(phaseTimer)
    }
  }, [currentPhase, isAnalyzing])

  // Data loading effect
  useEffect(() => {
    // Get survey params from URL or sessionStorage
    const industry = searchParams.get("industry") || ""
    const target = searchParams.get("target") || ""
    const country = searchParams.get("country") || ""
    const experience = searchParams.get("experience") || ""

    if (!industry || !target || !country || !experience) {
      toast.error("설문 정보가 없습니다. 다시 시도해주세요.")
      navigate("/onboarding")
      return
    }

    // Generate data after analysis is complete
    if (!isAnalyzing && !resultData) {
      const data = generateMockResultData(industry, target, country, experience, i18n.language)
      setResultData(data)
    }
  }, [searchParams, navigate, i18n.language, isAnalyzing, resultData])

  const handleGetStarted = () => {
    navigate("/app")
  }

  const isKorean = i18n.language === "ko"
  const overallProgress = ((currentPhase + progress / 100) / analysisPhases.length) * 100

  // Loading/Analysis view
  if (isAnalyzing || !resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-blue-50 via-white to-indigo-50">
        {/* Language Switcher */}
        <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 relative shadow-lg">
              <Brain className="w-10 h-10 text-blue-600" />
              <Loader2
                className="absolute inset-0 w-20 h-20 text-blue-600/50 animate-spin"
                style={{ animationDuration: "3s" }}
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isKorean
                  ? "RINDA가 귀사만의 전략을 만들고 있어요"
                  : "RINDA is creating your custom strategy"}
              </h2>
              <p className="text-sm text-gray-600">
                {isKorean
                  ? "곧 완성됩니다, 조금만 기다려주세요"
                  : "Almost there, please wait a moment"}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-gray-900">
                {isKorean ? "분석 진행 중" : "Analysis in progress"}
              </span>
              <span className="font-bold text-blue-600">{Math.round(overallProgress)}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <Card className="p-5 bg-white border-2 border-gray-200 shadow-lg">
            <div className="space-y-3">
              {analysisPhases.map((phase, index) => {
                const Icon = phase.icon
                const isActive = index === currentPhase
                const isCompleted = completedPhases.includes(phase.id)

                return (
                  <div
                    key={phase.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-blue-50 border-2 border-blue-300 shadow-sm"
                        : isCompleted
                          ? "bg-green-50 border-2 border-green-300"
                          : "bg-gray-50 border border-gray-200 opacity-60"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                            ? "bg-blue-600 text-white"
                            : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-sm font-semibold ${
                            isActive
                              ? "text-blue-600"
                              : isCompleted
                                ? "text-green-700"
                                : "text-gray-500"
                          }`}
                        >
                          {isKorean ? phase.labelKo : phase.labelEn}
                        </span>
                        {isCompleted && (
                          <span className="text-xs text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded-full">
                            {isKorean ? "완료" : "Done"}
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <div className="mt-1.5">
                          <Progress value={progress} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="text-center">
            <p className="text-sm text-gray-600 bg-blue-50 inline-block px-4 py-2 rounded-full border border-blue-200">
              <Sparkles className="w-4 h-4 inline mr-1.5 text-blue-600" />
              {isKorean
                ? "글로벌 시장 데이터를 실시간으로 분석하고 있어요"
                : "Analyzing global market data in real-time"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Result view
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 relative overflow-hidden">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Sticky CTA Banner */}
      {showCTA && (
        <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg flex-shrink-0">
                <Rocket className="w-4 sm:w-5 h-4 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-base font-bold truncate">
                  <span className="text-yellow-300">{resultData.totalLeadsCount} 잠재 고객</span>{" "}
                  {isKorean ? "준비 완료!" : "Ready!"}
                </p>
                <p className="text-[10px] sm:text-xs text-blue-100 hidden sm:block">
                  {isKorean
                    ? "지금 활성화하면 48시간 내 첫 리드를 받아보실 수 있어요"
                    : "Activate now to receive your first lead within 48 hours"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                onClick={handleGetStarted}
                size="sm"
                className="bg-yellow-400 text-blue-900 hover:bg-yellow-300 font-bold whitespace-nowrap px-3 sm:px-6 text-xs sm:text-sm h-8 sm:h-10 shadow-lg"
              >
                <Zap className="w-3 sm:w-4 h-3 sm:h-4 mr-1" />
                <span className="hidden sm:inline">
                  {isKorean ? "지금 바로 시작하기" : "Start Now"}
                </span>
                <span className="sm:hidden">{isKorean ? "시작" : "Start"}</span>
                <ArrowRight className="w-3 sm:w-4 h-3 sm:h-4 ml-1" />
              </Button>
              <Button
                onClick={() => setShowCTA(false)}
                size="sm"
                variant="ghost"
                className="hover:bg-white/10 h-8 w-8 sm:h-10 sm:w-10 p-0 text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-4 sm:space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-full text-xs sm:text-sm font-bold shadow-md">
            <Bot className="w-3 sm:w-4 h-3 sm:h-4" />
            {isKorean ? "AI 분석 완료" : "AI Analysis Complete"}
            <CheckCircle2 className="w-3 sm:w-4 h-3 sm:h-4" />
          </div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            <span className="text-blue-600">
              {isKorean
                ? `${resultData.userContext.industryLabel}에 딱 맞는`
                : "Perfect match for your"}
            </span>
            <br />
            <span className="whitespace-nowrap">
              {isKorean ? "3개 시장을 찾았어요!" : "3 markets found!"}
            </span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
            {isKorean
              ? "RINDA가 전 세계 데이터를 분석하여 귀사에게 가장 적합한 시장을 선정했습니다"
              : "RINDA analyzed global data to select the most suitable markets for your company"}
          </p>
        </div>

        {/* Market Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {resultData.recommendedMarkets.map((market) => (
            <Card
              key={market.countryCode}
              className="p-4 sm:p-5 hover:shadow-xl transition-all border-2 border-gray-200 hover:border-blue-500 bg-white relative overflow-hidden cursor-pointer"
              onClick={() => setSelectedMarket(market)}
            >
              {market.isBestMatch && (
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 px-2 sm:px-3 py-0.5 sm:py-1 rounded-bl-lg font-bold text-[10px] sm:text-xs">
                  BEST
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-3xl sm:text-4xl">{market.flag}</div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                        {isKorean ? market.countryName : market.countryNameEn}
                      </h3>
                      <Badge className="bg-blue-600 text-white text-[10px] sm:text-xs">
                        #{market.rank}
                      </Badge>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-blue-600">
                      {isKorean ? market.marketSize.kr : market.marketSize.en}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] sm:text-xs mb-1">
                    <span className="text-gray-600">{isKorean ? "적합도" : "Match Score"}</span>
                    <span className="font-bold text-blue-600">
                      {market.score}
                      {isKorean ? "점" : ""}
                    </span>
                  </div>
                  <div className="h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${market.score}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg text-center">
                    <div className="text-[10px] sm:text-xs text-gray-600">
                      {isKorean ? "잠재 고객" : "Companies"}
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold text-blue-600">
                      {isKorean ? market.companyCount.kr : market.companyCount.en}
                    </div>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg text-center">
                    <div className="text-[10px] sm:text-xs text-gray-600">
                      {isKorean ? "진입 기간" : "Entry Time"}
                    </div>
                    <div className="text-[10px] sm:text-xs font-bold text-blue-600">
                      {isKorean ? market.entryTime.kr : market.entryTime.en}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  {market.highlights.map((h, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 sm:gap-2">
                      <CheckCircle2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] sm:text-xs text-gray-700">
                        {isKorean ? h.kr : h.en}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-blue-600 border-blue-300 hover:bg-blue-50 text-[10px] sm:text-xs bg-transparent h-8 sm:h-9"
                >
                  {isKorean ? "상세 보기" : "View Details"}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Strategy Summary */}
        <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-blue-600 rounded-xl flex-shrink-0 shadow-md">
              <Globe className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
            </div>
            <div className="flex-1 space-y-2 sm:space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                {isKorean ? "귀사 맞춤 글로벌 진출 전략" : "Your Custom Global Expansion Strategy"}
              </h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {isKorean ? (
                  <>
                    RINDA가 분석한 결과, 추천된 시장에서 큰 기회를 발견했어요. 총{" "}
                    <span className="text-blue-600 font-bold">
                      {resultData.totalLeadsCount} 잠재 고객
                    </span>
                    에게 RINDA가 자동으로 맞춤 영업을 진행해드립니다.
                  </>
                ) : (
                  <>
                    Based on RINDA's analysis, we've found great opportunities in the recommended
                    markets. RINDA will automatically conduct customized sales to a total of{" "}
                    <span className="text-blue-600 font-bold">
                      {resultData.totalLeadsCount} potential customers
                    </span>
                    .
                  </>
                )}
              </p>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-700 bg-white px-3 sm:px-4 py-2 rounded-lg border border-blue-200">
                <Sparkles className="w-3 sm:w-4 h-3 sm:h-4" />
                <span className="font-medium">
                  {isKorean
                    ? "48시간 내 첫 검증된 리드를 받아보실 수 있어요"
                    : "Receive your first qualified lead within 48 hours"}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* RINDA Agent Steps */}
        <Card className="p-4 sm:p-5 bg-white border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg flex-shrink-0">
              <Users className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3">
                {isKorean
                  ? "RINDA Agent가 자동으로 진행하는 일"
                  : "What RINDA Agent Does Automatically"}
              </h2>
              <div className="space-y-1.5 sm:space-y-2">
                {resultData.lindaSolution.actionSteps.map((step) => (
                  <div
                    key={step.step}
                    className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-blue-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {step.step}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-700">
                      {isKorean ? step.text_kr : step.text_en}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Checklist */}
        <Card className="p-4 sm:p-5 bg-white border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg flex-shrink-0">
              <Zap className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3">
                {isKorean ? "해외진출 준비 체크리스트" : "Export Readiness Checklist"}
              </h2>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {resultData.lindaSolution.checklist.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white rounded-lg border border-gray-200"
                  >
                    <CheckCircle2 className="w-3 sm:w-4 h-3 sm:h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-[10px] sm:text-xs font-medium text-gray-800">
                      {isKorean ? item.item_kr : item.item_en}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* CTA Button */}
        <div className="flex justify-center pt-2 sm:pt-4">
          <Button
            onClick={handleGetStarted}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 sm:px-10 py-5 sm:py-7 text-sm sm:text-lg shadow-xl hover:shadow-2xl transition-all"
          >
            <Zap className="w-4 sm:w-5 h-4 sm:h-5 mr-2" />
            {isKorean ? "지금 바로 캠페인 활성화하기" : "Activate Campaign Now"}
            <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 ml-2" />
          </Button>
        </div>
      </div>

      {/* Market Detail Sidebar */}
      {selectedMarket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 border-none cursor-default"
            onClick={() => setSelectedMarket(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedMarket(null)}
            aria-label="Close sidebar"
          />
          <div className="relative w-full sm:max-w-lg bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">{selectedMarket.flag}</span>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">
                    {isKorean ? selectedMarket.countryName : selectedMarket.countryNameEn}{" "}
                    {isKorean ? "시장" : "Market"}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {isKorean ? selectedMarket.marketSize.kr : selectedMarket.marketSize.en}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMarket(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
              <Card className="p-3 sm:p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Bot className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-blue-600 mb-1">
                      {isKorean ? "시장 분석" : "Market Analysis"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-700 mb-2">
                      {isKorean ? selectedMarket.reasonTitle.kr : selectedMarket.reasonTitle.en}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {isKorean ? selectedMarket.marketTrend.kr : selectedMarket.marketTrend.en}
                    </p>
                  </div>
                </div>
              </Card>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">
                  {isKorean ? "영업 전략" : "Sales Strategy"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 p-3 bg-gray-50 rounded-lg">
                  {isKorean ? selectedMarket.salesStrategy.kr : selectedMarket.salesStrategy.en}
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">
                  {isKorean ? "이메일 전략" : "Email Strategy"}
                </h3>
                <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-xs font-semibold text-gray-600">
                      {isKorean ? "제목" : "Subject"}:
                    </span>
                    <p className="text-xs text-gray-800 mt-1">
                      {selectedMarket.emailStrategy.subjectLine}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-600">
                      {isKorean ? "핵심 포인트" : "Key Focus"}:
                    </span>
                    <p className="text-xs text-gray-800 mt-1">
                      {isKorean
                        ? selectedMarket.emailStrategy.keyFocus.kr
                        : selectedMarket.emailStrategy.keyFocus.en}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">
                  {isKorean ? "예상 성과" : "Expected Performance"}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <div className="text-xs text-gray-600">{isKorean ? "오픈율" : "Open Rate"}</div>
                    <div className="text-xl font-bold text-blue-600">
                      {selectedMarket.metrics.openRate}%
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg text-center">
                    <div className="text-xs text-gray-600">
                      {isKorean ? "응답률" : "Response Rate"}
                    </div>
                    <div className="text-xl font-bold text-green-600">
                      {selectedMarket.metrics.responseRate}%
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleGetStarted}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 sm:py-5 text-sm sm:text-base"
              >
                {isKorean
                  ? `${selectedMarket.countryName} 시장 캠페인 시작하기`
                  : `Start ${selectedMarket.countryNameEn} Campaign`}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
