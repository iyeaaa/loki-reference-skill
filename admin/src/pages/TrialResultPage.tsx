import {
  ArrowRight,
  Brain,
  Building2,
  Calendar,
  CheckCircle2,
  Globe,
  Landmark,
  Loader2,
  Mail,
  MessageSquare,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type MarketRecommendation = {
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

type TrialResultData = {
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
            kr: "인프라 중심의 정부 프로젝트 시장",
            en: "Infrastructure-focused market",
          },
          marketTrend: {
            kr: "정부 프로젝트와 대규모 인프라 사업이 활발하게 진행 중입니다.",
            en: "Government projects and large-scale infrastructure developments are actively underway.",
          },
          salesStrategy: {
            kr: "정부 관계와 현지 파트너십에 집중하세요.",
            en: "Focus on government relations and local partnerships.",
          },
          emailStrategy: {
            subjectLine: "Strategic Partnership: Infrastructure Solutions for MENA",
            keyFocus: {
              kr: "현지 진출 + 장기 파트너십",
              en: "Local presence + Long-term partnerships",
            },
          },
          metrics: {
            openRate: 25,
            responseRate: 6.2,
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
  const [selectedMarket, setSelectedMarket] = useState<MarketRecommendation | null>(null)

  // Analysis animation effect
  useEffect(() => {
    if (!isAnalyzing) {
      return
    }
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

    if (!(industry && target && country && experience)) {
      toast.error("설문 정보가 없습니다. 다시 시도해주세요.")
      navigate("/onboarding")
      return
    }

    // Generate data after analysis is complete
    if (!(isAnalyzing || resultData)) {
      const data = generateMockResultData(industry, target, country, experience, i18n.language)
      setResultData(data)
    }
  }, [searchParams, navigate, i18n.language, isAnalyzing, resultData])

  const handleGetStarted = () => {
    navigate("/company")
  }

  const isKorean = i18n.language === "ko"
  const overallProgress = ((currentPhase + progress / 100) / analysisPhases.length) * 100

  // Loading/Analysis view
  if (isAnalyzing || !resultData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 via-white to-indigo-50 p-4">
        {/* Language Switcher */}
        <div className="absolute top-4 right-4 z-10">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-xl space-y-6">
          <div className="space-y-4 text-center">
            <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg">
              <Brain className="h-10 w-10 text-blue-600" />
              <Loader2
                className="absolute inset-0 h-20 w-20 animate-spin text-blue-600/50"
                style={{ animationDuration: "3s" }}
              />
            </div>
            <div>
              <h2 className="mb-2 font-bold text-2xl text-gray-900">
                {isKorean
                  ? "RINDA가 귀사만의 전략을 만들고 있어요"
                  : "RINDA is creating your custom strategy"}
              </h2>
              <p className="text-gray-600 text-sm">
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
            <div className="h-3 overflow-hidden rounded-full bg-gray-200 shadow-inner">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          <Card className="border-2 border-gray-200 bg-white p-5 shadow-lg">
            <div className="space-y-3">
              {analysisPhases.map((phase, index) => {
                const Icon = phase.icon
                const isActive = index === currentPhase
                const isCompleted = completedPhases.includes(phase.id)

                return (
                  <div
                    className={`flex items-center gap-3 rounded-xl p-3 transition-all duration-300 ${
                      isActive
                        ? "border-2 border-blue-300 bg-blue-50 shadow-sm"
                        : isCompleted
                          ? "border-2 border-green-300 bg-green-50"
                          : "border border-gray-200 bg-gray-50 opacity-60"
                    }`}
                    key={phase.id}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl shadow-sm transition-all ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isActive
                            ? "bg-blue-600 text-white"
                            : "bg-gray-300 text-gray-600"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={`font-semibold text-sm ${
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
                          <span className="rounded-full bg-green-100 px-2 py-0.5 font-bold text-green-600 text-xs">
                            {isKorean ? "완료" : "Done"}
                          </span>
                        )}
                      </div>
                      {isActive && (
                        <div className="mt-1.5">
                          <Progress className="h-1.5" value={progress} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="text-center">
            <p className="inline-block rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-gray-600 text-sm">
              <Sparkles className="mr-1.5 inline h-4 w-4 text-blue-600" />
              {isKorean
                ? "글로벌 시장 데이터를 실시간으로 분석하고 있어요"
                : "Analyzing global market data in real-time"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // RINDA actions for the 2x2 grid
  const rindaActions = [
    {
      icon: Search,
      textKr: "타겟 기업의 의사결정권자 찾기",
      textEn: "Find decision-makers at target companies",
    },
    {
      icon: Mail,
      textKr: "맞춤형 영업 이메일 발송",
      textEn: "Send personalized sales emails",
    },
    {
      icon: MessageSquare,
      textKr: "응답 분석 및 후속 조치",
      textEn: "Analyze responses and follow up",
    },
    {
      icon: Calendar,
      textKr: "관심 고객과 미팅 설정",
      textEn: "Set up meetings with high-intent leads",
    },
  ]

  // Result view
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <span className="font-medium text-gray-900">
            {resultData.totalLeadsCount}{" "}
            {isKorean ? "잠재 고객 준비 완료!" : "Potential Customers Ready!"}
          </span>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 font-medium text-sm text-white">
            <CheckCircle2 className="h-4 w-4" />
            {isKorean ? "AI 분석 완료" : "AI Analysis Complete"}
          </div>
          <h1 className="mb-3 font-bold text-3xl text-gray-900 md:text-4xl">
            {isKorean ? "3개 시장을 찾았어요" : "3 markets found for you"}
          </h1>
          <p className="mx-auto max-w-2xl text-gray-600">
            {isKorean
              ? "RINDA가 전 세계 데이터를 분석하여 귀사에게 가장 적합한 시장을 선정했습니다"
              : "RINDA analyzed global data to find the best markets for your company"}
          </p>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Market Cards Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {resultData.recommendedMarkets.map((market) => (
                <Card className="border border-gray-200 bg-white p-4" key={market.countryCode}>
                  <div className="mb-4 flex items-center gap-3">
                    {market.countryCode === "ME" ? (
                      <Landmark className="h-8 w-8 text-gray-600" />
                    ) : (
                      <span className="font-bold text-2xl text-gray-700">{market.countryCode}</span>
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">
                        {isKorean ? market.countryName : market.countryNameEn}
                      </div>
                      <div className="font-medium text-blue-600 text-sm">
                        {isKorean ? market.marketSize.kr : market.marketSize.en}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-gray-500">{isKorean ? "매칭" : "Match"}</span>
                      <span className="font-bold text-blue-600">{market.score}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${market.score}%` }}
                      />
                    </div>
                  </div>

                  <button
                    className="flex items-center gap-1 font-medium text-blue-600 text-sm hover:text-blue-700"
                    onClick={() => setSelectedMarket(market)}
                    type="button"
                  >
                    {isKorean ? "왜 추천?" : "Why recommend?"}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </Card>
              ))}
            </div>

            {/* Strategy Card */}
            <Card className="border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {isKorean ? "귀사 맞춤 글로벌 진출 전략" : "Your Global Expansion Strategy"}
                  </div>
                  <div className="text-gray-600 text-sm">
                    {isKorean ? (
                      <>
                        RINDA가{" "}
                        <span className="font-semibold text-blue-600">
                          {resultData.totalLeadsCount} 잠재 고객
                        </span>
                        에게 맞춤 영업을 진행합니다
                      </>
                    ) : (
                      <>
                        RINDA will conduct customized sales to{" "}
                        <span className="font-semibold text-blue-600">
                          {resultData.totalLeadsCount} potential customers
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Export Ready Checklist - Moved from right column */}
            <Card className="border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">
                {isKorean ? "수출 준비 완료" : "Export Ready"}
              </h3>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {resultData.lindaSolution.checklist.map((item, idx) => (
                  <div className="flex items-center gap-2" key={idx}>
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    <span className="text-gray-700 text-sm">
                      {isKorean ? item.item_kr : item.item_en}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* What RINDA Does Automatically - Moved from left column */}
            <Card className="border border-gray-200 bg-white p-4">
              <h3 className="mb-4 font-semibold text-gray-900">
                {isKorean ? "RINDA가 자동으로 하는 일" : "What RINDA Does Automatically"}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {rindaActions.map((action, idx) => {
                  const Icon = action.icon
                  return (
                    <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3" key={idx}>
                      <div className="flex-shrink-0 rounded-lg bg-blue-100 p-2">
                        <Icon className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-gray-700 text-sm">
                        {isKorean ? action.textKr : action.textEn}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
            <Button
              className="h-14 w-full bg-blue-600 font-semibold text-base text-white hover:bg-blue-700"
              onClick={handleGetStarted}
            >
              <Sparkles className="mr-2 h-5 w-5" />
              {isKorean ? "30개 기업에 영업 시작하기" : "Start Sales Campaign for 30 Companies"}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Market Detail Sidebar */}
      {selectedMarket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <button
            aria-label="Close sidebar"
            className="absolute inset-0 cursor-default border-none bg-black/30"
            onClick={() => setSelectedMarket(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedMarket(null)}
            type="button"
          />

          {/* Sidebar */}
          <div className="relative w-full max-w-md overflow-y-auto bg-white shadow-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
              <div className="flex items-center gap-3">
                {selectedMarket.countryCode === "ME" ? (
                  <Landmark className="h-8 w-8 text-gray-600" />
                ) : (
                  <span className="font-bold text-2xl text-gray-600">
                    {selectedMarket.countryCode}
                  </span>
                )}
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    {isKorean ? selectedMarket.countryName : selectedMarket.countryNameEn}
                  </h2>
                  <p className="text-gray-500 text-sm">
                    {isKorean ? selectedMarket.marketSize.kr : selectedMarket.marketSize.en}
                  </p>
                </div>
              </div>
              <button
                className="rounded-lg p-2 hover:bg-gray-100"
                onClick={() => setSelectedMarket(null)}
                type="button"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-5 p-4">
              {/* Market Analysis */}
              <Card className="border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div>
                    <p className="mb-1 font-bold text-blue-600 text-xs">
                      {isKorean ? "시장 분석" : "Market Analysis"}
                    </p>
                    <p className="mb-1 font-semibold text-gray-900 text-sm">
                      {isKorean ? selectedMarket.reasonTitle.kr : selectedMarket.reasonTitle.en}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {isKorean ? selectedMarket.marketTrend.kr : selectedMarket.marketTrend.en}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Sales Strategy */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">
                    {isKorean ? "영업 전략" : "Sales Strategy"}
                  </h3>
                </div>
                <p className="rounded-lg bg-gray-50 p-3 text-gray-700 text-sm">
                  {isKorean ? selectedMarket.salesStrategy.kr : selectedMarket.salesStrategy.en}
                </p>
              </div>

              {/* Email Strategy */}
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">
                    {isKorean ? "이메일 전략" : "Email Strategy"}
                  </h3>
                </div>
                <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                  <div>
                    <span className="text-gray-500 text-xs">{isKorean ? "제목:" : "Subject:"}</span>
                    <p className="text-gray-800 text-sm">
                      {selectedMarket.emailStrategy.subjectLine}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs">
                      {isKorean ? "핵심 포인트:" : "Key Focus:"}
                    </span>
                    <p className="text-gray-800 text-sm">
                      {isKorean
                        ? selectedMarket.emailStrategy.keyFocus.kr
                        : selectedMarket.emailStrategy.keyFocus.en}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expected Performance */}
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  {isKorean ? "예상 성과" : "Expected Performance"}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-blue-50 p-3 text-center">
                    <div className="mb-1 text-gray-500 text-xs">
                      {isKorean ? "오픈율" : "Open Rate"}
                    </div>
                    <div className="font-bold text-2xl text-blue-600">
                      {selectedMarket.metrics.openRate}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-green-50 p-3 text-center">
                    <div className="mb-1 text-gray-500 text-xs">
                      {isKorean ? "응답률" : "Response Rate"}
                    </div>
                    <div className="font-bold text-2xl text-green-600">
                      {selectedMarket.metrics.responseRate}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Insights */}
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  {isKorean ? "핵심 인사이트" : "Key Insights"}
                </h3>
                <div className="space-y-2">
                  {selectedMarket.highlights.map((highlight, idx) => (
                    <div className="flex items-center gap-2" key={idx}>
                      <TrendingUp className="h-4 w-4 flex-shrink-0 text-blue-600" />
                      <span className="text-gray-700 text-sm">
                        {isKorean ? highlight.kr : highlight.en}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA Button */}
              <Button
                className="w-full bg-blue-600 py-4 font-medium text-white hover:bg-blue-700"
                onClick={handleGetStarted}
              >
                {isKorean
                  ? `${selectedMarket.countryName} 캠페인 시작`
                  : `Start Campaign - ${selectedMarket.countryNameEn}`}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
