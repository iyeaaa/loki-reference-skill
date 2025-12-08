/**
 * ChatRoom Component (Optimized)
 * - Jotai 기반 메시지 상태 (레이아웃 전환 시에도 유지)
 * - TanStack Query mutation 사용
 * - 스트리밍 메시지 분리
 */

import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { ArrowRight, Check, Globe, Lightbulb, Loader2, SlidersHorizontal } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import TextPlus from "@/assets/text-plus.svg"
import TextRinda from "@/assets/text-rinda.svg"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  type LeadDiscoveryEventData,
  useLeadDiscoveryMutation,
  useLeadDiscoverySelectMutation,
} from "@/lib/api/hooks/lead-discovery"
import type { BigQueryResult, BuyerRecommendation } from "@/lib/api/types/lead-discovery"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { BuyerRecommendationCards } from "./components/BuyerRecommendationCards"
import { LeadDiscoveryProgress } from "./components/LeadDiscoveryProgress"
import {
  addChatMessageAtom,
  addCustomersAtom,
  type ChatMessage,
  type Customer,
  chatMessagesAtom,
  initialStreamingState,
  streamingStateAtom,
  updateChatMessageAtom,
} from "./store"

type SearchMode = "website" | "detailed"

export function ChatRoom() {
  // ============================================
  // Jotai 상태 사용 (LeadDiscoveryPage와 동기화)
  // ============================================
  const messages = useAtomValue(chatMessagesAtom)
  const addMessageToStore = useSetAtom(addChatMessageAtom)
  const updateMessageInStore = useSetAtom(updateChatMessageAtom)

  const addMessage = useCallback(
    (message: ChatMessage) => {
      console.log("[ChatRoom] addMessage called:", message.id)
      addMessageToStore(message)
    },
    [addMessageToStore],
  )

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      updateMessageInStore(messageId, updates)
    },
    [updateMessageInStore],
  )

  // Jotai 고객 상태
  const addCustomers = useSetAtom(addCustomersAtom)

  // Jotai 스트리밍 상태 (리마운트 시에도 유지)
  const [streamingState, setStreamingState] = useAtom(streamingStateAtom)
  const [input, setInput] = useState("")
  const [searchMode, setSearchMode] = useState<SearchMode>("website")
  const [websiteTooltipOpen, setWebsiteTooltipOpen] = useState(false)
  const [detailedTooltipOpen, setDetailedTooltipOpen] = useState(false)
  const [animatingCard, setAnimatingCard] = useState<string | null>(null)
  const [cardAnimationDistance, setCardAnimationDistance] = useState<number>(0)

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // 워크스페이스
  const { selectedWorkspace } = useWorkspace()

  // BigQuery 결과를 Customer 형식으로 변환
  const convertResultsToCustomers = useCallback((results: BigQueryResult[]): Customer[] => {
    return results.map((r, idx) => ({
      id: `lead-${Date.now()}-${idx}`,
      first_name: r.firstName,
      middle_name: r.middleName,
      last_name: r.lastName,
      title: r.title,
      company_name: r.companyName,
      email: r.email,
      phone: r.phone,
      web_address: r.webAddress,
      mailing_address: r.mailingAddress,
      primary_city: r.primaryCity || r.city,
      primary_state: r.primaryState,
      zip_code: r.zipCode,
      country: r.country,
      industry: r.industry,
      sub_industry: r.subIndustry,
      employee: r.employee,
      revenue: r.revenue,
      source: "Lead Discovery",
      createdAt: new Date(),
    }))
  }, [])

  // ============================================
  // TanStack Query Mutations (콜백 기반)
  // ============================================
  const searchMutation = useLeadDiscoveryMutation({
    onStatusChange: (data: LeadDiscoveryEventData) => {
      setStreamingState((prev) => ({
        ...prev,
        status: data.status,
        message: data.message,
        progress: data.progress,
        mode: data.mode,
        recommendations: data.recommendations || prev.recommendations,
        sessionId: data.sessionId || prev.sessionId,
        analyzedPages: data.analyzedPages || prev.analyzedPages,
        siteFavicon: data.siteFavicon || prev.siteFavicon,
        analysisSummary: data.analysisSummary || prev.analysisSummary,
        customerAnalysisSummary: data.customerAnalysisSummary || prev.customerAnalysisSummary,
      }))
    },
    onRecommendations: (recommendations, sessionId) => {
      setStreamingState((prev) => ({
        ...prev,
        recommendations,
        sessionId,
      }))
    },
    onResults: (results, totalCount) => {
      console.log("[ChatRoom] Lead discovery results:", totalCount)
      const customers = convertResultsToCustomers(results)
      addCustomers(customers)
    },
    onComplete: (data) => {
      // 스트리밍 메시지를 완료된 메시지로 변환
      const recInfo = data.selectedRecommendation
        ? `**선택한 타겟**: ${data.selectedRecommendation.country} / ${data.selectedRecommendation.industry}\n\n`
        : ""

      setStreamingState((prev) => {
        if (prev.messageId) {
          updateMessage(prev.messageId, {
            content: `${recInfo}**${data.totalCount}개 리드**를 탐색했습니다.\n\n오른쪽 테이블에서 결과를 확인하세요.`,
          })
        }
        return initialStreamingState
      })
    },
    onError: (error) => {
      console.error("[ChatRoom] Lead discovery error:", error)
      setStreamingState((prev) => {
        if (prev.messageId) {
          updateMessage(prev.messageId, {
            content: `오류가 발생했습니다: ${error}`,
          })
        }
        return initialStreamingState
      })
    },
  })

  const selectMutation = useLeadDiscoverySelectMutation({
    onStatusChange: (data: LeadDiscoveryEventData) => {
      setStreamingState((prev) => ({
        ...prev,
        status: data.status,
        message: data.message,
        progress: data.progress,
        mode: data.mode,
        customerAnalysisSummary: data.customerAnalysisSummary || prev.customerAnalysisSummary,
      }))
    },
    onResults: (results, totalCount) => {
      console.log("[ChatRoom] Selection results:", totalCount)
      const customers = convertResultsToCustomers(results)
      addCustomers(customers)
    },
    onComplete: (data) => {
      const recInfo = data.selectedRecommendation
        ? `**선택한 타겟**: ${data.selectedRecommendation.country} / ${data.selectedRecommendation.industry}\n\n`
        : ""

      setStreamingState((prev) => {
        if (prev.messageId) {
          updateMessage(prev.messageId, {
            content: `${recInfo}**${data.totalCount}개 리드**를 탐색했습니다.\n\n오른쪽 테이블에서 결과를 확인하세요.`,
          })
        }
        return initialStreamingState
      })
    },
    onError: (error) => {
      console.error("[ChatRoom] Selection error:", error)
      setStreamingState((prev) => {
        if (prev.messageId) {
          updateMessage(prev.messageId, {
            content: `오류가 발생했습니다: ${error}`,
          })
        }
        return initialStreamingState
      })
    },
  })

  // 파생 상태
  const isSearching = searchMutation.isPending || selectMutation.isPending
  const isWaitingSelection = streamingState.status === "waiting_selection"

  // Markdown components for consistent styling
  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mb-4 leading-relaxed last:mb-0">{children}</p>
      ),
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0">{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="mb-3 mt-5 text-xl font-bold first:mt-0">{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
      ),
      ul: ({ children }: { children?: React.ReactNode }) => (
        <ul className="mb-4 ml-6 list-disc space-y-1">{children}</ul>
      ),
      ol: ({ children }: { children?: React.ReactNode }) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1">{children}</ol>
      ),
      li: ({ children }: { children?: React.ReactNode }) => (
        <li className="leading-relaxed">{children}</li>
      ),
      code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
        const isInline = !className
        return isInline ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">{children}</code>
        ) : (
          <code className="font-mono text-sm">{children}</code>
        )
      },
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-3">{children}</pre>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="mb-4 border-l-4 border-border pl-4 italic text-muted-foreground">
          {children}
        </blockquote>
      ),
      a: (
        props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode },
      ) => (
        <a
          {...props}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          {props.children}
        </a>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-bold">{children}</strong>
      ),
    }),
    [],
  )

  // 산업별 카드 데이터 (2025년 12월 기준 바이어 탐색 수요가 많은 순서)
  const industryTemplates = useMemo(
    () => ({
      all: "전체 템플릿",
      "ev-battery": "전기차/배터리",
      semiconductor: "반도체/전자",
      "bio-healthcare": "바이오/헬스케어",
      "eco-energy": "친환경/에너지",
      "food-consumer": "식품/소비재",
      manufacturing: "제조/기계",
      beauty: "뷰티/화장품",
    }),
    [],
  )

  const cardExamples = useMemo(
    () => ({
      "ev-battery": [
        {
          title: "전기차 배터리 유럽 진출",
          description: "EV 배터리셀/팩을 유럽 완성차 업체에 납품",
          query: "전기차 배터리 유럽 완성차 업체 납품",
        },
        {
          title: "배터리 소재 북미 공급",
          description: "리튬/니켈/코발트 등 양극재 소재 미국 배터리 제조사 공급",
          query: "배터리 양극재 소재 미국 제조사 공급",
        },
        {
          title: "배터리 관리 시스템(BMS) 중국 진출",
          description: "차량용 BMS를 중국 전기차 제조사에 납품",
          query: "BMS 배터리 관리 시스템 중국 전기차 납품",
        },
        {
          title: "전기차 충전 인프라 동남아",
          description: "급속 충전기를 동남아 충전소 운영사에 공급",
          query: "전기차 급속 충전기 동남아 충전소 공급",
        },
        {
          title: "배터리 재활용 솔루션 유럽",
          description: "폐배터리 리사이클링 기술을 유럽 재활용 업체에 제안",
          query: "배터리 재활용 기술 유럽 리사이클링 업체",
        },
        {
          title: "전고체 배터리 소재 일본",
          description: "차세대 전고체 배터리 소재를 일본 연구기관/제조사 공급",
          query: "전고체 배터리 소재 일본 연구소 납품",
        },
      ],
      semiconductor: [
        {
          title: "반도체 제조 장비 대만 진출",
          description: "식각/증착 장비를 대만 파운드리에 납품",
          query: "반도체 제조 장비 대만 파운드리 납품",
        },
        {
          title: "반도체 소재 한국 공급",
          description: "포토레지스트/CMP 슬러리를 한국 반도체 제조사 공급",
          query: "반도체 소재 포토레지스트 한국 제조사 공급",
        },
        {
          title: "디스플레이 장비 중국 진출",
          description: "OLED 제조 장비를 중국 디스플레이 공장에 납품",
          query: "OLED 디스플레이 장비 중국 공장 납품",
        },
        {
          title: "반도체 테스트 장비 미국",
          description: "웨이퍼 검사 장비를 미국 반도체 회사에 공급",
          query: "반도체 테스트 검사 장비 미국 공급",
        },
        {
          title: "AI 칩 설계 IP 유럽",
          description: "AI/ML 반도체 IP를 유럽 팹리스에 라이선싱",
          query: "AI 반도체 IP 유럽 팹리스 라이선싱",
        },
        {
          title: "반도체 패키징 장비 베트남",
          description: "후공정 패키징 장비를 베트남 OSAT 업체에 납품",
          query: "반도체 패키징 장비 베트남 OSAT 납품",
        },
      ],
      "bio-healthcare": [
        {
          title: "바이오 의약품 미국 FDA 진출",
          description: "바이오 신약 원료를 미국 제약사에 공급",
          query: "바이오 의약품 원료 미국 제약사 FDA 납품",
        },
        {
          title: "의료기기 유럽 CE 인증",
          description: "진단기기를 유럽 병원/클리닉에 판매",
          query: "의료 진단기기 유럽 병원 CE인증 판매",
        },
        {
          title: "헬스케어 웨어러블 일본",
          description: "스마트 헬스케어 디바이스를 일본 유통사에 공급",
          query: "헬스케어 웨어러블 디바이스 일본 유통사",
        },
        {
          title: "유전자 분석 서비스 중동",
          description: "NGS 유전체 분석 솔루션을 중동 병원에 제공",
          query: "유전자 분석 NGS 솔루션 중동 병원",
        },
        {
          title: "의료용 AI 진단 동남아",
          description: "AI 영상진단 소프트웨어를 동남아 의료기관에 판매",
          query: "AI 의료 영상진단 소프트웨어 동남아 병원",
        },
        {
          title: "재생의료 바이오소재 미국",
          description: "줄기세포/조직공학 소재를 미국 연구기관 공급",
          query: "재생의료 줄기세포 소재 미국 연구기관",
        },
      ],
      "eco-energy": [
        {
          title: "태양광 모듈 유럽 진출",
          description: "고효율 태양광 패널을 유럽 설치업체에 공급",
          query: "태양광 모듈 패널 유럽 설치업체 공급",
        },
        {
          title: "풍력 터빈 부품 북미",
          description: "풍력발전 터빈 부품을 미국/캐나다 발전사에 납품",
          query: "풍력 터빈 부품 북미 발전사 납품",
        },
        {
          title: "ESS 에너지 저장 호주",
          description: "대용량 에너지 저장 시스템을 호주 전력 기업에 공급",
          query: "ESS 에너지 저장 시스템 호주 전력 기업",
        },
        {
          title: "수소 연료전지 일본",
          description: "수소 발전/모빌리티용 연료전지를 일본 에너지 기업 납품",
          query: "수소 연료전지 발전 일본 에너지 기업",
        },
        {
          title: "친환경 패키징 유럽",
          description: "생분해성 포장재를 유럽 식품/유통 기업에 공급",
          query: "친환경 생분해성 패키징 유럽 식품 기업",
        },
        {
          title: "탄소 포집 기술 중동",
          description: "CCUS 탄소 포집 설비를 중동 석유/화학 기업에 제안",
          query: "탄소 포집 CCUS 설비 중동 석유 화학",
        },
      ],
      "food-consumer": [
        {
          title: "K-뷰티 화장품 중동",
          description: "스킨케어/색조 화장품을 중동 유통사에 공급",
          query: "K-뷰티 화장품 스킨케어 중동 유통사",
        },
        {
          title: "프리미엄 식품 미국",
          description: "K-푸드(김치/고추장 등)를 미국 식품 유통망 진출",
          query: "한국 프리미엄 식품 김치 미국 유통망",
        },
        {
          title: "건강기능식품 일본",
          description: "홍삼/프로바이오틱스를 일본 건강식품 시장 진출",
          query: "건강기능식품 홍삼 프로바이오틱스 일본",
        },
        {
          title: "비건 식품 유럽",
          description: "식물성 대체육/유제품을 유럽 비건 시장 공급",
          query: "비건 대체육 식물성 식품 유럽 시장",
        },
        {
          title: "스낵/과자 동남아",
          description: "K-스낵(과자/라면 등)을 동남아 편의점 유통망 진출",
          query: "한국 과자 라면 스낵 동남아 편의점",
        },
        {
          title: "음료/베버리지 중국",
          description: "기능성 음료를 중국 유통 채널에 공급",
          query: "기능성 음료 베버리지 중국 유통 채널",
        },
      ],
      manufacturing: [
        {
          title: "산업용 로봇 독일 진출",
          description: "협동로봇/자동화 솔루션을 독일 제조사에 납품",
          query: "산업용 협동로봇 자동화 독일 제조사",
        },
        {
          title: "스마트 공장 솔루션 베트남",
          description: "IoT/MES 스마트팩토리 시스템을 베트남 공장에 구축",
          query: "스마트팩토리 IoT MES 베트남 공장",
        },
        {
          title: "정밀 금형 일본",
          description: "고정밀 프레스/사출 금형을 일본 자동차 부품사 공급",
          query: "정밀 금형 프레스 사출 일본 자동차",
        },
        {
          title: "3D 프린팅 장비 미국",
          description: "산업용 3D 프린터를 미국 제조/항공 업체에 판매",
          query: "산업용 3D 프린터 미국 제조 항공",
        },
        {
          title: "레이저 가공 장비 중국",
          description: "레이저 절단/용접 장비를 중국 금속 가공 업체에 납품",
          query: "레이저 절단 용접 장비 중국 금속 가공",
        },
        {
          title: "자동화 컨베이어 인도",
          description: "물류 자동화 컨베이어 시스템을 인도 물류센터에 구축",
          query: "자동화 컨베이어 물류 시스템 인도 물류센터",
        },
      ],
      beauty: [
        {
          title: "K-뷰티 스킨케어 미국",
          description: "세럼/마스크팩 등을 미국 뷰티 리테일러에 공급",
          query: "K-뷰티 스킨케어 세럼 마스크팩 미국 리테일",
        },
        {
          title: "더마 코스메틱 유럽",
          description: "피부과 전문 화장품을 유럽 약국 채널 진출",
          query: "더마 코스메틱 피부과 화장품 유럽 약국",
        },
        {
          title: "헤어케어 제품 동남아",
          description: "샴푸/트리트먼트를 동남아 뷰티 유통사 공급",
          query: "헤어케어 샴푸 트리트먼트 동남아 유통",
        },
        {
          title: "남성 그루밍 일본",
          description: "남성 스킨케어/그루밍 제품을 일본 시장 진출",
          query: "남성 그루밍 스킨케어 제품 일본 시장",
        },
        {
          title: "클린뷰티 호주",
          description: "천연/비건 화장품을 호주 클린뷰티 매장 공급",
          query: "클린뷰티 천연 비건 화장품 호주 매장",
        },
        {
          title: "색조 화장품 중동",
          description: "립스틱/아이섀도 등을 중동 백화점/면세점 진출",
          query: "색조 화장품 립스틱 아이섀도 중동 백화점",
        },
      ],
    }),
    [],
  )

  // 스크롤 맨 아래로 - 메시지 추가시 자동 스크롤
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, streamingState.status, scrollToBottom])

  // 웹사이트 URL 유효성 검사
  const isValidWebsiteUrl = useCallback((url: string): boolean => {
    const trimmed = url.trim().toLowerCase()
    // URL 패턴: 도메인 형식 검사 (http(s):// 없어도 허용)
    const urlPattern =
      /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{2,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/
    return urlPattern.test(trimmed)
  }, [])

  // 입력값 유효성 검사
  const isInputValid = useCallback((): boolean => {
    const trimmed = input.trim()
    if (!trimmed) return false
    if (searchMode === "website") {
      return isValidWebsiteUrl(trimmed)
    }
    // 상세 조건 모드: 최소 2자 이상
    return trimmed.length >= 2
  }, [input, searchMode, isValidWebsiteUrl])

  // 카드 클릭 핸들러 (최적화)
  const handleCardClick = useCallback(
    (query: string, cardIndex: number) => {
      const cardElement = cardRefs.current.get(query)
      const inputElement = inputRef.current

      if (cardElement && inputElement) {
        // DOM 측정을 한 번만 수행
        const cardRect = cardElement.getBoundingClientRect()
        const inputRect = inputElement.getBoundingClientRect()

        // 거리 계산 최적화 (변수 재사용)
        const baseDistance = cardRect.bottom - inputRect.top
        const rowIndex = (cardIndex / 3) >> 0 // Math.floor 대신 비트 연산자 사용 (더 빠름)

        // 한 번의 계산으로 최종 거리 도출
        setCardAnimationDistance(baseDistance * 1.3 + 200 + rowIndex * 200)
      }

      // 상태 업데이트를 배치로 처리
      setInput("")
      setAnimatingCard(query)

      // 타이머 최적화
      setTimeout(() => {
        setSearchMode("detailed")
        setInput(query)
        inputRef.current?.focus()
      }, 400)
    },
    [], // setSearchMode는 안정적인 함수이므로 의존성 제거
  )

  // 입력값이 변경되면 애니메이션 상태 초기화
  useEffect(() => {
    if (input && animatingCard && input !== animatingCard) {
      setAnimatingCard(null)
    }
  }, [input, animatingCard])

  // 모드 전환 시 입력값 초기화 (상세 -> 웹사이트 모드)
  const prevSearchModeRef = useRef<SearchMode>(searchMode)
  useEffect(() => {
    // 실제로 모드가 변경되었을 때만 초기화
    const modeChanged = prevSearchModeRef.current !== searchMode
    if (modeChanged && searchMode === "website" && input && !isValidWebsiteUrl(input)) {
      setInput("")
      setAnimatingCard(null)
    }
    prevSearchModeRef.current = searchMode
  }, [searchMode, input, isValidWebsiteUrl])

  // 바이어 추천 선택 핸들러
  const handleRecommendationSelect = useCallback(
    async (rec: BuyerRecommendation) => {
      if (!selectedWorkspace?.id || selectedWorkspace.id === "all") return
      if (!streamingState.sessionId) {
        console.error("[ChatRoom] No session ID for selection")
        return
      }

      // 선택 메시지 추가
      const selectMessage: ChatMessage = {
        id: `msg-${Date.now()}-select`,
        role: "user",
        content: `${rec.country} / ${rec.industry} 선택`,
        timestamp: new Date(),
      }
      addMessage(selectMessage)

      // 새 응답 메시지 추가
      const responseId = `msg-${Date.now()}-response`
      const responseMessage: ChatMessage = {
        id: responseId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }
      addMessage(responseMessage)

      // 스트리밍 상태 업데이트 - 기존 데이터 유지하면서 선택 상태만 변경
      setStreamingState((prev) => ({
        ...prev,
        messageId: responseId,
        status: "searching",
        message: "선택한 타겟으로 검색 중...",
        progress: 65,
        selectedRecommendationId: rec.id, // 선택된 추천 ID 저장 (카드 유지)
        // recommendations, analysisSummary, analyzedPages 유지
      }))

      // 선택 API 호출
      selectMutation.mutate({
        sessionId: streamingState.sessionId,
        selectedRecommendationId: rec.id,
        workspaceId: selectedWorkspace.id,
      })
    },
    [selectedWorkspace, streamingState.sessionId, addMessage, selectMutation, setStreamingState],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      console.log("[ChatRoom] handleSubmit called", { input, isSearching, isValid: isInputValid() })

      if (!isInputValid() || isSearching) {
        console.log("[ChatRoom] Submit blocked", { isInputValid: isInputValid(), isSearching })
        return
      }

      const userInput = input.trim()
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: userInput,
        timestamp: new Date(),
      }

      console.log("[ChatRoom] Adding user message:", userMessage.id)
      addMessage(userMessage)
      setInput("")
      setAnimatingCard(null)

      // 워크스페이스 확인
      if (!selectedWorkspace?.id || selectedWorkspace.id === "all") {
        console.log("[ChatRoom] No workspace selected")
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content:
            "워크스페이스를 먼저 선택해주세요.\n\n상단에서 워크스페이스를 선택하면 바로 시작할 수 있어요.",
          timestamp: new Date(),
        }
        addMessage(errorMessage)
        return
      }

      console.log("[ChatRoom] Calling searchMutation", {
        query: userInput,
        workspaceId: selectedWorkspace.id,
      })

      // 빈 assistant 메시지 먼저 추가 (스트리밍용)
      const assistantMessageId = `msg-${Date.now()}-response`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      }
      addMessage(assistantMessage)

      // 스트리밍 상태 초기화
      setStreamingState({
        messageId: assistantMessageId,
        status: "connecting",
        message: "서버에 연결 중...",
        progress: 0,
        recommendations: [],
        analyzedPages: [],
        analysisSummary: "",
        customerAnalysisSummary: "",
      })

      // LangGraph API 호출
      searchMutation.mutate({
        query: userInput,
        workspaceId: selectedWorkspace.id,
      })
    },
    [
      input,
      isSearching,
      isInputValid,
      selectedWorkspace,
      addMessage,
      searchMutation,
      setStreamingState,
    ],
  )

  return (
    <>
      <style>
        {`
          @keyframes fly-to-input {
            0% {
              transform: scale(1) translateY(0);
              opacity: 1;
            }
            50% {
              transform: scale(0.5) translateY(calc(var(--distance) * -0.5));
              opacity: 0.5;
            }
            100% {
              transform: scale(0.1) translateY(calc(var(--distance) * -1));
              opacity: 0;
            }
          }
        `}
      </style>
      <div className="flex flex-col h-full min-h-0 bg-background border-r border-border">
        {/* 메시지 영역 - flex-1 + min-h-0으로 스크롤 영역 확보 */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* 메시지가 없고 검색 중이 아닐 때 → 템플릿 카드 표시 */}
          {messages.length === 0 && !isSearching ? (
            <div className="h-full flex items-center justify-center px-4 py-8">
              {/* 전체 콘텐츠를 하나로 묶어서 중앙 정렬 */}
              <div className="w-full space-y-8" style={{ maxWidth: "670px" }}>
                {/* 로고 */}
                <div className="flex justify-center items-center gap-2">
                  <img src={TextRinda} alt="RINDA" className="h-10 w-auto" />
                  <img src={TextPlus} alt="Plus" className="h-10 w-auto" />
                </div>

                {/* 카피라이팅 */}
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-foreground/90">
                    우리 회사 웹사이트 주소만 입력하세요
                  </p>
                  <p className="text-base text-muted-foreground leading-relaxed">
                    AI가 우리 제품에 관심 있을 바이어를 찾아드려요
                  </p>
                </div>

                {/* 입력 영역 */}
                <div className="w-full">
                  <form onSubmit={handleSubmit} className="space-y-2">
                    <div className="rounded-2xl bg-background border overflow-hidden">
                      {/* 1행: Textarea */}
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit(e)
                          }
                        }}
                        placeholder={
                          searchMode === "website"
                            ? "https://www.example.com"
                            : "예: 친환경 화장품 제조, 미국 캘리포니아 진출 희망"
                        }
                        disabled={isSearching}
                        rows={3}
                        className="w-full min-h-[72px] resize-none bg-transparent text-base px-3 pt-3 pb-0 border-0 outline-none focus:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      />

                      {/* 2행: 버튼들 */}
                      <div className="flex items-center justify-between px-3 pb-3 pt-2">
                        {/* 좌측: 2개의 모드 선택 버튼 */}
                        <div className="flex items-center gap-0.5">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip open={websiteTooltipOpen} onOpenChange={setWebsiteTooltipOpen}>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant={searchMode === "website" ? "default" : "ghost"}
                                  size="icon"
                                  onClick={() => {
                                    if (searchMode !== "website") {
                                      setSearchMode("website")
                                    }
                                    setWebsiteTooltipOpen(true)
                                  }}
                                  onMouseEnter={() => setWebsiteTooltipOpen(true)}
                                  onMouseLeave={() => setWebsiteTooltipOpen(false)}
                                  className={cn(
                                    "h-8 w-8 rounded-lg",
                                    searchMode !== "website" &&
                                      "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <Globe className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="px-4 py-3 max-w-[300px] bg-white dark:bg-gray-800 text-foreground border border-border shadow-lg"
                                onMouseEnter={() => setWebsiteTooltipOpen(true)}
                                onMouseLeave={() => setWebsiteTooltipOpen(false)}
                              >
                                <div className="font-semibold text-base">웹사이트로 시작하기</div>
                                <div className="text-xs opacity-70 mt-1 mb-2">
                                  우리 회사 웹사이트 주소만 있으면 돼요
                                </div>
                                <Separator className="my-2" />
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 text-sm font-medium">
                                    기본 모드
                                    {searchMode === "website" && <Check className="h-3.5 w-3.5" />}
                                  </div>
                                  <div className="text-xs opacity-70 leading-relaxed">
                                    우리 비즈니스를 분석해서 최적의 바이어를 찾아요
                                  </div>
                                  <div className="text-xs opacity-70 leading-relaxed">
                                    가장 빠르고 간편해요
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider delayDuration={200}>
                            <Tooltip
                              open={detailedTooltipOpen}
                              onOpenChange={setDetailedTooltipOpen}
                            >
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant={searchMode === "detailed" ? "default" : "ghost"}
                                  size="icon"
                                  onClick={() => {
                                    if (searchMode !== "detailed") {
                                      setSearchMode("detailed")
                                    }
                                    setDetailedTooltipOpen(true)
                                  }}
                                  onMouseEnter={() => setDetailedTooltipOpen(true)}
                                  onMouseLeave={() => setDetailedTooltipOpen(false)}
                                  className={cn(
                                    "h-8 w-8 rounded-lg",
                                    searchMode !== "detailed" &&
                                      "text-muted-foreground hover:text-foreground",
                                  )}
                                >
                                  <SlidersHorizontal className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                className="px-4 py-3 max-w-[300px] bg-white dark:bg-gray-800 text-foreground border border-border shadow-lg"
                                onMouseEnter={() => setDetailedTooltipOpen(true)}
                                onMouseLeave={() => setDetailedTooltipOpen(false)}
                              >
                                <div className="font-semibold text-base">원하는 조건으로 찾기</div>
                                <div className="text-xs opacity-70 mt-1 mb-2">
                                  업종, 지역, 규모 등을 직접 정해요
                                </div>
                                <Separator className="my-2" />
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 text-sm font-medium">
                                    고급 모드
                                    {searchMode === "detailed" && <Check className="h-3.5 w-3.5" />}
                                  </div>
                                  <div className="text-xs opacity-70 leading-relaxed">
                                    필요한 조건을 하나씩 설정할 수 있어요
                                  </div>
                                  <div className="text-xs opacity-70 leading-relaxed">
                                    더 정확한 타겟팅이 가능해요
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        {/* 우측: 제출 버튼 */}
                        <Button
                          type="submit"
                          size="icon"
                          disabled={isSearching || !isInputValid()}
                          className="h-8 w-8 rounded-full"
                        >
                          {isSearching ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* 유효성 에러 메시지 - 공간 항상 확보 */}
                    <div className="min-h-[22px] mt-1.5 px-1">
                      {searchMode === "website" && input.trim() && !isValidWebsiteUrl(input) && (
                        <div className="text-sm text-red-500 dark:text-red-400">
                          웹사이트 주소를 확인해주세요 (예: https://www.example.com)
                        </div>
                      )}
                    </div>
                  </form>
                </div>

                {/* 카드 섹션 */}
                <div className="w-full space-y-4">
                  {/* 빠른 시작 예시 제목 */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-center">
                      <Lightbulb className="h-5 w-5 text-amber-500" />
                      <p className="text-base font-semibold text-foreground">
                        웹사이트가 없으신가요?
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      아래 템플릿을 클릭하면 상세 조건으로 바로 검색할 수 있어요
                    </p>
                  </div>

                  {/* 산업별 탭 - 여러 줄로 표시 가능 */}
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="w-full justify-center flex-wrap h-auto p-1 bg-muted/50 gap-1">
                      {Object.entries(industryTemplates).map(([key, label]) => (
                        <TabsTrigger
                          key={key}
                          value={key}
                          className="whitespace-nowrap px-4 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {/* 카드 영역 - 스크롤 가능 */}
                    <div className="mt-4 overflow-y-auto" style={{ maxHeight: "280px" }}>
                      {/* 전체 템플릿 탭 */}
                      <TabsContent value="all" className="mt-0">
                        <div className="grid grid-cols-3 gap-3 pb-6">
                          {Object.values(cardExamples)
                            .flat()
                            .map((example, index) => (
                              <button
                                key={example.query}
                                ref={(el) => {
                                  if (el) {
                                    cardRefs.current.set(example.query, el)
                                  }
                                }}
                                type="button"
                                onClick={() => handleCardClick(example.query, index)}
                                className={cn(
                                  "group p-4 rounded-lg border border-border bg-background hover:border-primary hover:shadow-md transition-all text-left",
                                  animatingCard === example.query && "pointer-events-none",
                                  animatingCard === example.query &&
                                    input === example.query &&
                                    "!opacity-0",
                                )}
                                style={
                                  animatingCard === example.query && input !== example.query
                                    ? {
                                        animation: "fly-to-input 0.4s ease-in-out forwards",
                                        // @ts-expect-error
                                        "--distance": `${cardAnimationDistance}px`,
                                      }
                                    : undefined
                                }
                              >
                                <div className="font-semibold text-sm text-foreground mb-2 group-hover:text-primary transition-colors leading-snug">
                                  {example.title}
                                </div>
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                  {example.description}
                                </div>
                              </button>
                            ))}
                        </div>
                      </TabsContent>

                      {/* 산업별 탭 컨텐츠 */}
                      {Object.entries(cardExamples).map(([industry, examples]) => (
                        <TabsContent key={industry} value={industry} className="mt-0">
                          <div className="grid grid-cols-3 gap-3 pb-6">
                            {examples.map((example, index) => (
                              <button
                                key={example.query}
                                ref={(el) => {
                                  if (el) {
                                    cardRefs.current.set(example.query, el)
                                  }
                                }}
                                type="button"
                                onClick={() => handleCardClick(example.query, index)}
                                className={cn(
                                  "group p-4 rounded-lg border border-border bg-background hover:border-primary hover:shadow-md transition-all text-left",
                                  animatingCard === example.query && "pointer-events-none",
                                  animatingCard === example.query &&
                                    input === example.query &&
                                    "!opacity-0",
                                )}
                                style={
                                  animatingCard === example.query && input !== example.query
                                    ? {
                                        animation: "fly-to-input 0.4s ease-in-out forwards",
                                        // @ts-expect-error
                                        "--distance": `${cardAnimationDistance}px`,
                                      }
                                    : undefined
                                }
                              >
                                <div className="font-semibold text-sm text-foreground mb-2 group-hover:text-primary transition-colors leading-snug">
                                  {example.title}
                                </div>
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                  {example.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </TabsContent>
                      ))}
                    </div>
                  </Tabs>
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea
              className="h-full [&>[data-radix-scroll-area-viewport]]:!overflow-y-scroll"
              ref={scrollRef}
            >
              <div className="p-4 pt-6 space-y-4">
                {/* 검색 중이고 메시지가 없을 때만 상단에 progress 표시 (메시지가 있으면 메시지 내부에서 표시) */}
                {isSearching && messages.length === 0 && (
                  <div className="flex justify-start">
                    <div className="w-full space-y-4">
                      <LeadDiscoveryProgress
                        status={streamingState.status}
                        message={streamingState.message}
                        mode={streamingState.mode}
                        analyzedPages={streamingState.analyzedPages}
                        analysisSummary={streamingState.analysisSummary}
                        customerAnalysisSummary={streamingState.customerAnalysisSummary}
                        className="max-w-2xl"
                      />
                    </div>
                  </div>
                )}
                {messages
                  .filter((message) => {
                    // 빈 assistant 메시지는 스트리밍 메시지가 아닐 때만 필터링
                    if (
                      message.role === "assistant" &&
                      !message.content &&
                      message.id !== streamingState.messageId
                    ) {
                      return false
                    }
                    return true
                  })
                  .map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        message.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {message.role === "user" ? (
                        <div className="max-w-[85%] rounded-lg px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-foreground">
                          <p className="text-base whitespace-pre-wrap">{message.content}</p>
                        </div>
                      ) : (
                        <div className="w-full space-y-4">
                          {/* LangGraph 진행 상태 표시 - 스트리밍 중일 때만 */}
                          {message.id === streamingState.messageId &&
                            streamingState.status !== "idle" &&
                            streamingState.status !== "complete" &&
                            streamingState.status !== "waiting_selection" && (
                              <LeadDiscoveryProgress
                                status={streamingState.status}
                                message={streamingState.message}
                                mode={streamingState.mode}
                                analyzedPages={streamingState.analyzedPages}
                                analysisSummary={streamingState.analysisSummary}
                                customerAnalysisSummary={streamingState.customerAnalysisSummary}
                                className="max-w-2xl"
                              />
                            )}

                          {/* 바이어 추천 선택 UI - 선택 후에도 유지 */}
                          {message.id === streamingState.messageId &&
                            streamingState.recommendations.length > 0 &&
                            (isWaitingSelection || streamingState.selectedRecommendationId) && (
                              <BuyerRecommendationCards
                                recommendations={streamingState.recommendations}
                                onSelect={handleRecommendationSelect}
                                disabled={isSearching || !!streamingState.selectedRecommendationId}
                                selectedId={streamingState.selectedRecommendationId}
                                analysisSummary={streamingState.analysisSummary}
                                className="max-w-2xl"
                              />
                            )}

                          {/* 메시지 콘텐츠 */}
                          {message.content && (
                            <div className="prose prose-sm max-w-none dark:prose-invert text-base">
                              <ReactMarkdown components={markdownComponents}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}

                          {message.customersAdded && message.customersAdded.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/50">
                              <p className="text-sm opacity-70">
                                새로 추가된 고객{" "}
                                {message.customersAdded
                                  .map((c) => c.company_name || `${c.first_name} ${c.last_name}`)
                                  .join(", ")}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* 입력 영역 - 하단 고정 (메시지가 있거나 검색 중일 때 표시) */}
        {(messages.length > 0 || isSearching) && (
          <div className="shrink-0 p-3 border-t bg-background">
            <form onSubmit={handleSubmit} className="space-y-2">
              <div className="rounded-2xl bg-muted/50 border border-border/50 overflow-hidden">
                {/* 1행: Textarea */}
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit(e)
                    }
                  }}
                  placeholder={
                    searchMode === "website"
                      ? "https://www.example.com"
                      : "예: 친환경 화장품 제조, 미국 캘리포니아 진출 희망"
                  }
                  disabled={isSearching}
                  rows={3}
                  className="w-full min-h-[72px] resize-none bg-transparent text-base px-3 pt-3 pb-0 border-0 outline-none focus:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />

                {/* 2행: 버튼들 */}
                <div className="flex items-center justify-between px-3 pb-3 pt-2">
                  {/* 좌측: 2개의 모드 선택 버튼 */}
                  <div className="flex items-center gap-0.5">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip open={websiteTooltipOpen} onOpenChange={setWebsiteTooltipOpen}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={searchMode === "website" ? "default" : "ghost"}
                            size="icon"
                            onClick={() => {
                              if (searchMode !== "website") {
                                setSearchMode("website")
                              }
                              setWebsiteTooltipOpen(true)
                            }}
                            onMouseEnter={() => setWebsiteTooltipOpen(true)}
                            onMouseLeave={() => setWebsiteTooltipOpen(false)}
                            className={cn(
                              "h-8 w-8 rounded-lg",
                              searchMode !== "website" &&
                                "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="px-4 py-3 max-w-[300px] bg-white dark:bg-gray-800 text-foreground border border-border shadow-lg"
                          onMouseEnter={() => setWebsiteTooltipOpen(true)}
                          onMouseLeave={() => setWebsiteTooltipOpen(false)}
                        >
                          <div className="font-semibold text-base">웹사이트로 시작하기</div>
                          <div className="text-xs opacity-70 mt-1 mb-2">
                            우리 회사 웹사이트 주소만 있으면 돼요
                          </div>
                          <Separator className="my-2" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              기본 모드
                              {searchMode === "website" && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <div className="text-xs opacity-70 leading-relaxed">
                              우리 비즈니스를 분석해서 최적의 바이어를 찾아요
                            </div>
                            <div className="text-xs opacity-70 leading-relaxed">
                              가장 빠르고 간편해요
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider delayDuration={200}>
                      <Tooltip open={detailedTooltipOpen} onOpenChange={setDetailedTooltipOpen}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={searchMode === "detailed" ? "default" : "ghost"}
                            size="icon"
                            onClick={() => {
                              if (searchMode !== "detailed") {
                                setSearchMode("detailed")
                              }
                              setDetailedTooltipOpen(true)
                            }}
                            onMouseEnter={() => setDetailedTooltipOpen(true)}
                            onMouseLeave={() => setDetailedTooltipOpen(false)}
                            className={cn(
                              "h-8 w-8 rounded-lg",
                              searchMode !== "detailed" &&
                                "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="px-4 py-3 max-w-[300px] bg-white dark:bg-gray-800 text-foreground border border-border shadow-lg"
                          onMouseEnter={() => setDetailedTooltipOpen(true)}
                          onMouseLeave={() => setDetailedTooltipOpen(false)}
                        >
                          <div className="font-semibold text-base">원하는 조건으로 찾기</div>
                          <div className="text-xs opacity-70 mt-1 mb-2">
                            업종, 지역, 규모 등을 직접 정해요
                          </div>
                          <Separator className="my-2" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-sm font-medium">
                              고급 모드
                              {searchMode === "detailed" && <Check className="h-3.5 w-3.5" />}
                            </div>
                            <div className="text-xs opacity-70 leading-relaxed">
                              필요한 조건을 하나씩 설정할 수 있어요
                            </div>
                            <div className="text-xs opacity-70 leading-relaxed">
                              더 정확한 타겟팅이 가능해요
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* 우측: 제출 버튼 */}
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isSearching || !isInputValid()}
                    className="h-8 w-8 rounded-full"
                  >
                    {isSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* 유효성 에러 메시지 - 공간 항상 확보 */}
              <div className="min-h-[22px] mt-1.5 px-1">
                {searchMode === "website" && input.trim() && !isValidWebsiteUrl(input) && (
                  <div className="text-sm text-red-500 dark:text-red-400">
                    웹사이트 주소를 확인해주세요 (예: https://www.example.com)
                  </div>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  )
}
