/**
 * Lead Discovery Hook (Optimized)
 * TanStack Query 기반 LangGraph 리드 탐색 API
 * - 챗봇 패턴과 동일한 콜백 기반 구조
 * - 컴포넌트에서 로컬 상태 관리
 */

import { useMutation } from "@tanstack/react-query"
import type {
  AnalyzedPage,
  BigQueryResult,
  BuyerRecommendation,
  WebsiteAnalysis,
} from "../types/lead-discovery"

// 상태 타입
export type LeadDiscoveryStatus =
  | "idle"
  | "connecting"
  | "routing"
  | "analyzing"
  | "recommending"
  | "waiting_selection"
  | "searching"
  | "complete"
  | "error"

// SSE 이벤트 데이터 타입
export interface LeadDiscoveryEventData {
  status: LeadDiscoveryStatus
  message: string
  progress: number
  mode?: "basic" | "advanced"
  websiteAnalysis?: WebsiteAnalysis
  recommendations?: BuyerRecommendation[]
  selectedRecommendation?: BuyerRecommendation
  results?: BigQueryResult[]
  totalCount?: number
  sql?: string
  explanation?: string
  sessionId?: string
  // 분석된 페이지 목록
  analyzedPages?: AnalyzedPage[]
  siteFavicon?: string
  // AI 분석 요약 (스트리밍 텍스트)
  analysisSummary?: string
  // 고객군 분석 요약 (BigQuery 결과 분석)
  customerAnalysisSummary?: string
}

// Mutation 옵션 (콜백 기반)
export interface UseLeadDiscoveryMutationOptions {
  onStatusChange?: (data: LeadDiscoveryEventData) => void
  onWebsiteAnalysis?: (analysis: WebsiteAnalysis) => void
  onRecommendations?: (recommendations: BuyerRecommendation[], sessionId: string) => void
  onResults?: (results: BigQueryResult[], totalCount: number) => void
  onComplete?: (data: LeadDiscoveryEventData) => void
  onError?: (error: string) => void
  // 분석 요약 텍스트 스트리밍
  onTextChunk?: (chunk: string, accumulated: string) => void
}

// API 요청 타입
interface SearchRequest {
  query: string
  workspaceId: string
  locale?: string
}

interface SelectRequest {
  sessionId: string
  selectedRecommendationId: string
  workspaceId: string
}

const BASE_URL = import.meta.env.VITE_API_URL || ""

// 도커 스타일 로깅 유틸리티
const getTimestamp = () => new Date().toISOString()
const SERVICE = "lead-discovery"

const log = {
  info: (action: string, data?: Record<string, unknown>) => {
    const msg = data ? `${action} ${JSON.stringify(data)}` : action
    console.log(`${getTimestamp()} | ${SERVICE} | INFO  | ${msg}`)
  },
  debug: (action: string, data?: Record<string, unknown>) => {
    const msg = data ? `${action} ${JSON.stringify(data)}` : action
    console.log(`${getTimestamp()} | ${SERVICE} | DEBUG | ${msg}`)
  },
  error: (action: string, error?: unknown) => {
    const errorMsg = error instanceof Error ? error.message : String(error ?? "")
    console.error(`${getTimestamp()} | ${SERVICE} | ERROR | ${action} ${errorMsg}`)
  },
  request: (action: string, data?: Record<string, unknown>) => {
    const msg = data ? `→ ${action} ${JSON.stringify(data)}` : `→ ${action}`
    console.log(`${getTimestamp()} | ${SERVICE} | INFO  | ${msg}`)
  },
  response: (event: string, data?: Record<string, unknown>) => {
    const msg = data ? `← ${event} ${JSON.stringify(data)}` : `← ${event}`
    console.log(`${getTimestamp()} | ${SERVICE} | INFO  | ${msg}`)
  },
  status: (status: string, message: string, progress: number) => {
    console.log(
      `${getTimestamp()} | ${SERVICE} | INFO  | status=${status} progress=${progress}% msg="${message}"`,
    )
  },
}

// SSE 라인 파싱 헬퍼
function parseSSELine(line: string): { event?: string; data?: string } {
  const eventMatch = line.match(/^event:\s*(.+)$/)
  const dataMatch = line.match(/^data:\s*(.+)$/)
  return {
    event: eventMatch?.[1],
    data: dataMatch?.[1],
  }
}

