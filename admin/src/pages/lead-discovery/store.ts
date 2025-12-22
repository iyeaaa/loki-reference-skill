/**
 * Lead Discovery Store
 * - 크로스 컴포넌트 상태 및 레이아웃 전환 시 유지할 상태 관리
 * - 메시지 상태는 레이아웃 전환 시 리마운트되어도 유지되어야 함
 * - 채팅 메시지는 로컬스토리지에 저장하여 새로고침 후에도 유지
 */

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import {
  deleteCustomers as deleteCustomersFromIDB,
  getCustomers as getCustomersFromIDB,
  saveCustomers as saveCustomersToIDB,
} from "@/lib/idb/session-store"

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
  analysisSummary?: string // 웹사이트 분석 리포트 (분석 완료 후 저장)
}

// ============================================
// Cross-Component State (CustomerTable과 공유)
// ============================================

// 로컬스토리지 저장용 인터페이스 (Date를 string으로 변환)
type StoredCustomer = Omit<Customer, "createdAt"> & {
  createdAt: string // ISO string
}

// 고객 로컬스토리지 커스텀 스토리지
const customersStorage = {
  getItem: (key: string): Customer[] => {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return []
    }
    try {
      const parsed: StoredCustomer[] = JSON.parse(stored)
      return parsed.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
      }))
    } catch {
      return []
    }
  },
  setItem: (key: string, value: Customer[]): void => {
    const toStore: StoredCustomer[] = value.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    }))
    localStorage.setItem(key, JSON.stringify(toStore))
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 발견된 고객 목록 - 로컬스토리지에 저장하여 새로고침/뒤로가기 후에도 유지
export const customersAtom = atomWithStorage<Customer[]>(
  "lead-discovery-customers",
  [],
  customersStorage,
)

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
  localStorage.removeItem("lead-discovery-customers")
})

// ============================================
// Chat State (로컬스토리지에 저장하여 새로고침 후에도 유지)
// ============================================

