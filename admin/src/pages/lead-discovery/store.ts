/**
 * Lead Discovery Store
 * - 크로스 컴포넌트 상태 및 레이아웃 전환 시 유지할 상태 관리
 * - 메시지 상태는 레이아웃 전환 시 리마운트되어도 유지되어야 함
 */

import { atom } from "jotai"

// BigQuery LeadResult 구조와 일치하는 Customer 인터페이스
export interface Customer {
  id: string
  first_name?: string
  middle_name?: string
  last_name?: string
  title?: string
  company_name?: string
  mailing_address?: string
  primary_city?: string
  primary_state?: string
  zip_code?: string
  country?: string
  phone?: string
  web_address?: string
  email?: string
  revenue?: string
  employee?: string
  industry?: string
  sub_industry?: string
  source: string
  createdAt: Date
  // Enrichment fields
  description?: string
}

// 채팅 메시지 인터페이스
export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  customersAdded?: Customer[]
}

// ============================================
// Cross-Component State (CustomerTable과 공유)
// ============================================

// 발견된 고객 목록
export const customersAtom = atom<Customer[]>([])

// 고객 추가 액션
export const addCustomersAtom = atom(null, (get, set, newCustomers: Customer[]) => {
  const customers = get(customersAtom)
  set(customersAtom, [...customers, ...newCustomers])
})

// 고객 삭제 액션
export const removeCustomerAtom = atom(null, (get, set, customerId: string) => {
  const customers = get(customersAtom)
  set(
    customersAtom,
    customers.filter((c) => c.id !== customerId),
  )
})

// 고객 업데이트 액션
export const updateCustomerAtom = atom(
  null,
  (get, set, customerId: string, updates: Partial<Customer>) => {
    const customers = get(customersAtom)
    set(
      customersAtom,
      customers.map((c) => (c.id === customerId ? { ...c, ...updates } : c)),
    )
  },
)

// 전체 고객 초기화
export const resetCustomersAtom = atom(null, (_get, set) => {
  set(customersAtom, [])
})

// ============================================
// Chat State (레이아웃 전환 시에도 유지)
// ============================================

// 채팅 메시지 목록 - 레이아웃 전환(리마운트) 시에도 유지
export const chatMessagesAtom = atom<ChatMessage[]>([])

// 메시지 추가
export const addChatMessageAtom = atom(null, (get, set, message: ChatMessage) => {
  const messages = get(chatMessagesAtom)
  const newMessages = [...messages, message]
  console.log("[store] Adding message:", message.id, "Total messages:", newMessages.length)
  set(chatMessagesAtom, newMessages)
})

// 메시지 업데이트
export const updateChatMessageAtom = atom(
  null,
  (get, set, messageId: string, updates: Partial<ChatMessage>) => {
    const messages = get(chatMessagesAtom)
    set(
      chatMessagesAtom,
      messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
    )
  },
)

// 메시지 초기화
export const resetChatMessagesAtom = atom(null, (_get, set) => {
  set(chatMessagesAtom, [])
})

// ============================================
// Streaming State (ChatRoom 리마운트 시에도 유지)
// ============================================

import type { LeadDiscoveryStatus } from "@/lib/api/hooks/lead-discovery"
import type { AnalyzedPage, BuyerRecommendation } from "@/lib/api/types/lead-discovery"

// 스트리밍 상태 인터페이스
export interface StreamingState {
  messageId: string | null
  analysisMessageId: string | null // 분석 결과가 표시될 메시지 ID (선택 후에도 유지)
  status: LeadDiscoveryStatus
  message: string
  progress: number
  mode?: "basic" | "advanced"
  recommendations: BuyerRecommendation[]
  selectedRecommendationId?: string // 선택된 추천 ID
  sessionId?: string
  // 분석된 페이지 목록
  analyzedPages: AnalyzedPage[]
  siteFavicon?: string
  // AI 분석 요약 (스트리밍 텍스트)
  analysisSummary: string
  // 고객군 분석 요약 (BigQuery 결과 분석, 스트리밍 텍스트)
  customerAnalysisSummary: string
}

