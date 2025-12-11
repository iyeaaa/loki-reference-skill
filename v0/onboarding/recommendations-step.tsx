"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, CheckCircle2, X, Bot, Globe, Zap, Rocket, Users, Sparkles } from "lucide-react"
import type { OnboardingData } from "../onboarding-flow"

type Props = {
  data: OnboardingData
  onNext: () => void
}

type Market = {
  country: string
  flag: string
  score: number
  marketSize: string
  companyCount: string
  entryTime: string
  highlights: string[]
  aiInsight: string
}

const markets: Market[] = [
  {
    country: "독일",
    flag: "🇩🇪",
    score: 94,
    marketSize: "€450억 규모",
    companyCount: "약 157만 기업",
    entryTime: "3-4개월",
    highlights: ["유럽 최대 B2B 시장", "제조업 강국 - 최적의 타겟", "영어 비즈니스 95% 가능"],
    aiInsight: "독일 제조업 시장에서 귀사 제품의 잠재 수요가 높습니다. 평균 계약 규모가 한국 대비 2.3배 높아요.",
  },
  {
    country: "영국",
    flag: "🇬🇧",
    score: 92,
    marketSize: "£380억 규모",
    companyCount: "약 142만 기업",
    entryTime: "2-3개월",
    highlights: ["런던 테크 허브 - 유럽 1위", "언어 장벽 Zero", "유럽 확장의 교두보"],
    aiInsight: "언어/문화 유사성으로 가장 빠른 진입이 가능해요. 평균 영업 사이클이 독일보다 30% 짧습니다.",
  },
  {
    country: "싱가포르",
    flag: "🇸🇬",
    score: 89,
    marketSize: "$280억 규모",
    companyCount: "약 28만 기업",
    entryTime: "2-3개월",
    highlights: ["APAC 비즈니스 허브", "1인당 GDP 세계 8위", "동남아 6억 시장 거점"],
    aiInsight: "아시아 시장의 관문입니다. 여기서 레퍼런스를 만들면 동남아 전역으로 빠르게 확장할 수 있어요.",
  },
]