// 로컬스토리지 저장용 인터페이스 (Date를 string으로 변환)
type StoredChatMessage = Omit<ChatMessage, "timestamp"> & {
  timestamp: string // ISO string
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

// 검색 화면으로 돌아가기 (메시지만 초기화, 결과는 유지)
// 사용자가 "이어서 하기"로 돌아올 수 있도록 customers와 userQuery 유지
export const goBackToSearchAtom = atom(null, (_get, set) => {
  // 채팅 메시지만 초기화
  set(chatMessagesAtom, [])
  localStorage.removeItem("lead-discovery-chat-messages")
  // customers와 streamingState.userQuery는 유지하여 "이어서 하기" 가능
})

// 전체 초기화 (완전히 새로 시작) - 모든 상태를 초기화
export const resetAllAtom = atom(null, (_get, set) => {
  // ★ 활성 세션 ID 초기화 (새 검색 시작 시 이전 세션과 분리)
  set(activeSessionIdAtom, null)
  // 채팅 메시지 초기화
  set(chatMessagesAtom, [])
  localStorage.removeItem("lead-discovery-chat-messages")
  // 고객 목록 초기화
  set(customersAtom, [])
  localStorage.removeItem("lead-discovery-customers")
  // 스트리밍 상태는 streamingStateAtom에서 별도로 초기화 (아래에 정의)
  // Thinking 상태 초기화는 thinkingStateAtom에서 별도로 초기화 (아래에 정의)
})

// ============================================
// Streaming State (로컬스토리지에 저장하여 새로고침 후에도 유지)
// ============================================

import type { ClarificationData, LeadDiscoveryStatus } from "@/lib/api/hooks/lead-discovery"
import type { AnalyzedPage, BuyerRecommendation } from "@/lib/api/types/lead-discovery"

// 세션 TTL (30분)
export const SESSION_TTL_MS = 30 * 60 * 1000

// 세션 만료 경고 시간 (25분 - 만료 5분 전)
export const SESSION_WARNING_MS = 25 * 60 * 1000

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
  sessionCreatedAt?: number // 세션 생성 시간 (만료 체크용)
  currentSessionId?: string // 검색 기록용 세션 ID
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

/**
 * 세션이 만료되었는지 확인
 * @param sessionCreatedAt 세션 생성 시간 (timestamp)
 * @returns 만료 여부
 */
export const isSessionExpired = (sessionCreatedAt?: number): boolean => {
  if (!sessionCreatedAt) {
    return false
  }
  const now = Date.now()
  return now - sessionCreatedAt > SESSION_TTL_MS
}

/**
 * 로컬스토리지에서 스트리밍 상태 로드
 * - 세션 만료 체크: 30분 이상 지난 세션은 초기화
 * - 진행 중 상태 체크: 세션이 만료되었으면 idle로 리셋
 */
const loadStreamingState = (): StreamingState => {
  try {
    const stored = localStorage.getItem("lead-discovery-streaming-state")
    if (!stored) {
      return initialStreamingState
    }

    const parsed = JSON.parse(stored) as StreamingState

    // 세션 만료 체크 (30분)
    if (parsed.sessionId && isSessionExpired(parsed.sessionCreatedAt)) {
      console.log(
        "[store] Session expired - resetting state",
        `sessionId: ${parsed.sessionId}`,
        `createdAt: ${parsed.sessionCreatedAt ? new Date(parsed.sessionCreatedAt).toISOString() : "unknown"}`,
      )

      // 세션이 만료된 경우: 기본 상태로 리셋하되, 완료된 결과는 유지
      // (status가 complete인 경우 결과를 보여줄 수 있도록)
      if (parsed.status === "complete") {
        return {
          ...parsed,
          sessionId: undefined, // 세션 ID는 제거
          sessionCreatedAt: undefined,
        }
      }

      // 진행 중이었던 상태는 완전 초기화
      return initialStreamingState
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

// 적합도 점수 업데이트 (배치)
export const updateFitScoresAtom = atom(
  null,
  (get, set, updates: Array<{ leadId: string; score: number; signature?: string }>) => {
    if (updates.length === 0) {
      return
    }
    const current = get(fitScoreStateAtom)

    const nextScores = { ...current.scores }
    const nextSignatures = { ...current.signatures }

    for (const u of updates) {
      nextScores[u.leadId] = u.score
      if (u.signature) {
        nextSignatures[u.leadId] = u.signature
      }
    }

    set(fitScoreStateAtom, {
      ...current,
      scores: nextScores,
      // signatures는 signature가 들어온 경우에만 갱신되지만, batch 처리에서는 전체를 한 번에 세팅
      signatures: nextSignatures,
    })
  },
)

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

// ============================================
// Thinking State (Cursor Agent 스타일 Thinking UI)
// ============================================

export type ThinkingEntry = {
  id: string
  messageId: string // 어느 메시지에 속하는지
  node: string
  summary: string
  detail: string
  isStreaming: boolean
  timestamp: number
}

export type ThinkingState = {
  entries: ThinkingEntry[]
  // 현재 스트리밍 중인 노드
  activeNode?: string
  // 현재 메시지 ID
  currentMessageId?: string
}

export const initialThinkingState: ThinkingState = {
  entries: [],
  activeNode: undefined,
  currentMessageId: undefined,
}

export const thinkingStateAtom = atom<ThinkingState>(initialThinkingState)

// 현재 메시지 ID 설정
export const setThinkingMessageIdAtom = atom(null, (get, set, messageId: string) => {
  const current = get(thinkingStateAtom)
  set(thinkingStateAtom, {
    ...current,
    currentMessageId: messageId,
  })
})

// Thinking 항목 추가 또는 업데이트
export const updateThinkingAtom = atom(
  null,
  (
    get,
    set,
    data: {
      node: string
      summary: string
      detail: string
      isStreaming: boolean
    },
  ) => {
    const current = get(thinkingStateAtom)
    const messageId = current.currentMessageId || "unknown"

    // 같은 메시지, 같은 노드에서 스트리밍 중인 항목 찾기
    const existingIndex = current.entries.findIndex(
      (e) => e.messageId === messageId && e.node === data.node && e.isStreaming,
    )

    if (existingIndex >= 0) {
      // 기존 스트리밍 항목 업데이트
      const updatedEntries = [...current.entries]
      updatedEntries[existingIndex] = {
        ...updatedEntries[existingIndex],
        summary: data.summary,
        detail: data.detail,
        isStreaming: data.isStreaming,
      }
      set(thinkingStateAtom, {
        ...current,
        entries: updatedEntries,
        activeNode: data.isStreaming ? data.node : undefined,
      })
    } else {
      // 새 항목 추가
      const newEntry: ThinkingEntry = {
        id: `thinking-${data.node}-${Date.now()}`,
        messageId,
        node: data.node,
        summary: data.summary,
        detail: data.detail,
        isStreaming: data.isStreaming,
        timestamp: Date.now(),
      }
      set(thinkingStateAtom, {
        ...current,
        entries: [...current.entries, newEntry],
        activeNode: data.isStreaming ? data.node : undefined,
      })
    }
  },
)

// 특정 메시지의 Thinking 항목 가져오기
export const getThinkingEntriesForMessage = (
  entries: ThinkingEntry[],
  messageId: string,
): ThinkingEntry[] => entries.filter((e) => e.messageId === messageId)

// Thinking 상태 리셋
export const resetThinkingAtom = atom(null, (_get, set) => {
  set(thinkingStateAtom, initialThinkingState)
})

// ============================================
// Search History State (최근 검색 기록)
// ============================================

export type SearchHistoryItem = {
  id: string
  query: string
  searchMode: "website" | "criteria_input" | "criteria_click"
  // 조건 검색 모드 필드
  country?: string
  industry?: string
  subIndustry?: string
  employeeRange?: string
  // 메타데이터
  timestamp: number
  resultCount?: number // 검색 결과 수 (선택적)
}

export type FavoriteSearch = SearchHistoryItem & {
  name: string // 사용자 지정 이름
  createdAt: number
}

const MAX_HISTORY_ITEMS = 5

// 히스토리 로컬스토리지 커스텀 스토리지
const historyStorage = {
  getItem: (key: string): SearchHistoryItem[] => {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return []
    }
    try {
      return JSON.parse(stored) as SearchHistoryItem[]
    } catch {
      return []
    }
  },
  setItem: (key: string, value: SearchHistoryItem[]): void => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 즐겨찾기 로컬스토리지 커스텀 스토리지
const favoritesStorage = {
  getItem: (key: string): FavoriteSearch[] => {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return []
    }
    try {
      return JSON.parse(stored) as FavoriteSearch[]
    } catch {
      return []
    }
  },
  setItem: (key: string, value: FavoriteSearch[]): void => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 최근 검색 히스토리 atom
export const searchHistoryAtom = atomWithStorage<SearchHistoryItem[]>(
  "lead-discovery-search-history",
  [],
  historyStorage,
)

// 즐겨찾기 검색 atom
export const favoriteSearchesAtom = atomWithStorage<FavoriteSearch[]>(
  "lead-discovery-favorite-searches",
  [],
  favoritesStorage,
)

// 검색 히스토리에 추가
export const addSearchHistoryAtom = atom(
  null,
  (get, set, item: Omit<SearchHistoryItem, "id" | "timestamp">) => {
    const history = get(searchHistoryAtom)

    // 동일한 쿼리가 있으면 제거 (최신 항목으로 업데이트)
    const filtered = history.filter((h) => h.query !== item.query)

    const newItem: SearchHistoryItem = {
      ...item,
      id: `history-${Date.now()}`,
      timestamp: Date.now(),
    }

    // 최근 5개만 유지
    const newHistory = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)
    set(searchHistoryAtom, newHistory)
  },
)

// 검색 히스토리 결과 수 업데이트
export const updateSearchHistoryResultAtom = atom(
  null,
  (get, set, { query, resultCount }: { query: string; resultCount: number }) => {
    const history = get(searchHistoryAtom)
    set(
      searchHistoryAtom,
      history.map((h) => (h.query === query ? { ...h, resultCount } : h)),
    )
  },
)

// 검색 히스토리 삭제
export const removeSearchHistoryAtom = atom(null, (get, set, id: string) => {
  const history = get(searchHistoryAtom)
  set(
    searchHistoryAtom,
    history.filter((h) => h.id !== id),
  )
})

// 검색 히스토리 전체 삭제
export const clearSearchHistoryAtom = atom(null, (_get, set) => {
  set(searchHistoryAtom, [])
})

// 즐겨찾기에 추가
export const addFavoriteSearchAtom = atom(
  null,
  (get, set, item: Omit<FavoriteSearch, "id" | "createdAt">) => {
    const favorites = get(favoriteSearchesAtom)

    // 동일한 쿼리가 있으면 추가하지 않음
    if (favorites.some((f) => f.query === item.query)) {
      return false
    }

    const newItem: FavoriteSearch = {
      ...item,
      id: `favorite-${Date.now()}`,
      createdAt: Date.now(),
    }

    set(favoriteSearchesAtom, [...favorites, newItem])
    return true
  },
)

// 즐겨찾기 이름 변경
export const renameFavoriteSearchAtom = atom(null, (get, set, id: string, newName: string) => {
  const favorites = get(favoriteSearchesAtom)
  set(
    favoriteSearchesAtom,
    favorites.map((f) => (f.id === id ? { ...f, name: newName } : f)),
  )
})

// 즐겨찾기 삭제
export const removeFavoriteSearchAtom = atom(null, (get, set, id: string) => {
  const favorites = get(favoriteSearchesAtom)
  set(
    favoriteSearchesAtom,
    favorites.filter((f) => f.id !== id),
  )
})

// 히스토리 아이템을 즐겨찾기로 이동
export const historyToFavoriteAtom = atom(null, (get, set, historyId: string, name: string) => {
  const history = get(searchHistoryAtom)
  const historyItem = history.find((h) => h.id === historyId)

  if (!historyItem) {
    return false
  }

  const favorites = get(favoriteSearchesAtom)

  // 이미 즐겨찾기에 있으면 추가하지 않음
  if (favorites.some((f) => f.query === historyItem.query)) {
    return false
  }

  const newFavorite: FavoriteSearch = {
    ...historyItem,
    id: `favorite-${Date.now()}`,
    name,
    createdAt: Date.now(),
  }

  set(favoriteSearchesAtom, [...favorites, newFavorite])
  return true
})

// ============================================
// Search Session State (멀티 세션 검색 관리)
// 백그라운드에서 독립적으로 진행되는 검색 세션들
// ============================================

// 검색 세션 상태 타입
export type SearchSessionStatus =
  | "connecting" // 서버 연결 중
  | "analyzing" // 웹사이트 분석 중
  | "waiting_selection" // 바이어 타겟 선택 대기
  | "waiting_clarification" // 확인 질문 대기
  | "searching" // 리드 검색 중
  | "complete" // 완료
  | "error" // 에러

// 개별 검색 세션
export type SearchSession = {
  id: string
  query: string
  searchMode: "website" | "criteria_input" | "criteria_click"
  workspaceId: string

  // 상태
  status: SearchSessionStatus
  progress: number
  message: string
  error?: LeadDiscoveryError

  // 백엔드 세션 정보
  backendSessionId?: string
  sessionCreatedAt?: number

  // 검색 결과
  customers: Customer[]
  totalCount?: number

  // 채팅 메시지 (세션별 저장)
  messages: ChatMessage[]

  // 바이어 추천 (waiting_selection 상태에서 사용)
  recommendations?: BuyerRecommendation[]
  selectedRecommendationId?: string

  // 확인 질문 (waiting_clarification 상태에서 사용)
  clarificationData?: ClarificationData

  // 분석 정보
  analyzedPages?: AnalyzedPage[]
  analysisSummary?: string
  customerAnalysisSummary?: string
  siteFavicon?: string

  // Fit Score (세션별 저장)
  fitScores?: Record<string, number>
  fitScoreSignatures?: Record<string, string>

  // 메타데이터
  createdAt: number
  updatedAt: number

  // 필터 조건 (조건 검색용)
  country?: string
  industry?: string
  subIndustry?: string
  employeeRange?: string

  // ★ IndexedDB 저장용 메타데이터 (localStorage 용량 제한 회피)
  _customerCount?: number // 고객 수 (UI 표시용, 실제 데이터는 IndexedDB)
}

// 최대 동시 검색 수
const MAX_CONCURRENT_SEARCHES = 3

// 검색 세션 저장용 타입 (Date -> string)
type StoredSearchSession = Omit<SearchSession, "customers" | "messages"> & {
  customers: StoredCustomer[]
  messages: StoredChatMessage[]
  _customerCount?: number // IndexedDB에 저장된 고객 수 (UI 표시용)
}

// 검색 세션 로컬스토리지 커스텀 스토리지
// ★ 고객 데이터는 IndexedDB에 별도 저장 (localStorage 5MB 제한 회피)
const searchSessionsStorage = {
  getItem: (key: string): SearchSession[] => {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return []
    }
    try {
      const parsed: StoredSearchSession[] = JSON.parse(stored)
      return parsed.map((s) => ({
        ...s,
        // ★ localStorage에서는 고객 데이터 없이 로드 (빈 배열)
        // 실제 고객 데이터는 switchToSessionAtom에서 IndexedDB로부터 로드
        customers: [],
        messages: (s.messages || []).map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })),
        // 메타데이터로 고객 수만 저장 (UI 표시용)
        _customerCount: s._customerCount || (s.customers?.length ?? 0),
      }))
    } catch {
      return []
    }
  },
  setItem: (key: string, value: SearchSession[]): void => {
    // ★ 고객 데이터는 IndexedDB에 별도 저장
    for (const session of value) {
      if (session.customers.length > 0) {
        // 비동기로 IndexedDB에 저장 (실패해도 메인 플로우에 영향 없음)
        saveCustomersToIDB(
          session.id,
          session.customers.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
          })),
        ).catch((err) => {
          console.error("[store] IndexedDB 고객 데이터 저장 실패:", session.id, err)
        })
      }
    }

    // localStorage에는 메타데이터만 저장 (고객 데이터 제외)
    const toStore: StoredSearchSession[] = value.map((s) => ({
      ...s,
      customers: [], // ★ 고객 데이터 제외
      _customerCount: s.customers.length, // UI 표시용 고객 수만 저장
      messages: s.messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    }))

    try {
      localStorage.setItem(key, JSON.stringify(toStore))
    } catch (err) {
      console.error("[store] localStorage 저장 실패:", err)
      // 용량 초과 시 오래된 세션 삭제 후 재시도
      try {
        const oldSessions = JSON.parse(localStorage.getItem(key) || "[]") as StoredSearchSession[]
        // 최근 10개만 유지
        const trimmed = toStore.slice(0, 10)
        localStorage.setItem(key, JSON.stringify(trimmed))
        // 삭제된 세션의 IndexedDB 데이터도 정리
        const removedIds = oldSessions.slice(10).map((s) => s.id)
        for (const id of removedIds) {
          deleteCustomersFromIDB(id).catch(() => {})
        }
      } catch {
        console.error("[store] localStorage 저장 재시도 실패")
      }
    }
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 검색 세션 목록 atom
export const searchSessionsAtom = atomWithStorage<SearchSession[]>(
  "lead-discovery-search-sessions",
  [],
  searchSessionsStorage,
)