// SSE 청크 파싱 헬퍼
function parseSSEChunk(chunk: string): Array<{ event: string; data: unknown }> {
  const results: Array<{ event: string; data: unknown }> = []
  const blocks = chunk.split("\n\n").filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split("\n")
    let eventType = ""
    let eventData = ""

    for (const line of lines) {
      const { event, data } = parseSSELine(line.trim())
      if (event) eventType = event
      if (data) eventData = data
    }

    if (eventType && eventData) {
      try {
        results.push({ event: eventType, data: JSON.parse(eventData) })
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }
  }

  return results
}

// SSE 스트림 처리
async function processSSEStream(
  response: Response,
  options: UseLeadDiscoveryMutationOptions,
  sessionIdRef: { current: string | undefined },
): Promise<LeadDiscoveryEventData | null> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("스트림을 읽을 수 없습니다")

  const decoder = new TextDecoder()
  let buffer = ""
  let lastEventData: LeadDiscoveryEventData | null = null
  let currentMode: "basic" | "advanced" | undefined
  let currentAnalysis: WebsiteAnalysis | undefined
  let currentRecommendations: BuyerRecommendation[] = []

  const handleEvent = (eventType: string, data: Record<string, unknown>) => {
    switch (eventType) {
      case "connected": {
        sessionIdRef.current = data.sessionId as string
        log.response("connected", { sessionId: data.sessionId })
        const eventData: LeadDiscoveryEventData = {
          status: "routing",
          message: "검색 모드 분석 중...",
          progress: 5,
          sessionId: data.sessionId as string,
        }
        options.onStatusChange?.(eventData)
        lastEventData = eventData
        break
      }

      case "node-start": {
        const node = data.node as string
        const message = (data.message as string) || ""
        let status: LeadDiscoveryStatus = "routing"
        let defaultProgress = 0

        // 노드별 기본 progress 값 설정
        if (node === "routeMode") {
          status = "routing"
          defaultProgress = 5
        } else if (node === "analyzeWebsite") {
          status = "analyzing"
          defaultProgress = 15
        } else if (node === "recommendBuyers") {
          status = "recommending"
          defaultProgress = 40
        } else if (node === "generateBigQueryParams" || node === "generateParams") {
          status = "searching"
          defaultProgress = 65
        } else if (node === "executeBigQuery") {
          status = "searching"
          defaultProgress = 75
        } else if (node === "formatResponse") {
          status = "searching"
          defaultProgress = 95
        }

        const progressValue =
          (data.percent as number) ?? (data.progress as number) ?? defaultProgress

        log.response(`node-start:${node}`, { message, progress: progressValue })

        const eventData: LeadDiscoveryEventData = {
          status,
          message,
          progress: progressValue,
          mode: currentMode,
          sessionId: sessionIdRef.current,
        }
        options.onStatusChange?.(eventData)
        lastEventData = eventData
        break
      }

      case "progress": {
        // 백엔드는 "percent"로 보내고, 프론트엔드는 "progress"로 사용
        const progressValue =
          (data.percent as number) ?? (data.progress as number) ?? lastEventData?.progress ?? 0

        // 페이지 목록 추출 (details 안에 있음)
        const details = data.details as Record<string, unknown> | undefined
        const pages = (details?.pages as AnalyzedPage[]) || lastEventData?.analyzedPages || []

        const eventData: LeadDiscoveryEventData = {
          status: lastEventData?.status || "routing",
          message: (data.message as string) || lastEventData?.message || "",
          progress: progressValue,
          mode: currentMode,
          sessionId: sessionIdRef.current,
          analyzedPages: pages,
          analysisSummary: lastEventData?.analysisSummary,
        }
        options.onStatusChange?.(eventData)
        lastEventData = eventData
        break
      }

      case "text_chunk": {
        // AI 분석 요약 스트리밍 텍스트
        const chunk = (data.chunk as string) || ""
        const accumulated = (data.accumulatedText as string) || ""
        const node = (data.node as string) || ""

        // 콜백 호출
        options.onTextChunk?.(chunk, accumulated)

        // 노드별로 분기하여 다른 필드에 저장
        const isCustomerAnalysis = node === "executeBigQuery"

        // 상태 업데이트
        const eventData: LeadDiscoveryEventData = {
          status: lastEventData?.status || (isCustomerAnalysis ? "searching" : "analyzing"),
          message:
            lastEventData?.message ||
            (isCustomerAnalysis ? "고객군을 분석하고 있어요" : "분석 결과를 정리하고 있어요"),
          progress: lastEventData?.progress || (isCustomerAnalysis ? 90 : 70),
          mode: currentMode,
          sessionId: sessionIdRef.current,
          analyzedPages: lastEventData?.analyzedPages,
          analysisSummary: isCustomerAnalysis ? lastEventData?.analysisSummary : accumulated,
          customerAnalysisSummary: isCustomerAnalysis
            ? accumulated
            : lastEventData?.customerAnalysisSummary,
        }
        options.onStatusChange?.(eventData)
        lastEventData = eventData
        break
      }

      case "node-complete": {
        const node = data.node as string
        const result = data.result as Record<string, unknown> | undefined

        log.response(`node-complete:${node}`, result ? { result: Object.keys(result) } : undefined)

        if (node === "routeMode") {
          currentMode = result?.mode as "basic" | "advanced"
          log.info(`Mode detected: ${currentMode}`)
          const eventData: LeadDiscoveryEventData = {
            status: currentMode === "basic" ? "analyzing" : "searching",
            message: currentMode === "basic" ? "웹사이트 분석 중..." : "리드 검색 중...",
            progress: 15,
            mode: currentMode,
            sessionId: sessionIdRef.current,
          }
          options.onStatusChange?.(eventData)
          lastEventData = eventData
        } else if (node === "analyzeWebsite") {
          currentAnalysis = result as WebsiteAnalysis | undefined
          if (currentAnalysis) {
            options.onWebsiteAnalysis?.(currentAnalysis)
          }
          const eventData: LeadDiscoveryEventData = {
            status: "recommending",
            message: "바이어 추천 생성 중...",
            progress: 40,
            mode: currentMode,
            websiteAnalysis: currentAnalysis,
            sessionId: sessionIdRef.current,
          }
          options.onStatusChange?.(eventData)
          lastEventData = eventData
        } else if (node === "recommendBuyers") {
          if (result?.requiresSelection) {
            currentRecommendations = (result.recommendations as BuyerRecommendation[]) || []
            options.onRecommendations?.(currentRecommendations, sessionIdRef.current || "")
            const eventData: LeadDiscoveryEventData = {
              status: "waiting_selection",
              message: "바이어 타겟을 선택해주세요",
              progress: 60,
              mode: currentMode,
              websiteAnalysis: currentAnalysis,
              recommendations: currentRecommendations,
              sessionId: sessionIdRef.current,
            }
            options.onStatusChange?.(eventData)
            lastEventData = eventData
          }
        } else if (node === "executeBigQuery") {
          const eventData: LeadDiscoveryEventData = {
            status: "searching",
            message: `${result?.totalCount || 0}개 리드 발견`,
            progress: 90,
            mode: currentMode,
            sessionId: sessionIdRef.current,
          }
          options.onStatusChange?.(eventData)
          lastEventData = eventData
        }
        break
      }

      case "interrupt": {
        // Human-in-the-loop: 사용자 선택 필요
        log.response("interrupt", { type: data.type, hasRecommendations: !!data.recommendations })

        // recommendations는 data에 직접 있거나 payload 안에 있을 수 있음
        const recommendations =
          (data.recommendations as BuyerRecommendation[]) ||
          ((data.payload as Record<string, unknown>)?.recommendations as BuyerRecommendation[])

        // websiteAnalysis도 마찬가지
        const analysis =
          (data.websiteAnalysis as WebsiteAnalysis) ||
          ((data.payload as Record<string, unknown>)?.websiteAnalysis as WebsiteAnalysis) ||
          currentAnalysis

        if (recommendations && recommendations.length > 0) {
          currentRecommendations = recommendations
          currentAnalysis = analysis
          options.onRecommendations?.(currentRecommendations, sessionIdRef.current || "")

          const eventData: LeadDiscoveryEventData = {
            status: "waiting_selection",
            message: (data.message as string) || "바이어 타겟을 선택해주세요",
            progress: 60,
            mode: currentMode,
            websiteAnalysis: currentAnalysis,
            recommendations: currentRecommendations,
            sessionId: sessionIdRef.current,
          }
          options.onStatusChange?.(eventData)
          lastEventData = eventData
          log.info(`Interrupt processed: ${currentRecommendations.length} recommendations`)
        } else {
          log.error("Interrupt received but no recommendations found", data)
        }
        break
      }

      case "complete": {
        const results = (data.results as BigQueryResult[]) || []
        const totalCount = (data.totalCount as number) || results.length
        const selectedRec = data.selectedRecommendation as BuyerRecommendation | undefined

        log.info(`Complete: ${results.length}/${totalCount} results`, {
          mode: currentMode,
          hasSelectedRec: !!selectedRec,
        })

        options.onResults?.(results, totalCount)

        const eventData: LeadDiscoveryEventData = {
          status: "complete",
          message: `${results.length}개 리드 탐색 완료`,
          progress: 100,
          mode: currentMode,
          websiteAnalysis: currentAnalysis,
          recommendations: currentRecommendations,
          selectedRecommendation: selectedRec,
          results,
          totalCount,
          sql: data.sql as string,
          explanation: data.explanation as string,
          sessionId: sessionIdRef.current,
        }
        options.onStatusChange?.(eventData)
        options.onComplete?.(eventData)
        lastEventData = eventData
        break
      }

      case "error": {
        const errorMsg = (data.error as string) || "알 수 없는 오류"
        log.error("SSE Error", errorMsg)
        options.onError?.(errorMsg)
        const eventData: LeadDiscoveryEventData = {
          status: "error",
          message: "오류가 발생했습니다",
          progress: 0,
          sessionId: sessionIdRef.current,
        }
        options.onStatusChange?.(eventData)
        lastEventData = eventData
        break
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // 완전한 SSE 블록 처리
    const lastDoubleNewline = buffer.lastIndexOf("\n\n")
    if (lastDoubleNewline !== -1) {
      const completeChunks = buffer.substring(0, lastDoubleNewline + 2)
      buffer = buffer.substring(lastDoubleNewline + 2)

      const events = parseSSEChunk(completeChunks)
      for (const { event, data: eventData } of events) {
        handleEvent(event, eventData as Record<string, unknown>)
      }
    }
  }

  // 남은 버퍼 처리
  if (buffer.trim()) {
    const events = parseSSEChunk(buffer)
    for (const { event, data: eventData } of events) {
      handleEvent(event, eventData as Record<string, unknown>)
    }
  }

  return lastEventData
}

/**
 * TanStack Query mutation for lead discovery search
 * 챗봇과 동일한 패턴의 콜백 기반 스트리밍 처리
 */
export function useLeadDiscoveryMutation(options: UseLeadDiscoveryMutationOptions) {
  const sessionIdRef = { current: undefined as string | undefined }

  return useMutation({
    mutationKey: ["lead-discovery", "search"],
    mutationFn: async (request: SearchRequest) => {
      const url = `${BASE_URL}/api/v1/lead-discovery/search`
      log.request("Search", { url, query: request.query, workspaceId: request.workspaceId })

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            query: request.query,
            workspaceId: request.workspaceId,
            locale: request.locale || "ko",
          }),
        })

        log.response("HTTP Response", { status: response.status, ok: response.ok })

        if (!response.ok) {
          const errorText = await response.text()
          log.error("HTTP Error", { status: response.status, body: errorText })
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return processSSEStream(response, options, sessionIdRef)
      } catch (error) {
        log.error("Fetch failed", error)
        throw error
      }
    },
    retry: 1,
    retryDelay: 1000,
  })
}