export function RecommendationsStep({ data, onNext }: Props) {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [showCTA, setShowCTA] = useState(true)
  const [showDbPopup, setShowDbPopup] = useState(false)
  const [dbAdded, setDbAdded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowDbPopup(true)
      setDbAdded(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (showDbPopup) {
      const timer = setTimeout(() => {
        setShowDbPopup(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showDbPopup])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 relative overflow-hidden">
      {showDbPopup && (
        <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 animate-slide-up">
          <Card className="p-3 sm:p-5 bg-white border-2 border-green-400 shadow-2xl max-w-[280px] sm:max-w-sm">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 sm:w-6 h-5 sm:h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 mb-1 text-sm sm:text-base">Buyer DB 추가 완료!</p>
                <p className="text-xs sm:text-sm text-gray-600">327만 잠재 고객이 귀사의 타겟 리스트에 추가되었어요</p>
              </div>
              <button onClick={() => setShowDbPopup(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
            </div>
          </Card>
        </div>
      )}

      {showCTA && (
        <div className="sticky top-0 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg flex-shrink-0">
                <Rocket className="w-4 sm:w-5 h-4 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-base font-bold truncate">
                  {dbAdded ? (
                    <span>
                      <span className="text-yellow-300">327만 잠재 고객</span> 준비 완료!
                    </span>
                  ) : (
                    <span>
                      <span className="text-yellow-300">327만 잠재 고객</span>에게 영업 시작
                    </span>
                  )}
                </p>
                <p className="text-[10px] sm:text-xs text-blue-100 hidden sm:block">
                  지금 활성화하면 48시간 내 첫 리드를 받아보실 수 있어요
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                onClick={onNext}
                size="sm"
                className="bg-yellow-400 text-blue-900 hover:bg-yellow-300 font-bold whitespace-nowrap px-3 sm:px-6 text-xs sm:text-sm h-8 sm:h-10 shadow-lg"
              >
                <Zap className="w-3 sm:w-4 h-3 sm:h-4 mr-1" />
                <span className="hidden sm:inline">지금 바로 시작하기</span>
                <span className="sm:hidden">시작</span>
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
        <div className="text-center space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-full text-xs sm:text-sm font-bold shadow-md">
            <Bot className="w-3 sm:w-4 h-3 sm:h-4" />
            AI 분석 완료
            <CheckCircle2 className="w-3 sm:w-4 h-3 sm:h-4" />
          </div>
          <h1 className="text-xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            <span className="text-blue-600">{data.companyName || "고객사"}님께 딱 맞는</span>
            <br />
            <span className="whitespace-nowrap">3개 시장을 찾았어요!</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto">
            RINDA가 전 세계 데이터를 분석하여 귀사에게 가장 적합한 시장을 선정했습니다
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {markets.map((market, index) => (
            <Card
              key={market.country}
              className="p-4 sm:p-5 hover:shadow-xl transition-all border-2 border-gray-200 hover:border-blue-500 bg-white relative overflow-hidden cursor-pointer"
              onClick={() => setSelectedMarket(market)}
            >
              {index === 0 && (
                <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 px-2 sm:px-3 py-0.5 sm:py-1 rounded-bl-lg font-bold text-[10px] sm:text-xs">
                  BEST
                </div>
              )}

              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-3xl sm:text-4xl">{market.flag}</div>
                  <div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <h3 className="text-lg sm:text-xl font-bold text-gray-900">{market.country}</h3>
                      <Badge className="bg-blue-600 text-white text-[10px] sm:text-xs">#{index + 1}</Badge>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-blue-600">{market.marketSize}</div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] sm:text-xs mb-1">
                    <span className="text-gray-600">적합도</span>
                    <span className="font-bold text-blue-600">{market.score}점</span>
                  </div>
                  <div className="h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${market.score}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg text-center">
                    <div className="text-[10px] sm:text-xs text-gray-600">잠재 고객</div>
                    <div className="text-[10px] sm:text-xs font-bold text-blue-600">{market.companyCount}</div>
                  </div>
                  <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg text-center">
                    <div className="text-[10px] sm:text-xs text-gray-600">진입 기간</div>
                    <div className="text-[10px] sm:text-xs font-bold text-blue-600">{market.entryTime}</div>
                  </div>
                </div>

                <div className="space-y-1 sm:space-y-1.5">
                  {market.highlights.map((h) => (
                    <div key={h} className="flex items-start gap-1.5 sm:gap-2">
                      <CheckCircle2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="text-[10px] sm:text-xs text-gray-700">{h}</span>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-blue-600 border-blue-300 hover:bg-blue-50 text-[10px] sm:text-xs bg-transparent h-8 sm:h-9"
                >
                  상세 보기
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-blue-600 rounded-xl flex-shrink-0 shadow-md">
              <Globe className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
            </div>
            <div className="flex-1 space-y-2 sm:space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">귀사 맞춤 글로벌 진출 전략</h2>
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                RINDA가 분석한 결과, <span className="text-blue-600 font-bold">유럽과 아시아태평양 시장</span>에서 큰
                기회를 발견했어요. 독일 157만 제조기업, 영국 142만 테크기업, 싱가포르 28만 기업이 귀사의 이상적인
                타겟이에요. 총 <span className="text-blue-600 font-bold">327만 잠재 고객</span>에게 RINDA가 자동으로
                맞춤 영업을 진행해드립니다.
              </p>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-700 bg-white px-3 sm:px-4 py-2 rounded-lg border border-blue-200">
                <Sparkles className="w-3 sm:w-4 h-3 sm:h-4" />
                <span className="font-medium">48시간 내 첫 검증된 리드를 받아보실 수 있어요</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 bg-white border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-600 rounded-lg flex-shrink-0">
              <Zap className="w-4 sm:w-5 h-4 sm:h-5 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3">해외진출 준비 체크리스트</h2>
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                {[
                  "영문 회사 소개서",
                  "영문 계약서 템플릿",
                  "제품 데모 자료",
                  "레퍼런스 고객 사례",
                  "현지 결제 시스템",
                  "다국어 고객지원",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-white rounded-lg border border-gray-200"
                  >
                    <CheckCircle2 className="w-3 sm:w-4 h-3 sm:h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-[10px] sm:text-xs font-medium text-gray-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-center pt-2 sm:pt-4">
          <Button
            onClick={onNext}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 sm:px-10 py-5 sm:py-7 text-sm sm:text-lg shadow-xl hover:shadow-2xl transition-all"
          >
            <Zap className="w-4 sm:w-5 h-4 sm:h-5 mr-2" />
            지금 바로 캠페인 활성화하기
            <ArrowRight className="w-4 sm:w-5 h-4 sm:h-5 ml-2" />
          </Button>
        </div>
      </div>

      {selectedMarket && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedMarket(null)} />
          <div className="relative w-full sm:max-w-lg bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">{selectedMarket.flag}</span>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">{selectedMarket.country} 시장</h2>
                  <p className="text-xs sm:text-sm text-gray-600">{selectedMarket.marketSize}</p>
                </div>
              </div>
              <button onClick={() => setSelectedMarket(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 sm:space-y-5">
              <Card className="p-3 sm:p-4 bg-blue-50 border-blue-200">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Bot className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-blue-600 mb-1">RINDA 인사이트</p>
                    <p className="text-xs sm:text-sm text-gray-700">{selectedMarket.aiInsight}</p>
                  </div>
                </div>
              </Card>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Users className="w-4 h-4 text-blue-600" />
                  RINDA Agent가 자동으로 진행하는 일
                </h3>
                <div className="space-y-1.5 sm:space-y-2">
                  {[
                    { step: "1", title: "잠재 고객 발굴", desc: "AI가 타겟 기업의 의사결정권자를 자동으로 찾아요" },
                    { step: "2", title: "맞춤 이메일 발송", desc: "각 기업에 개인화된 영업 메일을 자동 발송해요" },
                    { step: "3", title: "응답 관리", desc: "관심있는 고객의 응답을 분석하고 후속 조치해요" },
                    { step: "4", title: "미팅 조율", desc: "구매 의향이 높은 고객과 미팅을 자동 세팅해요" },
                  ].map((item) => (
                    <div key={item.step} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg">
                      <div className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-blue-600 text-white text-[10px] sm:text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <p className="font-medium text-xs sm:text-sm text-gray-900">{item.title}</p>
                        <p className="text-[10px] sm:text-xs text-gray-600">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={onNext}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 sm:py-5 text-sm sm:text-base"
              >
                {selectedMarket.country} 시장 캠페인 시작하기
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