// 현재 활성 세션 ID (ChatRoom에서 보고 있는 세션)
export const activeSessionIdAtom = atom<string | null>(null)

// 현재 활성 세션 가져오기 (파생 atom)
export const activeSessionAtom = atom((get) => {
  const sessions = get(searchSessionsAtom)
  const activeId = get(activeSessionIdAtom)
  if (!activeId) {
    return null
  }
  return sessions.find((s) => s.id === activeId) || null
})

// 진행 중인 세션들 (connecting, analyzing, searching)
export const inProgressSessionsAtom = atom((get) => {
  const sessions = get(searchSessionsAtom)
  return sessions.filter((s) => ["connecting", "analyzing", "searching"].includes(s.status))
})

// 대기 중인 세션들 (waiting_selection, waiting_clarification)
export const waitingSessionsAtom = atom((get) => {
  const sessions = get(searchSessionsAtom)
  return sessions.filter((s) => ["waiting_selection", "waiting_clarification"].includes(s.status))
})

// 완료된 세션들 (complete)
export const completedSessionsAtom = atom((get) => {
  const sessions = get(searchSessionsAtom)
  return sessions.filter((s) => s.status === "complete")
})

// 에러 세션들 (error)
export const errorSessionsAtom = atom((get) => {
  const sessions = get(searchSessionsAtom)
  return sessions.filter((s) => s.status === "error")
})