/**
 * TanStack Query mutation for recommendation selection
 * 바이어 추천 선택 후 검색 재개
 */
export function useLeadDiscoverySelectMutation(options: UseLeadDiscoveryMutationOptions) {
  const sessionIdRef = { current: undefined as string | undefined }

  return useMutation({
    mutationKey: ["lead-discovery", "select"],
    mutationFn: async (request: SelectRequest) => {
      sessionIdRef.current = request.sessionId
      const url = `${BASE_URL}/api/v1/lead-discovery/select`

      log.request("Select", {
        url,
        sessionId: request.sessionId,
        recommendationId: request.selectedRecommendationId,
      })

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            sessionId: request.sessionId,
            selectedRecommendationId: request.selectedRecommendationId,
            workspaceId: request.workspaceId,
          }),
        })

        log.response("HTTP Response", { status: response.status, ok: response.ok })

        if (!response.ok) {
          const errorText = await response.text()
          log.error("HTTP Error", { status: response.status, body: errorText })
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return processSSEStream(response, options, sessionIdRef)
      } catch (error) {
        log.error("Select fetch failed", error)
        throw error
      }
    },
    retry: 1,
    retryDelay: 1000,
  })
}

// Query Keys (향후 히스토리 기능용)
export const leadDiscoveryKeys = {
  all: ["lead-discovery"] as const,
  search: () => [...leadDiscoveryKeys.all, "search"] as const,
  select: () => [...leadDiscoveryKeys.all, "select"] as const,
}