export const initialStreamingState: StreamingState = {
  messageId: null,
  analysisMessageId: null,
  status: "idle",
  message: "",
  progress: 0,
  recommendations: [],
  selectedRecommendationId: undefined,
  analyzedPages: [],
  analysisSummary: "",
  customerAnalysisSummary: "",
}

// 스트리밍 상태 atom
export const streamingStateAtom = atom<StreamingState>(initialStreamingState)

// 스트리밍 상태 업데이트
export const updateStreamingStateAtom = atom(null, (get, set, updates: Partial<StreamingState>) => {
  const current = get(streamingStateAtom)
  set(streamingStateAtom, { ...current, ...updates })
})

// 스트리밍 상태 리셋
export const resetStreamingStateAtom = atom(null, (_get, set) => {
  set(streamingStateAtom, initialStreamingState)
})

// ============================================
// Selected Recommendation (적합도 계산용 - 스트리밍 완료 후에도 유지)
// ============================================

export interface SelectedTarget {
  country: string
  industry: string
  subIndustry?: string
}

export const selectedTargetAtom = atom<SelectedTarget | null>(null)

// ============================================
// Fit Score State (AI 기반 적합도 점수)
// ============================================

export interface FitScoreState {
  scores: Record<string, number> // leadId -> score
  isLoading: boolean
  progress: number // 0-100
  error?: string
}

export const initialFitScoreState: FitScoreState = {
  scores: {},
  isLoading: false,
  progress: 0,
}

// 적합도 점수 상태 atom
export const fitScoreStateAtom = atom<FitScoreState>(initialFitScoreState)

// 적합도 점수 업데이트 (단일)
export const updateFitScoreAtom = atom(
  null,
  (get, set, { leadId, score }: { leadId: string; score: number }) => {
    const current = get(fitScoreStateAtom)
    set(fitScoreStateAtom, {
      ...current,
      scores: { ...current.scores, [leadId]: score },
    })
  },
)

// 적합도 로딩 상태 설정
export const setFitScoreLoadingAtom = atom(
  null,
  (get, set, { isLoading, progress }: { isLoading: boolean; progress?: number }) => {
    const current = get(fitScoreStateAtom)
    set(fitScoreStateAtom, {
      ...current,
      isLoading,
      progress: progress ?? current.progress,
    })
  },
)

// 적합도 상태 리셋
export const resetFitScoreStateAtom = atom(null, (_get, set) => {
  set(fitScoreStateAtom, initialFitScoreState)
})

// ============================================
// Enrichment State (회사 description 등)
// ============================================

export interface EnrichmentState {
  // customerId -> loading state
  loadingIds: Set<string>
  // customerId -> error message
  errors: Record<string, string>
}

export const initialEnrichmentState: EnrichmentState = {
  loadingIds: new Set(),
  errors: {},
}

export const enrichmentStateAtom = atom<EnrichmentState>(initialEnrichmentState)

// Enrichment 로딩 시작
export const startEnrichmentAtom = atom(null, (get, set, customerIds: string[]) => {
  const current = get(enrichmentStateAtom)
  const newLoadingIds = new Set(current.loadingIds)
  for (const id of customerIds) {
    newLoadingIds.add(id)
  }
  set(enrichmentStateAtom, { ...current, loadingIds: newLoadingIds })
})

// Enrichment 완료 (로딩 해제)
export const finishEnrichmentAtom = atom(null, (get, set, customerId: string, error?: string) => {
  const current = get(enrichmentStateAtom)
  const newLoadingIds = new Set(current.loadingIds)
  newLoadingIds.delete(customerId)

  const newErrors = { ...current.errors }
  if (error) {
    newErrors[customerId] = error
  } else {
    delete newErrors[customerId]
  }

  set(enrichmentStateAtom, { loadingIds: newLoadingIds, errors: newErrors })
})

// Enrichment 상태 리셋
export const resetEnrichmentStateAtom = atom(null, (_get, set) => {
  set(enrichmentStateAtom, initialEnrichmentState)
})