// 동시 검색 가능 여부 확인
export const canStartNewSearchAtom = atom((get) => {
  const inProgress = get(inProgressSessionsAtom)
  return inProgress.length < MAX_CONCURRENT_SEARCHES
})

// 새 검색 세션 생성
export const createSearchSessionAtom = atom(
  null,
  (
    get,
    set,
    params: {
      query: string
      searchMode: "website" | "criteria_input" | "criteria_click"
      workspaceId: string
      country?: string
      industry?: string
      subIndustry?: string
      employeeRange?: string
    },
  ): SearchSession | null => {
    const sessions = get(searchSessionsAtom)
    const inProgress = sessions.filter((s) =>
      ["connecting", "analyzing", "searching"].includes(s.status),
    )

    // 동시 검색 제한 확인
    if (inProgress.length >= MAX_CONCURRENT_SEARCHES) {
      return null
    }

    const now = Date.now()
    const newSession: SearchSession = {
      id: `session-${now}-${Math.random().toString(36).slice(2, 9)}`,
      query: params.query,
      searchMode: params.searchMode,
      workspaceId: params.workspaceId,
      status: "connecting",
      progress: 0,
      message: "서버에 연결 중...",
      customers: [],
      messages: [], // 채팅 메시지 초기화
      createdAt: now,
      updatedAt: now,
      country: params.country,
      industry: params.industry,
      subIndustry: params.subIndustry,
      employeeRange: params.employeeRange,
    }

    set(searchSessionsAtom, [newSession, ...sessions])
    set(activeSessionIdAtom, newSession.id)

    return newSession
  },
)

