/**
 * Lead Discovery Store
 * - 크로스 컴포넌트 상태 및 레이아웃 전환 시 유지할 상태 관리
 * - 메시지 상태는 레이아웃 전환 시 리마운트되어도 유지되어야 함
 * - 채팅 메시지는 로컬스토리지에 저장하여 새로고침 후에도 유지
 */

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// BigQuery LeadResult 구조와 일치하는 Customer 인터페이스
// 컬럼 순서: 회사명, 웹사이트, Description, Fit Score, Country, Category, Main Industry, Sub Industry, Company Email
export type Customer = {
  id: string
  company_name?: string // 회사명
  web_address?: string // 웹사이트
  description?: string // Description
  fit_score?: number // Fit Score (0-100)
  httpStatus?: number | null // 웹사이트 접속 상태(Enrichment 결과)
  crawlTimeSeconds?: number | null // 크롤링 시간(초)
  country?: string // Country
  category?: string // Category
  industry?: string // Main Industry
  sub_industry?: string // Sub Industry
  email?: string // Company Email
  // 추가 필드
  phone?: string
  employee?: string
  revenue?: string
  source: string
  createdAt: Date
  // Enrichment 상태
  verified?: boolean // Enrichment 완료 여부 (인스타그램 스타일 체크)
  companyType?: string // 업체 유형 (제조업체, 브랜드사, 유통업체, 수입업체, 대리점, 소매업체 등)
  // 웹데추 Enrichment 추가 필드
  address?: string // 주소
  city?: string // 도시
  state?: string // 주/도
  foundedYear?: string // 설립년도
  linkedinUrl?: string // 링크드인 URL
  facebookUrl?: string // 페이스북 URL
  instagramUrl?: string // 인스타그램 URL
  twitterUrl?: string // 트위터/X URL
  products?: string // 주요 제품/서비스
  businessSectors?: string // 비즈니스 섹터
}

// 채팅 메시지 인터페이스
export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  customersAdded?: Customer[]
  type?: "default" | "workspace_select" | "error" // 워크스페이스 선택 UI 표시용, 에러 표시용
  errorData?: LeadDiscoveryError // 에러 상세 정보
}

// ============================================
// Cross-Component State (CustomerTable과 공유)
// ============================================

// 발견된 고객 목록
export const customersAtom = atom<Customer[]>([])

// 고객 추가 액션 (Load More용 - 기존 고객에 추가)
export const addCustomersAtom = atom(null, (get, set, newCustomers: Customer[]) => {
  const customers = get(customersAtom)
  set(customersAtom, [...customers, ...newCustomers])
})

// 고객 목록 교체 액션 (새 검색용 - 기존 고객 대체)
export const setCustomersAtom = atom(null, (_get, set, newCustomers: Customer[]) => {
  set(customersAtom, newCustomers)
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
// Chat State (로컬스토리지에 저장하여 새로고침 후에도 유지)
// ============================================

// 로컬스토리지 저장용 인터페이스 (Date를 string으로 변환)
type StoredChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string // ISO string
  customersAdded?: Customer[]
}

// 로컬스토리지 커스텀 스토리지 (Date 직렬화/역직렬화 처리)
const chatStorage = {
  getItem: (key: string): ChatMessage[] => {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return []
    }
    try {
      const parsed: StoredChatMessage[] = JSON.parse(stored)
      return parsed.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }))
    } catch {
      return []
    }
  },
  setItem: (key: string, value: ChatMessage[]): void => {
    const toStore: StoredChatMessage[] = value.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }))
    localStorage.setItem(key, JSON.stringify(toStore))
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 채팅 메시지 목록 - 로컬스토리지에 저장되어 새로고침 후에도 유지
export const chatMessagesAtom = atomWithStorage<ChatMessage[]>(
  "lead-discovery-chat-messages",
  [],
  chatStorage,
)

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

// 메시지 초기화 (로컬스토리지도 함께 클리어)
export const resetChatMessagesAtom = atom(null, (_get, set) => {
  set(chatMessagesAtom, [])
  localStorage.removeItem("lead-discovery-chat-messages")
})

// 전체 초기화 (새 검색) - 모든 상태를 초기화
export const resetAllAtom = atom(null, (_get, set) => {
  // 채팅 메시지 초기화
  set(chatMessagesAtom, [])
  localStorage.removeItem("lead-discovery-chat-messages")
  // 고객 목록 초기화
  set(customersAtom, [])
  // 스트리밍 상태는 streamingStateAtom에서 별도로 초기화 (아래에 정의)
})