// ============================================
// Fit Score API
// ============================================

export interface LeadForScoring {
  id: string
  company_name?: string
  email?: string
  phone?: string
  web_address?: string
  country?: string
  industry?: string
  sub_industry?: string
  employee?: string
  revenue?: string
  title?: string
}

export interface FitScoreCallbackOptions {
  onScore?: (leadId: string, score: number) => void
  onProgress?: (progress: number) => void
  onComplete?: (totalProcessed: number) => void
  onError?: (error: string) => void
}

/**
 * AI 기반 적합도 계산 API 호출
 * SSE 스트리밍으로 각 리드별 점수를 실시간으로 받아옴
 */
export async function calculateFitScores(
  leads: LeadForScoring[],
  websiteAnalysis: {
    companyName?: string
    description?: string
    industry?: string
    products?: string[]
    targetMarkets?: string[]
    businessModel?: string
  },
  selectedTarget: { country: string; industry: string },
  callbacks: FitScoreCallbackOptions,
): Promise<void> {
  const url = `${BASE_URL}/api/v1/lead-discovery/score`

  log.request("FitScore", { leadCount: leads.length, target: selectedTarget })

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        leads,
        websiteAnalysis,
        selectedTarget,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error("스트림을 읽을 수 없습니다")

    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 이벤트 파싱
      const lastDoubleNewline = buffer.lastIndexOf("\n\n")
      if (lastDoubleNewline !== -1) {
        const completeChunks = buffer.substring(0, lastDoubleNewline + 2)
        buffer = buffer.substring(lastDoubleNewline + 2)

        const events = parseSSEChunk(completeChunks)
        for (const { event, data } of events) {
          const eventData = data as Record<string, unknown>

          switch (event) {
            case "score":
              callbacks.onScore?.(eventData.leadId as string, eventData.score as number)
              callbacks.onProgress?.(eventData.progress as number)
              break
            case "complete":
              callbacks.onComplete?.(eventData.totalProcessed as number)
              break
            case "error":
              callbacks.onError?.(eventData.error as string)
              break
          }
        }
      }
    }

    log.response("FitScore complete", { leadCount: leads.length })
  } catch (error) {
    log.error("FitScore failed", error)
    callbacks.onError?.(error instanceof Error ? error.message : "적합도 계산 실패")
  }
}