// 검색 세션 업데이트
export const updateSearchSessionAtom = atom(
  null,
  (get, set, sessionId: string, updates: Partial<SearchSession>) => {
    const sessions = get(searchSessionsAtom)
    set(
      searchSessionsAtom,
      sessions.map((s) => (s.id === sessionId ? { ...s, ...updates, updatedAt: Date.now() } : s)),
    )
  },
)

// 검색 세션에 고객 추가
export const addCustomersToSessionAtom = atom(
  null,
  (get, set, sessionId: string, newCustomers: Customer[]) => {
    const sessions = get(searchSessionsAtom)
    set(
      searchSessionsAtom,
      sessions.map((s) =>
        s.id === sessionId
          ? { ...s, customers: [...s.customers, ...newCustomers], updatedAt: Date.now() }
          : s,
      ),
    )
  },
)

// 검색 세션에 고객 목록 교체
export const setSessionCustomersAtom = atom(
  null,
  (get, set, sessionId: string, customers: Customer[]) => {
    const sessions = get(searchSessionsAtom)
    set(
      searchSessionsAtom,
      sessions.map((s) => (s.id === sessionId ? { ...s, customers, updatedAt: Date.now() } : s)),
    )
  },
)

// 검색 세션 삭제
export const removeSearchSessionAtom = atom(null, (get, set, sessionId: string) => {
  const sessions = get(searchSessionsAtom)
  const activeId = get(activeSessionIdAtom)

  set(
    searchSessionsAtom,
    sessions.filter((s) => s.id !== sessionId),
  )

  // ★ IndexedDB에서 고객 데이터도 삭제
  deleteCustomersFromIDB(sessionId).catch((err) => {
    console.error("[store] IndexedDB 고객 데이터 삭제 실패:", err)
  })

  // 삭제된 세션이 활성 세션이었으면 초기화
  if (activeId === sessionId) {
    set(activeSessionIdAtom, null)
  }
})

// 모든 완료된 세션 삭제
export const clearCompletedSessionsAtom = atom(null, (get, set) => {
  const sessions = get(searchSessionsAtom)
  set(
    searchSessionsAtom,
    sessions.filter((s) => s.status !== "complete"),
  )
})

// 모든 세션 삭제
export const clearAllSessionsAtom = atom(null, (_get, set) => {
  set(searchSessionsAtom, [])
  set(activeSessionIdAtom, null)
  localStorage.removeItem("lead-discovery-search-sessions")
})

// ★ IndexedDB에서 고객 데이터 로드 상태
export const isLoadingCustomersAtom = atom(false)