// ============================================
// Streaming State (로컬스토리지에 저장하여 새로고침 후에도 유지)
// ============================================

import type { ClarificationData, LeadDiscoveryStatus } from "@/lib/api/hooks/lead-discovery"
import type { AnalyzedPage, BuyerRecommendation } from "@/lib/api/types/lead-discovery"

// 스트리밍 상태 인터페이스
export type StreamingState = {
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
  // 사용자 검색 쿼리 (FitScore 계산용)
  userQuery?: string
  // 더 가져오기 정보
  hasMore?: boolean
  totalAvailable?: number
  loadedOffset?: number // 현재까지 로드된 offset
  // 확인 질문 상태 (Human-in-the-Loop Clarification)
  clarificationData?: ClarificationData
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

// 로컬스토리지에서 스트리밍 상태 로드 (로딩 중 상태면 완료로 변경)
const loadStreamingState = (): StreamingState => {
  try {
    const stored = localStorage.getItem("lead-discovery-streaming-state")
    if (!stored) {
      return initialStreamingState
    }

    const parsed = JSON.parse(stored) as StreamingState

    // 로딩 중 상태 (idle, complete, waiting_selection, error 제외)면 완료 상태로 변경
    const loadingStatuses: LeadDiscoveryStatus[] = [
      "connecting",
      "routing",
      "analyzing",
      "recommending",
      "searching",
    ]
    if (loadingStatuses.includes(parsed.status)) {
      // 추천이 있으면 waiting_selection, 없으면 complete
      return {
        ...parsed,
        status: parsed.recommendations.length > 0 ? "waiting_selection" : "complete",
        message: "",
        progress: 100,
      }
    }

    return parsed
  } catch {
    return initialStreamingState
  }
}

// 로컬스토리지 커스텀 스토리지
const streamingStorage = {
  getItem: (_key: string): StreamingState => loadStreamingState(),
  setItem: (key: string, value: StreamingState): void => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 스트리밍 상태 atom - 로컬스토리지에 저장
export const streamingStateAtom = atomWithStorage<StreamingState>(
  "lead-discovery-streaming-state",
  initialStreamingState,
  streamingStorage,
)

// 스트리밍 상태 업데이트
export const updateStreamingStateAtom = atom(null, (get, set, updates: Partial<StreamingState>) => {
  const current = get(streamingStateAtom)
  set(streamingStateAtom, { ...current, ...updates })
})

// 스트리밍 상태 리셋
export const resetStreamingStateAtom = atom(null, (_get, set) => {
  set(streamingStateAtom, initialStreamingState)
  localStorage.removeItem("lead-discovery-streaming-state")
})

// ============================================
// Selected Recommendation (적합도 계산용 - 스트리밍 완료 후에도 유지)
// ============================================

export type SelectedTarget = {
  country: string
  industry: string
  subIndustry?: string
}

export const selectedTargetAtom = atom<SelectedTarget | null>(null)

// ============================================
// Fit Score State (AI 기반 적합도 점수)
// ============================================

export type FitScoreState = {
  scores: Record<string, number> // leadId -> score
  signatures: Record<string, string> // leadId -> signature (입력 데이터 변경 시 재계산 트리거)
  isLoading: boolean
  progress: number // 0-100
  error?: string
}

export const initialFitScoreState: FitScoreState = {
  scores: {},
  signatures: {},
  isLoading: false,
  progress: 0,
}

// 적합도 점수 상태 atom
export const fitScoreStateAtom = atom<FitScoreState>(initialFitScoreState)

// 적합도 점수 업데이트 (단일)
export const updateFitScoreAtom = atom(
  null,
  (
    get,
    set,
    { leadId, score, signature }: { leadId: string; score: number; signature?: string },
  ) => {
    const current = get(fitScoreStateAtom)
    set(fitScoreStateAtom, {
      ...current,
      scores: { ...current.scores, [leadId]: score },
      ...(signature ? { signatures: { ...current.signatures, [leadId]: signature } } : {}),
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

// 새 검색 시작 시 검색 관련 상태만 리셋 (채팅 메시지는 유지)
export const resetSearchStateAtom = atom(null, (_get, set) => {
  set(customersAtom, [])
  set(fitScoreStateAtom, initialFitScoreState)
  set(selectedTargetAtom, null)
  set(enrichmentStateAtom, initialEnrichmentState)
})

// ============================================
// Enrichment State (회사 description 등)
// ============================================

export type EnrichmentState = {
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

// ============================================
// Bulk Enrichment State (프로필 고도화 퀵액션)
// ============================================

export type BulkEnrichmentState = {
  isRunning: boolean
  total: number
  completed: number
  currentCompany: string
  startedAt?: Date
}

export const initialBulkEnrichmentState: BulkEnrichmentState = {
  isRunning: false,
  total: 0,
  completed: 0,
  currentCompany: "",
}

export const bulkEnrichmentStateAtom = atom<BulkEnrichmentState>(initialBulkEnrichmentState)

// Bulk Enrichment 시작
export const startBulkEnrichmentAtom = atom(null, (_get, set, total: number) => {
  set(bulkEnrichmentStateAtom, {
    isRunning: true,
    total,
    completed: 0,
    currentCompany: "",
    startedAt: new Date(),
  })
})

// Bulk Enrichment 진행 업데이트
export const updateBulkEnrichmentProgressAtom = atom(
  null,
  (get, set, completed: number, currentCompany: string) => {
    const current = get(bulkEnrichmentStateAtom)
    set(bulkEnrichmentStateAtom, {
      ...current,
      completed,
      currentCompany,
    })
  },
)

// Bulk Enrichment 완료
export const finishBulkEnrichmentAtom = atom(null, (_get, set) => {
  set(bulkEnrichmentStateAtom, initialBulkEnrichmentState)
})

// ============================================
// Customer Group Creation State (새 고객그룹으로 추가하기)
// ============================================

export type CreateGroupState = {
  isCreating: boolean
  groupName: string
  groupId?: string
  leadsCount: number
  error?: string
}

export const initialCreateGroupState: CreateGroupState = {
  isCreating: false,
  groupName: "",
  leadsCount: 0,
}

export const createGroupStateAtom = atom<CreateGroupState>(initialCreateGroupState)

// 그룹 생성 시작
export const startCreateGroupAtom = atom(
  null,
  (_get, set, groupName: string, leadsCount: number) => {
    set(createGroupStateAtom, {
      isCreating: true,
      groupName,
      leadsCount,
      groupId: undefined,
      error: undefined,
    })
  },
)

// 그룹 생성 완료
export const finishCreateGroupAtom = atom(
  null,
  (_get, set, result: { groupId?: string; error?: string }) => {
    set(createGroupStateAtom, {
      ...initialCreateGroupState,
      groupId: result.groupId,
      error: result.error,
    })
  },
)

// 그룹 생성 상태 초기화
export const resetCreateGroupStateAtom = atom(null, (_get, set) => {
  set(createGroupStateAtom, initialCreateGroupState)
})

// ============================================
// Error State (에러 처리 및 복구)
// ============================================

import type { LeadDiscoveryError } from "./types/errors"

export type ErrorState = {
  error: LeadDiscoveryError | null
  lastSuccessfulState?: Partial<StreamingState> // 복구용 이전 상태 저장
  retryCount: number
  lastRetryAt?: Date
  // 마지막 검색 쿼리 (다시 시도용)
  lastQuery?: {
    query: string
    workspaceId: string
  }
}

export const initialErrorState: ErrorState = {
  error: null,
  retryCount: 0,
}

export const errorStateAtom = atom<ErrorState>(initialErrorState)

// 에러 설정 (이전 상태 자동 저장)
export const setErrorAtom = atom(
  null,
  (get, set, error: LeadDiscoveryError, lastQuery?: { query: string; workspaceId: string }) => {
    const currentStreamingState = get(streamingStateAtom)
    const currentErrorState = get(errorStateAtom)

    set(errorStateAtom, {
      error,
      lastSuccessfulState:
        currentStreamingState.status !== "error"
          ? currentStreamingState
          : currentErrorState.lastSuccessfulState,
      retryCount: currentErrorState.retryCount + 1,
      lastRetryAt: new Date(),
      lastQuery: lastQuery || currentErrorState.lastQuery,
    })
  },
)

// 에러 클리어
export const clearErrorAtom = atom(null, (_get, set) => {
  set(errorStateAtom, initialErrorState)
})

// 이전 상태로 복구
export const recoverStateAtom = atom(null, (get, set) => {
  const errorState = get(errorStateAtom)
  if (errorState.lastSuccessfulState) {
    set(streamingStateAtom, {
      ...initialStreamingState,
      ...errorState.lastSuccessfulState,
      status:
        errorState.lastSuccessfulState.status === "error"
          ? "idle"
          : errorState.lastSuccessfulState.status || "idle",
    })
  }
  set(errorStateAtom, initialErrorState)
})

// 재시도 횟수 리셋
export const resetRetryCountAtom = atom(null, (get, set) => {
  const current = get(errorStateAtom)
  set(errorStateAtom, {
    ...current,
    retryCount: 0,
  })
})