// ============================================
// Lead Enrichment API (Jina Reader + Gemini)
// ============================================

export interface EnrichmentResult {
  domain: string
  emails: Array<{
    value: string
    type: string
    confidence?: number
  }>
  companyInfo: {
    name?: string
    description?: string
    industry?: string
    size?: string
    founded?: string
    location?: string
  }
  socialLinks: {
    linkedin?: string
    twitter?: string
    facebook?: string
  }
  rawContent?: string
}

export interface EnrichLeadRequest {
  webAddress: string
  companyName: string
}

export interface EnrichLeadResponse {
  success: boolean
  data: EnrichmentResult | null
  error?: string
}

// 단일 리드 enrichment
export const enrichLead = async (
  webAddress: string,
  companyName: string,
): Promise<EnrichLeadResponse> => {
  const response = await fetch(`${BASE_URL}/api/v1/lead-enrichment/enrich`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ webAddress, companyName }),
  })

  if (!response.ok) {
    throw new Error(`Enrichment failed: ${response.status}`)
  }

  return response.json()
}

// 여러 리드 enrichment (순차 처리)
export const enrichLeads = async (
  leads: Array<{ id: string; webAddress: string; companyName: string }>,
  callbacks: {
    onProgress?: (completed: number, total: number, current: string) => void
    onResult?: (leadId: string, result: EnrichmentResult) => void
    onError?: (leadId: string, error: string) => void
    onComplete?: () => void
  },
): Promise<void> => {
  const total = leads.length

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    callbacks.onProgress?.(i, total, lead.companyName)

    try {
      const response = await enrichLead(lead.webAddress, lead.companyName)
      if (response.success && response.data) {
        callbacks.onResult?.(lead.id, response.data)
      } else {
        callbacks.onError?.(lead.id, response.error || "Unknown error")
      }
    } catch (error) {
      callbacks.onError?.(lead.id, error instanceof Error ? error.message : "Failed to enrich")
    }
  }

  callbacks.onComplete?.()
}