// ★ 세션 전환 (현재 세션 저장 + 새 세션 데이터 로드)
export const switchToSessionAtom = atom(
  null,
  (
    get,
    set,
    params: {
      targetSessionId: string
      currentMessages?: ChatMessage[] // 현재 세션의 메시지 (저장용)
      currentFitScores?: { scores: Record<string, number>; signatures: Record<string, string> } // 현재 세션의 Fit Score (저장용)
    },
  ) => {
    const sessions = get(searchSessionsAtom)
    const currentActiveId = get(activeSessionIdAtom)
    const { targetSessionId, currentMessages, currentFitScores } = params

    // 같은 세션이면 무시
    if (currentActiveId === targetSessionId) {
      console.log("[store] 같은 세션으로 전환 시도, 무시:", targetSessionId)
      return null
    }

    console.log("[store] 세션 전환 시작:", { from: currentActiveId, to: targetSessionId })

    // 1. 현재 세션의 메시지 및 Fit Score 저장 (있는 경우)
    if (currentActiveId) {
      const updates: Partial<SearchSession> = { updatedAt: Date.now() }
      if (currentMessages && currentMessages.length > 0) {
        updates.messages = currentMessages
      }
      if (currentFitScores && Object.keys(currentFitScores.scores).length > 0) {
        updates.fitScores = currentFitScores.scores
        updates.fitScoreSignatures = currentFitScores.signatures
      }
      if (Object.keys(updates).length > 1) {
        set(
          searchSessionsAtom,
          sessions.map((s) => (s.id === currentActiveId ? { ...s, ...updates } : s)),
        )
      }
    }

    // 2. 타겟 세션 찾기
    const updatedSessions = get(searchSessionsAtom) // 업데이트된 세션 목록
    const targetSession = updatedSessions.find((s) => s.id === targetSessionId)
    if (!targetSession) {
      return null
    }

    // 3. 활성 세션 ID 변경
    set(activeSessionIdAtom, targetSessionId)

    // 4. 고객 목록 로드 - ★ IndexedDB에서 비동기로 로드
    // 먼저 빈 배열 또는 메모리에 있는 데이터로 설정
    set(customersAtom, targetSession.customers)

    // ★ IndexedDB에서 고객 데이터 비동기 로드
    if (targetSession.customers.length === 0) {
      set(isLoadingCustomersAtom, true)
      getCustomersFromIDB(targetSessionId)
        .then((storedCustomers) => {
          if (storedCustomers && storedCustomers.length > 0) {
            // IndexedDB에서 가져온 데이터를 Customer 타입으로 변환
            const customers: Customer[] = (storedCustomers as StoredCustomer[]).map((c) => ({
              ...c,
              createdAt: new Date(c.createdAt),
            }))
            set(customersAtom, customers)
            // 세션에도 고객 데이터 업데이트 (메모리 캐시)
            set(
              searchSessionsAtom,
              get(searchSessionsAtom).map((s) =>
                s.id === targetSessionId ? { ...s, customers, updatedAt: Date.now() } : s,
              ),
            )
            console.log(`[store] IndexedDB에서 ${customers.length}개 고객 데이터 로드 완료`)
          }
        })
        .catch((err) => {
          console.error("[store] IndexedDB 고객 데이터 로드 실패:", err)
        })
        .finally(() => {
          set(isLoadingCustomersAtom, false)
        })
    }

    // 5. 채팅 메시지 로드
    // - 과거 세션에 메시지가 저장되지 않은 경우(구버전/버그), 기본 메시지를 생성해서 복원
    const hasMessages = targetSession.messages.length > 0
    // ★ _customerCount 사용 (IndexedDB 저장 시 저장된 고객 수)
    const resultCount =
      targetSession.totalCount || targetSession._customerCount || targetSession.customers.length
    const restoredMessages: ChatMessage[] = hasMessages
      ? targetSession.messages
      : (() => {
          const now = Date.now()
          const userMsg: ChatMessage = {
            id: `msg-${now}-restored-user`,
            role: "user",
            content: targetSession.query,
            timestamp: new Date(now),
          }
          const assistantMsg: ChatMessage = {
            id: `msg-${now + 1}-restored-assistant`,
            role: "assistant",
            content:
              targetSession.status === "complete" && resultCount > 0
                ? `Rinda 데이터베이스에서 **${resultCount}개의 잠재 바이어**를 찾았습니다. 오른쪽 테이블에서 결과를 확인하세요.`
                : targetSession.status === "error"
                  ? "검색 중 오류가 발생했습니다."
                  : "검색 결과를 불러오는 중...",
            timestamp: new Date(now + 1),
          }
          return [userMsg, assistantMsg]
        })()

    // 복원 메시지는 세션에도 저장해두어 다음부터는 동일 로직이 반복되지 않도록 함
    if (!hasMessages) {
      set(
        searchSessionsAtom,
        updatedSessions.map((s) =>
          s.id === targetSessionId
            ? { ...s, messages: restoredMessages, updatedAt: Date.now() }
            : s,
        ),
      )
    }

    set(chatMessagesAtom, restoredMessages)

    // 6. Fit Score 복원
    if (targetSession.fitScores || targetSession.fitScoreSignatures) {
      set(fitScoreStateAtom, {
        scores: targetSession.fitScores || {},
        signatures: targetSession.fitScoreSignatures || {},
        isLoading: false,
        progress: 100,
      })
    } else {
      // Fit Score가 없으면 초기화
      set(fitScoreStateAtom, {
        scores: {},
        signatures: {},
        isLoading: false,
        progress: 0,
      })
    }

    // 7. 스트리밍 상태 완전 복원
    const selectedRec = targetSession.recommendations?.find(
      (r) => r.id === targetSession.selectedRecommendationId,
    )
    set(streamingStateAtom, {
      analysisMessageId: null,
      status: targetSession.status,
      sessionId: targetSession.backendSessionId ?? undefined,
      progress: targetSession.progress,
      message: targetSession.message,
      recommendations: targetSession.recommendations || [],
      selectedRecommendationId: selectedRec?.id,
      clarificationData: targetSession.clarificationData ?? undefined,
      analyzedPages: targetSession.analyzedPages || [],
      analysisSummary: targetSession.analysisSummary || "",
      customerAnalysisSummary: targetSession.customerAnalysisSummary || "",
      siteFavicon: targetSession.siteFavicon || "",
      hasMore: false,
      totalAvailable: targetSession.totalCount || 0,
      loadedOffset: targetSession.customers.length,
      userQuery: targetSession.query,
      messageId: restoredMessages.at(-1)?.id ?? null,
      currentSessionId: targetSession.id,
    })

    // 8. 선택된 바이어 타겟 복원
    if (selectedRec) {
      set(selectedTargetAtom, {
        country: selectedRec.country,
        industry: selectedRec.industry,
        subIndustry: selectedRec.subIndustry,
      })
    }

    return targetSession
  },
)

// 현재 세션의 메시지를 세션에 저장 (페이지 이탈 시 등)
export const saveCurrentSessionMessagesAtom = atom(null, (get, set) => {
  const currentActiveId = get(activeSessionIdAtom)
  const currentMessages = get(chatMessagesAtom)
  const sessions = get(searchSessionsAtom)

  if (currentActiveId && currentMessages.length > 0) {
    set(
      searchSessionsAtom,
      sessions.map((s) =>
        s.id === currentActiveId ? { ...s, messages: currentMessages, updatedAt: Date.now() } : s,
      ),
    )
  }
})

// 세션 상태에 따른 표시 텍스트
export const getSessionStatusText = (session: SearchSession): string => {
  switch (session.status) {
    case "connecting":
      return "연결 중..."
    case "analyzing":
      return "웹사이트 분석 중..."
    case "waiting_selection":
      return "바이어 타겟 선택 필요"
    case "waiting_clarification":
      return "추가 정보 입력 필요"
    case "searching":
      return "리드 검색 중..."
    case "complete": {
      // totalCount를 우선 사용하고, 없으면 customers.length 사용
      const count = session.totalCount || session.customers.length
      return `${count}건 완료`
    }
    case "error":
      return "오류 발생"
    default:
      return "알 수 없음"
  }
}

// 세션 상태에 따른 색상 클래스
export const getSessionStatusColor = (
  status: SearchSessionStatus,
): { bg: string; text: string; border: string } => {
  switch (status) {
    case "connecting":
    case "analyzing":
    case "searching":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-500/30",
      }
    case "waiting_selection":
    case "waiting_clarification":
      return {
        bg: "bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
      }
    case "complete":
      return {
        bg: "bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
      }
    case "error":
      return {
        bg: "bg-red-500/10",
        text: "text-red-600 dark:text-red-400",
        border: "border-red-500/30",
      }
    default:
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-border",
      }
  }
}

// ============================================
// Session Validation & Cleanup (세션 유효성 검증 및 정리)
// ============================================

/**
 * 세션이 곧 만료될 예정인지 확인 (5분 이내)
 */
export const isSessionExpiringSoon = (sessionCreatedAt?: number): boolean => {
  if (!sessionCreatedAt) {
    return false
  }
  const now = Date.now()
  const elapsed = now - sessionCreatedAt
  return elapsed > SESSION_WARNING_MS && elapsed <= SESSION_TTL_MS
}

/**
 * 세션 남은 시간 계산 (밀리초)
 */
export const getSessionRemainingTime = (sessionCreatedAt?: number): number => {
  if (!sessionCreatedAt) {
    return 0
  }
  const elapsed = Date.now() - sessionCreatedAt
  return Math.max(0, SESSION_TTL_MS - elapsed)
}

/**
 * 세션 남은 시간 포맷 (분:초)
 */
export const formatSessionRemainingTime = (sessionCreatedAt?: number): string => {
  const remaining = getSessionRemainingTime(sessionCreatedAt)
  if (remaining <= 0) {
    return "만료됨"
  }

  const minutes = Math.floor(remaining / 60_000)
  const seconds = Math.floor((remaining % 60_000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// 세션 유효성 검증 상태
export type SessionValidationState = {
  isValidating: boolean
  lastValidatedAt?: number
  isValid?: boolean
  serverSessionExists?: boolean
  error?: string
}

export const initialSessionValidationState: SessionValidationState = {
  isValidating: false,
}

export const sessionValidationStateAtom = atom<SessionValidationState>(
  initialSessionValidationState,
)

// 세션 검증 시작
export const startSessionValidationAtom = atom(null, (get, set) => {
  const current = get(sessionValidationStateAtom)
  set(sessionValidationStateAtom, {
    ...current,
    isValidating: true,
    error: undefined,
  })
})

// 세션 검증 완료
export const finishSessionValidationAtom = atom(
  null,
  (_get, set, result: { isValid: boolean; serverSessionExists?: boolean; error?: string }) => {
    set(sessionValidationStateAtom, {
      isValidating: false,
      lastValidatedAt: Date.now(),
      isValid: result.isValid,
      serverSessionExists: result.serverSessionExists,
      error: result.error,
    })
  },
)

// 세션 검증 상태 리셋
export const resetSessionValidationAtom = atom(null, (_get, set) => {
  set(sessionValidationStateAtom, initialSessionValidationState)
})

/**
 * 만료된 검색 세션 정리
 * - 로컬스토리지에서 만료된 세션 제거
 * - 에러 상태의 오래된 세션 제거
 */
export const cleanupExpiredSessionsAtom = atom(null, (get, set) => {
  const sessions = get(searchSessionsAtom)
  const now = Date.now()

  // 만료 기준: 30분 이상 경과하고 진행 중이 아닌 세션
  const validSessions = sessions.filter((session) => {
    // 진행 중인 세션은 유지
    if (["connecting", "analyzing", "searching"].includes(session.status)) {
      return true
    }

    // 세션 생성 시간이 없으면 updatedAt 사용
    const sessionAge = now - (session.sessionCreatedAt || session.createdAt)

    // 완료된 세션: 2시간까지 유지
    if (session.status === "complete") {
      return sessionAge < 2 * 60 * 60 * 1000 // 2시간
    }

    // 대기 중인 세션: 30분까지 유지
    if (["waiting_selection", "waiting_clarification"].includes(session.status)) {
      return sessionAge < SESSION_TTL_MS
    }

    // 에러 세션: 10분까지 유지
    if (session.status === "error") {
      return sessionAge < 10 * 60 * 1000 // 10분
    }

    // 기타: 30분까지 유지
    return sessionAge < SESSION_TTL_MS
  })

  if (validSessions.length !== sessions.length) {
    console.log(
      `[store] Cleanup: removed ${sessions.length - validSessions.length} expired sessions`,
    )
    set(searchSessionsAtom, validSessions)
  }
})

/**
 * 페이지 로드 시 실행할 초기화 및 정리 작업
 * - 만료된 세션 정리
 * - 진행 중이었던 세션 상태 복구 시도
 */
export const initializeOnPageLoadAtom = atom(null, (get, set) => {
  console.log("[store] Initializing on page load...")

  // 1. 만료된 세션 정리
  set(cleanupExpiredSessionsAtom)

  // 2. 스트리밍 상태 확인 및 정리
  const streamingState = get(streamingStateAtom)
  if (streamingState.sessionId && isSessionExpired(streamingState.sessionCreatedAt)) {
    console.log("[store] Current streaming session expired, resetting...")
    set(streamingStateAtom, {
      ...initialStreamingState,
      // 완료된 상태면 결과는 유지
      ...(streamingState.status === "complete"
        ? {
            status: "complete" as const,
            userQuery: streamingState.userQuery,
            analysisSummary: streamingState.analysisSummary,
            customerAnalysisSummary: streamingState.customerAnalysisSummary,
          }
        : {}),
    })
  }

  // 3. 진행 중이던 세션이 있으면 상태 확인 필요 플래그 설정
  const sessions = get(searchSessionsAtom)
  const inProgressSessions = sessions.filter((s) =>
    ["connecting", "analyzing", "searching"].includes(s.status),
  )

  if (inProgressSessions.length > 0) {
    console.log(`[store] Found ${inProgressSessions.length} in-progress sessions to validate`)
    // 이 세션들은 서버 측 검증이 필요함
    // validateServerSession 함수로 검증 후 상태 업데이트
  }
})

// 세션 만료 알림 상태
export type SessionExpiryNotification = {
  sessionId: string
  type: "warning" | "expired"
  message: string
  dismissedAt?: number
}

export const sessionExpiryNotificationsAtom = atom<SessionExpiryNotification[]>([])

// 만료 알림 추가
export const addSessionExpiryNotificationAtom = atom(
  null,
  (get, set, notification: Omit<SessionExpiryNotification, "dismissedAt">) => {
    const notifications = get(sessionExpiryNotificationsAtom)
    // 중복 방지
    if (
      notifications.some(
        (n) => n.sessionId === notification.sessionId && n.type === notification.type,
      )
    ) {
      return
    }
    set(sessionExpiryNotificationsAtom, [...notifications, notification])
  },
)

// 만료 알림 해제
export const dismissSessionExpiryNotificationAtom = atom(null, (get, set, sessionId: string) => {
  const notifications = get(sessionExpiryNotificationsAtom)
  set(
    sessionExpiryNotificationsAtom,
    notifications.map((n) => (n.sessionId === sessionId ? { ...n, dismissedAt: Date.now() } : n)),
  )
})

// 만료 알림 전체 클리어
export const clearSessionExpiryNotificationsAtom = atom(null, (_get, set) => {
  set(sessionExpiryNotificationsAtom, [])
})

// ============================================
// Analysis Settings (웹사이트 분석 설정)
// ============================================

export type AnalysisSettings = {
  // 웹사이트 크롤링 타임아웃 (초)
  crawlTimeoutSeconds: number
  // 자동 타임아웃 사용 여부 (true면 동적으로 타임아웃 조정)
  useAutoTimeout: boolean
}

export const DEFAULT_ANALYSIS_SETTINGS: AnalysisSettings = {
  crawlTimeoutSeconds: 30, // 기본 30초
  useAutoTimeout: true, // 기본적으로 자동 타임아웃 사용
}

// 타임아웃 프리셋 옵션
export const TIMEOUT_PRESETS = [
  { value: 15, label: "빠름 (15초)", description: "빠른 사이트용" },
  { value: 30, label: "보통 (30초)", description: "일반적인 사이트" },
  { value: 60, label: "느림 (60초)", description: "느린 사이트용" },
  { value: 120, label: "매우 느림 (2분)", description: "매우 느린 사이트용" },
] as const

// 분석 설정 로컬스토리지 스토리지
const analysisSettingsStorage = {
  getItem: (key: string): AnalysisSettings => {
    const stored = localStorage.getItem(key)
    if (!stored) {
      return DEFAULT_ANALYSIS_SETTINGS
    }
    try {
      const parsed = JSON.parse(stored) as Partial<AnalysisSettings>
      return {
        ...DEFAULT_ANALYSIS_SETTINGS,
        ...parsed,
      }
    } catch {
      return DEFAULT_ANALYSIS_SETTINGS
    }
  },
  setItem: (key: string, value: AnalysisSettings): void => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key)
  },
}

// 분석 설정 atom
export const analysisSettingsAtom = atomWithStorage<AnalysisSettings>(
  "lead-discovery-analysis-settings",
  DEFAULT_ANALYSIS_SETTINGS,
  analysisSettingsStorage,
)

// 타임아웃 업데이트
export const updateCrawlTimeoutAtom = atom(null, (get, set, timeoutSeconds: number) => {
  const current = get(analysisSettingsAtom)
  set(analysisSettingsAtom, {
    ...current,
    crawlTimeoutSeconds: timeoutSeconds,
    useAutoTimeout: false, // 수동 설정 시 자동 타임아웃 비활성화
  })
})

// 자동 타임아웃 토글
export const toggleAutoTimeoutAtom = atom(null, (get, set) => {
  const current = get(analysisSettingsAtom)
  set(analysisSettingsAtom, {
    ...current,
    useAutoTimeout: !current.useAutoTimeout,
    // 자동 모드로 전환 시 기본값으로 리셋
    ...(current.useAutoTimeout === false && {
      crawlTimeoutSeconds: DEFAULT_ANALYSIS_SETTINGS.crawlTimeoutSeconds,
    }),
  })
})

// 설정 초기화
export const resetAnalysisSettingsAtom = atom(null, (_get, set) => {
  set(analysisSettingsAtom, DEFAULT_ANALYSIS_SETTINGS)
  localStorage.removeItem("lead-discovery-analysis-settings")
})
