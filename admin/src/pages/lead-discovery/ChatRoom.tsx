/**
 * ChatRoom Component (Optimized)
 * - Jotai 기반 메시지 상태 (레이아웃 전환 시에도 유지)
 * - TanStack Query mutation 사용
 * - 스트리밍 메시지 분리
 */

import { motion } from "framer-motion"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  ArrowRight,
  Check,
  ChevronDown,
  FolderPlus,
  Globe,
  Loader2,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { useNavigate } from "react-router-dom"
import TextPlus from "@/assets/text-plus.svg"
import TextRinda from "@/assets/text-rinda.svg"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useCreateCustomerGroup } from "@/lib/api/hooks/customer-groups"
import {
  enrichLeads,
  type LeadDiscoveryEventData,
  useLeadDiscoveryClarifyMutation,
  useLeadDiscoveryMutation,
  useLeadDiscoverySelectMutation,
} from "@/lib/api/hooks/lead-discovery"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { BigQueryResult, BuyerRecommendation } from "@/lib/api/types/lead-discovery"
import { useAuth } from "@/lib/auth-provider"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { BuyerRecommendationCards } from "./components/BuyerRecommendationCards"
import { ClarificationCards } from "./components/ClarificationCards"
import { FilterSearchForm } from "./components/FilterSearchForm"
import { LeadDiscoveryProgress } from "./components/LeadDiscoveryProgress"
import {
  addChatMessageAtom,
  bulkEnrichmentStateAtom,
  type ChatMessage,
  type Customer,
  chatMessagesAtom,
  createGroupStateAtom,
  customersAtom,
  finishBulkEnrichmentAtom,
  finishCreateGroupAtom,
  finishEnrichmentAtom,
  initialStreamingState,
  resetAllAtom,
  resetSearchStateAtom,
  selectedTargetAtom,
  setCustomersAtom,
  startBulkEnrichmentAtom,
  startCreateGroupAtom,
  startEnrichmentAtom,
  streamingStateAtom,
  updateBulkEnrichmentProgressAtom,
  updateChatMessageAtom,
  updateCustomerAtom,
} from "./store"

// 코드 펜스 제거 유틸리티 (GPT가 ```markdown 으로 감싸는 경우 대비)
function stripCodeFences(text: string): string {
  let result = text
  result = result.replace(/^```(?:markdown)?\s*\n?/i, "")
  result = result.replace(/\n?```\s*$/i, "")
  return result
}

type SearchMode = "website" | "detailed"

export function ChatRoom() {
  const navigate = useNavigate()

  // ============================================
  // Jotai 상태 사용 (LeadDiscoveryPage와 동기화)
  // ============================================
  const messages = useAtomValue(chatMessagesAtom)
  const addMessageToStore = useSetAtom(addChatMessageAtom)
  const updateMessageInStore = useSetAtom(updateChatMessageAtom)

  const resetAll = useSetAtom(resetAllAtom)

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
  const setCustomers = useSetAtom(setCustomersAtom)
  const customers = useAtomValue(customersAtom)
  const updateCustomer = useSetAtom(updateCustomerAtom)
  const resetSearchState = useSetAtom(resetSearchStateAtom)

  // Bulk Enrichment 상태 (프로필 고도화)
  const bulkEnrichmentState = useAtomValue(bulkEnrichmentStateAtom)
  const startBulkEnrichment = useSetAtom(startBulkEnrichmentAtom)
  const updateBulkEnrichmentProgress = useSetAtom(updateBulkEnrichmentProgressAtom)
  const finishBulkEnrichment = useSetAtom(finishBulkEnrichmentAtom)
  const startEnrichment = useSetAtom(startEnrichmentAtom)
  const finishEnrichment = useSetAtom(finishEnrichmentAtom)

  // Create Group 상태 (새 고객그룹으로 추가하기)
  const createGroupState = useAtomValue(createGroupStateAtom)
  const startCreateGroup = useSetAtom(startCreateGroupAtom)
  const finishCreateGroup = useSetAtom(finishCreateGroupAtom)

  // Jotai 스트리밍 상태 (리마운트 시에도 유지)
  const [streamingState, setStreamingState] = useAtom(streamingStateAtom)
  const setSelectedTarget = useSetAtom(selectedTargetAtom)
  const [input, setInput] = useState("")
  const [searchMode, setSearchMode] = useState<SearchMode>("website")

  // 워크스페이스 선택 대기 중인 쿼리 (워크스페이스 선택 후 자동 검색용)
  // localStorage 사용: HMR/리렌더링에도 값 유지
  const getPendingQuery = useCallback(
    () => localStorage.getItem("lead-discovery-pending-query"),
    [],
  )
  const setPendingQuery = useCallback((query: string | null) => {
    if (query) {
      localStorage.setItem("lead-discovery-pending-query", query)
    } else {
      localStorage.removeItem("lead-discovery-pending-query")
    }
  }, [])

  // 새 검색 핸들러 - 모든 상태 초기화
  const handleNewSearch = useCallback(() => {
    resetAll()
    setStreamingState(initialStreamingState)
    setInput("")
  }, [resetAll, setStreamingState])

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 워크스페이스
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspace()
  const { user } = useAuth()
  const { data: userWorkspaces } = useUserWorkspaces(user?.id || "", !!user?.id)
  const workspaces = userWorkspaces || []

  // 워크스페이스 선택 핸들러 (pendingQuery가 있으면 자동 검색 실행)
  const handleSelectWorkspace = useCallback(
    (workspaceId: string, workspaceName: string) => {
      console.log("[ChatRoom] handleSelectWorkspace called:", { workspaceId, workspaceName })

      // localStorage 업데이트
      localStorage.setItem("selectedWorkspace", workspaceId)
      localStorage.setItem("selectedWorkspaceName", workspaceName)

      // useWorkspace의 state 직접 업데이트 (새로고침 방지)
      setSelectedWorkspace({ id: workspaceId, name: workspaceName })

      const now = Date.now()

      // pendingQuery를 localStorage에서 확인
      const savedQuery = getPendingQuery()
      console.log("[ChatRoom] Checking pendingQuery:", savedQuery)

      if (savedQuery) {
        console.log("[ChatRoom] Found pendingQuery, executing search:", savedQuery)
        setPendingQuery(null) // 먼저 초기화

        // 검색 시작 메시지 추가
        const confirmMessage: ChatMessage = {
          id: `msg-${now}-workspace-selected`,
          role: "assistant",
          content: `**${workspaceName}** 워크스페이스가 선택되었습니다.\n\n"${savedQuery}" 검색을 시작합니다...`,
          timestamp: new Date(now),
        }
        addMessage(confirmMessage)

        // 약간의 지연 후 검색 실행 (state 업데이트 반영)
        setTimeout(() => {
          console.log("[ChatRoom] Dispatching executeSearch event")
          // 검색 실행을 위한 이벤트 디스패치
          window.dispatchEvent(
            new CustomEvent("executeSearch", {
              detail: { query: savedQuery, workspaceId },
            }),
          )
        }, 100)
      } else {
        console.log("[ChatRoom] No pendingQuery found")
        // pendingQuery가 없으면 기존 동작
        const confirmMessage: ChatMessage = {
          id: `msg-${now}-workspace-selected`,
          role: "assistant",
          content: `**${workspaceName}** 워크스페이스가 선택되었습니다.\n\n이제 검색을 진행해주세요! 🚀`,
          timestamp: new Date(now),
        }
        addMessage(confirmMessage)
      }
    },
    [addMessage, setSelectedWorkspace, getPendingQuery, setPendingQuery],
  )

  // 고객 그룹 생성 mutation
  const createGroupMutation = useCreateCustomerGroup()

  // 프로필 고도화 핸들러 (100개 리드 Enrichment)
  const handleBulkEnrichment = useCallback(async () => {
    // 웹사이트가 있고 아직 enrichment 되지 않은 리드만
    const leadsToEnrich = customers.filter((c) => c.web_address && !c.verified).slice(0, 100)

    if (leadsToEnrich.length === 0) {
      return
    }

    const workspaceId = selectedWorkspace?.id || ""
    startBulkEnrichment(leadsToEnrich.length)
    startEnrichment(leadsToEnrich.map((c) => c.id))

    await enrichLeads(
      leadsToEnrich.map((c) => ({
        id: c.id,
        webAddress: c.web_address || "",
        companyName: c.company_name || "",
      })),
      workspaceId,
      {
        onProgress: (completed, _total, name) => {
          updateBulkEnrichmentProgress(completed, name)
        },
        onResult: (leadId, result) => {
          updateCustomer(leadId, {
            verified: true,
            description: result.description,
            ...(result.companyType && { companyType: result.companyType }),
            ...(result.email && { email: result.email }),
            ...(result.phoneNumber && { phone: result.phoneNumber }),
            ...(result.address && { address: result.address }),
            ...(result.city && { city: result.city }),
            ...(result.state && { state: result.state }),
            ...(result.foundedYear && { foundedYear: result.foundedYear }),
            ...(result.employeeCount && { employee: result.employeeCount }),
            ...(result.linkedinUrl && { linkedinUrl: result.linkedinUrl }),
            ...(result.facebookUrl && { facebookUrl: result.facebookUrl }),
            ...(result.instagramUrl && { instagramUrl: result.instagramUrl }),
            ...(result.twitterUrl && { twitterUrl: result.twitterUrl }),
            ...(result.products && { products: result.products }),
            ...(result.businessSectors && { businessSectors: result.businessSectors }),
          })
          finishEnrichment(leadId)
        },
        onError: (leadId, error) => {
          console.error(`Enrichment failed for ${leadId}:`, error)
          finishEnrichment(leadId, error)
        },
        onComplete: () => {
          finishBulkEnrichment()
        },
      },
    )
  }, [
    customers,
    selectedWorkspace?.id,
    startBulkEnrichment,
    startEnrichment,
    updateBulkEnrichmentProgress,
    updateCustomer,
    finishEnrichment,
    finishBulkEnrichment,
  ])

  // 새 고객그룹으로 추가하기 핸들러
  const handleCreateGroup = useCallback(async () => {
    if (!selectedWorkspace?.id || selectedWorkspace.id === "all") {
      return
    }
    if (customers.length === 0) {
      return
    }

    // 그룹 이름 생성: 리드탐색_YYYYMMDDHHMMSS
    const now = new Date()
    const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14)
    const groupName = `리드탐색_${timestamp}`

    startCreateGroup(groupName, customers.length)

    try {
      // Customer를 csvData 형식으로 변환
      const csvData = customers.map((c) => ({
        companyName: c.company_name || "",
        websiteUrl: c.web_address || "",
        description: c.description || "",
        country: c.country || "",
        businessType: c.companyType || c.category || "",
        employeeCount: c.employee || "",
        foundedYear: c.foundedYear ? Number.parseInt(c.foundedYear, 10) : undefined,
        city: c.city || "",
        state: c.state || "",
        address: c.address || "",
        leadSource: "Lead Discovery",
        leadScore: c.fit_score || 0,
        primaryEmail: c.email || "",
        primaryPhone: c.phone || "",
      }))

      const result = await createGroupMutation.mutateAsync({
        workspaceId: selectedWorkspace.id,
        name: groupName,
        description: `Lead Discovery에서 탐색한 ${customers.length}개의 리드`,
        isDynamic: false,
        csvData,
      })

      finishCreateGroup({ groupId: result.id })
    } catch (error) {
      console.error("Failed to create group:", error)
      finishCreateGroup({
        error: error instanceof Error ? error.message : "그룹 생성에 실패했습니다",
      })
    }
  }, [customers, selectedWorkspace?.id, startCreateGroup, finishCreateGroup, createGroupMutation])

  // 페이지 로드 시 미완성된 빈 assistant 메시지 정리 (마운트 시 한 번만 실행)
  const cleanupIncompleteMessagesRef = useRef(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally run only on mount
  useEffect(() => {
    if (cleanupIncompleteMessagesRef.current) {
      return
    }
    cleanupIncompleteMessagesRef.current = true

    // 스트리밍이 진행 중이 아닌데 빈 assistant 메시지가 있으면 제거
    const incompleteMessages = messages.filter(
      (m) => m.role === "assistant" && !m.content && m.id !== streamingState.messageId,
    )
    if (incompleteMessages.length > 0 && streamingState.status === "idle") {
      const validMessages = messages.filter((m) => !(m.role === "assistant" && !m.content))
      if (validMessages.length !== messages.length) {
        // 로컬스토리지 직접 업데이트
        const toStore = validMessages.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
        }))
        localStorage.setItem("lead-discovery-chat-messages", JSON.stringify(toStore))
      }
    }
  }, [])

  // BigQuery 결과를 Customer 형식으로 변환
  // 컬럼 순서: 회사명, 웹사이트, Description, Fit Score, Country, Category, Main Industry, Sub Industry, Company Email
  const convertResultsToCustomers = useCallback((results: BigQueryResult[]): Customer[] => {
    return results.map((r, idx) => ({
      id: `lead-${Date.now()}-${idx}`,
      company_name: r.companyName,
      web_address: r.webAddress,
      description: r.description || "-",
      fit_score: r.fitScore,
      country: r.country,
      category: r.category || "-",
      industry: r.mainIndustry, // main industry
      sub_industry: r.subIndustry || "-",
      email: r.email,
      phone: r.phone,
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
    onClarificationRequired: (clarificationData, sessionId) => {
      console.log("[ChatRoom] Clarification required:", clarificationData)
      setStreamingState((prev) => ({
        ...prev,
        clarificationData,
        sessionId,
      }))
    },
    onResults: (results, totalCount) => {
      console.log("[ChatRoom] Lead discovery results:", totalCount)
      const newCustomers = convertResultsToCustomers(results)
      setCustomers(newCustomers) // Replace instead of append for new search

      // "원하는 조건으로 찾기" 모드에서 FitScore 계산을 위해 selectedTarget 자동 설정
      if (results.length > 0) {
        const firstResult = results[0]
        if (firstResult?.country || firstResult?.mainIndustry) {
          setSelectedTarget({
            country: firstResult.country || "All",
            industry: firstResult.mainIndustry || "All",
            subIndustry: firstResult.subIndustry || undefined,
          })
          console.log("[ChatRoom] Auto-set selectedTarget from results:", {
            country: firstResult.country,
            industry: firstResult.mainIndustry,
          })
        }
      }
    },
    onComplete: (data) => {
      // 스트리밍 메시지를 완료된 메시지로 변환
      const recInfo = data.selectedRecommendation
        ? `**선택한 타겟**: ${data.selectedRecommendation.country} / ${data.selectedRecommendation.industry}\n\n`
        : ""

      setStreamingState((prev) => {
        if (prev.messageId) {
          // 분석 결과를 메시지에 포함 (코드 펜스 제거)
          const cleanAnalysis = prev.analysisSummary ? stripCodeFences(prev.analysisSummary) : ""
          const cleanCustomerAnalysis = prev.customerAnalysisSummary
            ? stripCodeFences(prev.customerAnalysisSummary)
            : ""

          const analysisPart = cleanAnalysis
            ? `---\n\n### 📊 웹사이트 분석 리포트\n\n${cleanAnalysis}\n\n`
            : ""
          const customerAnalysisPart = cleanCustomerAnalysis
            ? `---\n\n### 👥 잠재 바이어 분석 리포트\n\n${cleanCustomerAnalysis}\n\n`
            : ""

          updateMessage(prev.messageId, {
            content: `${recInfo}**${(data.totalCount ?? 0).toLocaleString()}개 리드**를 탐색했습니다.\n\n오른쪽 테이블에서 결과를 확인하세요.\n\n${analysisPart}${customerAnalysisPart}`,
          })
        }
        // status와 messageId를 유지하여 퀵액션 UI가 표시되도록 함
        // 더 가져오기 정보도 포함
        // userQuery도 유지하여 FitScore 계산에 사용
        return {
          ...initialStreamingState,
          status: "complete" as const,
          messageId: prev.messageId,
          sessionId: data.sessionId,
          hasMore: data.hasMore,
          totalAvailable: data.totalAvailable,
          loadedOffset: 100, // 초기 100개 로드됨
          userQuery: prev.userQuery, // FitScore 계산용 쿼리 유지
        }
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

  // 워크스페이스 선택 후 자동 검색 실행을 위한 이벤트 리스너
  useEffect(() => {
    const handleExecuteSearch = (e: CustomEvent<{ query: string; workspaceId: string }>) => {
      const { query, workspaceId } = e.detail
      console.log("[ChatRoom] Executing pending search:", query)

      const now = Date.now()

      // 빈 assistant 메시지 추가 (스트리밍용)
      const assistantMessageId = `msg-${now}-response`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(now),
      }
      addMessage(assistantMessage)

      // 스트리밍 상태 초기화
      setStreamingState({
        messageId: assistantMessageId,
        analysisMessageId: assistantMessageId,
        status: "connecting",
        message: "서버에 연결 중...",
        progress: 0,
        recommendations: [],
        analyzedPages: [],
        analysisSummary: "",
        customerAnalysisSummary: "",
        userQuery: query,
      })

      // LangGraph API 호출
      searchMutation.mutate({
        query,
        workspaceId,
      })
    }

    window.addEventListener("executeSearch", handleExecuteSearch as EventListener)
    return () => {
      window.removeEventListener("executeSearch", handleExecuteSearch as EventListener)
    }
  }, [addMessage, searchMutation, setStreamingState])

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
      const newCustomers = convertResultsToCustomers(results)
      setCustomers(newCustomers) // Replace instead of append for selection results
    },
    onComplete: (data) => {
      const recInfo = data.selectedRecommendation
        ? `**선택한 타겟**: ${data.selectedRecommendation.country} / ${data.selectedRecommendation.industry}\n\n`
        : ""

      setStreamingState((prev) => {
        // 검색 결과를 응답 메시지(messageId)에 포함
        if (prev.messageId) {
          updateMessage(prev.messageId, {
            content: `${recInfo}**${(data.totalCount ?? 0).toLocaleString()}개 리드**를 탐색했습니다.\n\n오른쪽 테이블에서 결과를 확인하세요.`,
          })
        }

        // 웹사이트 분석 결과와 추천 카드는 유지하고, 상태만 완료로 변경
        // 더 가져오기 정보도 포함
        return {
          ...prev,
          status: "complete" as const,
          message: "",
          progress: 100,
          sessionId: data.sessionId,
          hasMore: data.hasMore,
          totalAvailable: data.totalAvailable,
          loadedOffset: 100, // 초기 100개 로드됨
        }
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

  // Clarify mutation for handling clarification answers
  const clarifyMutation = useLeadDiscoveryClarifyMutation({
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
      console.log("[ChatRoom] Clarify results:", totalCount)
      const newCustomers = convertResultsToCustomers(results)
      setCustomers(newCustomers)
    },
    onComplete: (data) => {
      setStreamingState((prev) => {
        if (prev.messageId) {
          updateMessage(prev.messageId, {
            content: `**${(data.totalCount ?? 0).toLocaleString()}개 리드**를 탐색했습니다.\n\n오른쪽 테이블에서 결과를 확인하세요.`,
          })
        }

        return {
          ...prev,
          status: "complete" as const,
          message: "",
          progress: 100,
          sessionId: data.sessionId,
          hasMore: data.hasMore,
          totalAvailable: data.totalAvailable,
          loadedOffset: 100,
          clarificationData: undefined, // Clear clarification data after completion
        }
      })
    },
    onError: (error) => {
      console.error("[ChatRoom] Clarify error:", error)
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
  const isSearching =
    searchMutation.isPending || selectMutation.isPending || clarifyMutation.isPending
  const isWaitingSelection = streamingState.status === "waiting_selection"
  const isWaitingClarification = streamingState.status === "waiting_clarification"

  // Markdown components for consistent styling
  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mb-4 leading-relaxed last:mb-0">{children}</p>
      ),
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="mt-6 mb-4 font-bold text-2xl first:mt-0">{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="mt-5 mb-3 font-bold text-xl first:mt-0">{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="mt-4 mb-2 font-semibold text-lg first:mt-0">{children}</h3>
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
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
        ) : (
          <code className="font-mono text-sm">{children}</code>
        )
      },
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-3">{children}</pre>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="mb-4 border-border border-l-4 pl-4 text-muted-foreground italic">
          {children}
        </blockquote>
      ),
      a: (
        props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode },
      ) => (
        <a
          {...props}
          className="text-primary underline hover:text-primary/80"
          rel="noopener noreferrer"
          target="_blank"
        >
          {props.children}
        </a>
      ),
      strong: ({ children }: { children?: React.ReactNode }) => (
        <strong className="font-bold">{children}</strong>
      ),
      em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
      hr: () => <hr className="my-6 border-border" />,
    }),
    [],
  )

  // 스크롤 맨 아래로 - 메시지 추가시 자동 스크롤
  const scrollToBottom = useCallback(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message change
  useEffect(() => {
    scrollToBottom()
  }, [messages.length, messages, streamingState.status, streamingState.message, scrollToBottom])

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
    if (!trimmed) {
      return false
    }
    if (searchMode === "website") {
      return isValidWebsiteUrl(trimmed)
    }
    // 상세 조건 모드: 최소 2자 이상
    return trimmed.length >= 2
  }, [input, searchMode, isValidWebsiteUrl])

  // 모드 전환 시 입력값 초기화 (상세 -> 웹사이트 모드)
  const prevSearchModeRef = useRef<SearchMode>(searchMode)
  useEffect(() => {
    // 실제로 모드가 변경되었을 때만 초기화
    const modeChanged = prevSearchModeRef.current !== searchMode
    if (modeChanged && searchMode === "website" && input && !isValidWebsiteUrl(input)) {
      setInput("")
    }
    prevSearchModeRef.current = searchMode
  }, [searchMode, input, isValidWebsiteUrl])

  // 바이어 추천 선택 핸들러
  const handleRecommendationSelect = useCallback(
    async (rec: BuyerRecommendation) => {
      if (!selectedWorkspace?.id || selectedWorkspace.id === "all") {
        return
      }
      if (!streamingState.sessionId) {
        console.error("[ChatRoom] No session ID for selection")
        return
      }

      const now = Date.now()

      // 선택 메시지 추가
      const selectMessage: ChatMessage = {
        id: `msg-${now}-select`,
        role: "user",
        content: `${rec.country} / ${rec.industry} 선택`,
        timestamp: new Date(now),
      }
      addMessage(selectMessage)

      // 새 응답 메시지 추가 (1ms 후의 timestamp로 순서 보장)
      const responseId = `msg-${now + 1}-response`
      const responseMessage: ChatMessage = {
        id: responseId,
        role: "assistant",
        content: "",
        timestamp: new Date(now + 1),
      }
      addMessage(responseMessage)

      // 스트리밍 상태 업데이트 - 기존 데이터 유지하면서 선택 상태만 변경
      setStreamingState((prev) => ({
        ...prev,
        messageId: responseId,
        status: "searching",
        message: "검색 쿼리를 준비하고 있어요",
        progress: 65,
        selectedRecommendationId: rec.id, // 선택된 추천 ID 저장 (카드 유지)
        // recommendations, analysisSummary, analyzedPages 유지
      }))

      // 적합도 계산용 선택된 타겟 저장 (스트리밍 완료 후에도 유지)
      setSelectedTarget({
        country: rec.country,
        industry: rec.industry,
        subIndustry: rec.subIndustry,
      })

      // 선택 API 호출
      selectMutation.mutate({
        sessionId: streamingState.sessionId,
        selectedRecommendationId: rec.id,
        workspaceId: selectedWorkspace.id,
      })
    },
    [
      selectedWorkspace,
      streamingState.sessionId,
      addMessage,
      selectMutation,
      setStreamingState,
      setSelectedTarget,
    ],
  )

  // 확인 질문 답변 핸들러
  const handleClarificationSubmit = useCallback(
    (answers: Record<string, string>) => {
      if (!selectedWorkspace?.id || selectedWorkspace.id === "all") {
        return
      }
      if (!streamingState.sessionId) {
        console.error("[ChatRoom] No session ID for clarification")
        return
      }

      const now = Date.now()

      // 답변 메시지 추가
      const answerText = Object.entries(answers)
        .map(([field, value]) => `${field}: ${value}`)
        .join(", ")
      const answerMessage: ChatMessage = {
        id: `msg-${now}-clarify`,
        role: "user",
        content: answerText,
        timestamp: new Date(now),
      }
      addMessage(answerMessage)

      // 새 응답 메시지 추가
      const responseId = `msg-${now + 1}-response`
      const responseMessage: ChatMessage = {
        id: responseId,
        role: "assistant",
        content: "",
        timestamp: new Date(now + 1),
      }
      addMessage(responseMessage)

      // 스트리밍 상태 업데이트
      setStreamingState((prev) => ({
        ...prev,
        messageId: responseId,
        status: "searching",
        message: "검색 쿼리를 준비하고 있어요",
        progress: 40,
      }))

      // Clarify API 호출
      clarifyMutation.mutate({
        sessionId: streamingState.sessionId,
        answers,
        workspaceId: selectedWorkspace.id,
      })
    },
    [selectedWorkspace, streamingState.sessionId, addMessage, clarifyMutation, setStreamingState],
  )

  // 필터 검색 핸들러 (드롭다운 폼에서 호출)
  const handleFilterSearch = useCallback(
    (query: string) => {
      if (!query || isSearching) {
        return
      }

      const now = Date.now()
      const userMessage: ChatMessage = {
        id: `msg-${now}`,
        role: "user",
        content: query,
        timestamp: new Date(now),
      }

      addMessage(userMessage)

      // 워크스페이스 확인
      if (!selectedWorkspace?.id || selectedWorkspace.id === "all") {
        // 쿼리를 저장하여 워크스페이스 선택 후 자동 검색
        console.log("[ChatRoom] Setting pendingQuery (handleSearch):", query)
        setPendingQuery(query)
        const errorMessage: ChatMessage = {
          id: `msg-${now + 1}-error`,
          role: "assistant",
          content: "워크스페이스를 선택해주세요.\n\n아래에서 사용할 워크스페이스를 선택하세요.",
          timestamp: new Date(now + 1),
          type: "workspace_select",
        }
        addMessage(errorMessage)
        return
      }

      // 이전 검색 상태 초기화 (고객 목록, 적합도 점수 등)
      resetSearchState()

      // 빈 assistant 메시지 추가 (스트리밍용)
      const assistantMessageId = `msg-${now + 1}-response`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(now + 1),
      }
      addMessage(assistantMessage)

      // 스트리밍 상태 초기화
      setStreamingState({
        messageId: assistantMessageId,
        analysisMessageId: assistantMessageId,
        status: "connecting",
        message: "서버에 연결 중...",
        progress: 0,
        recommendations: [],
        analyzedPages: [],
        analysisSummary: "",
        customerAnalysisSummary: "",
        userQuery: query,
      })

      // LangGraph API 호출
      searchMutation.mutate({
        query,
        workspaceId: selectedWorkspace.id,
      })
    },
    [
      isSearching,
      selectedWorkspace,
      addMessage,
      searchMutation,
      setStreamingState,
      resetSearchState,
      setPendingQuery,
    ],
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      console.log("[ChatRoom] handleSubmit called", { input, isSearching, isValid: isInputValid() })

      if (!isInputValid() || isSearching) {
        console.log("[ChatRoom] Submit blocked", { isInputValid: isInputValid(), isSearching })
        return
      }

      const now = Date.now()
      const userInput = input.trim()
      const userMessage: ChatMessage = {
        id: `msg-${now}`,
        role: "user",
        content: userInput,
        timestamp: new Date(now),
      }

      console.log("[ChatRoom] Adding user message:", userMessage.id)
      addMessage(userMessage)
      setInput("")

      // 워크스페이스 확인
      if (!selectedWorkspace?.id || selectedWorkspace.id === "all") {
        console.log("[ChatRoom] No workspace selected")
        // 쿼리를 저장하여 워크스페이스 선택 후 자동 검색
        console.log("[ChatRoom] Setting pendingQuery (handleSubmit):", userInput)
        setPendingQuery(userInput)
        const errorMessage: ChatMessage = {
          id: `msg-${now + 1}-error`,
          role: "assistant",
          content: "워크스페이스를 선택해주세요.\n\n아래에서 사용할 워크스페이스를 선택하세요.",
          timestamp: new Date(now + 1),
          type: "workspace_select",
        }
        addMessage(errorMessage)
        return
      }

      console.log("[ChatRoom] Calling searchMutation", {
        query: userInput,
        workspaceId: selectedWorkspace.id,
      })

      // 이전 검색 상태 초기화 (고객 목록, 적합도 점수 등)
      resetSearchState()

      // 빈 assistant 메시지 먼저 추가 (스트리밍용) - 1ms 후의 timestamp로 순서 보장
      const assistantMessageId = `msg-${now + 1}-response`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date(now + 1),
      }
      addMessage(assistantMessage)

      // 스트리밍 상태 초기화
      setStreamingState({
        messageId: assistantMessageId,
        analysisMessageId: assistantMessageId, // 분석 결과가 표시될 메시지 ID
        status: "connecting",
        message: "서버에 연결 중...",
        progress: 0,
        recommendations: [],
        analyzedPages: [],
        analysisSummary: "",
        customerAnalysisSummary: "",
        userQuery: userInput, // 검색 쿼리 저장 (FitScore 계산용)
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
      resetSearchState,
      setPendingQuery,
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
      <div className="flex h-full min-h-0 flex-col border-border border-r bg-background">
        {/* 메시지 영역 - flex-1 + min-h-0으로 스크롤 영역 확보 */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {/* 메시지가 없고 검색 중이 아닐 때 → 템플릿 카드 표시 */}
          {messages.length === 0 && !isSearching ? (
            <div className="flex min-h-full items-center justify-center px-4 py-8">
              {/* 전체 콘텐츠를 하나로 묶어서 중앙 정렬 */}
              <div className="w-full space-y-6" style={{ maxWidth: "670px" }}>
                {/* 로고 */}
                <div className="flex items-center justify-center gap-2">
                  <img alt="RINDA" className="h-10 w-auto" src={TextRinda} />
                  <img alt="Plus" className="h-10 w-auto" src={TextPlus} />
                </div>

                {/* 카피라이팅 - 모드에 따라 다른 문구 */}
                <div className="space-y-2 text-center">
                  {searchMode === "website" ? (
                    <>
                      <p className="font-medium text-foreground/90 text-lg">
                        우리 회사 웹사이트 주소만 입력하세요
                      </p>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        AI가 우리 제품에 관심 있을 바이어를 찾아드려요
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-foreground/90 text-lg">
                        원하는 조건을 선택하세요
                      </p>
                      <p className="text-base text-muted-foreground leading-relaxed">
                        국가, 산업군을 선택하면 맞춤 바이어를 찾아드려요
                      </p>
                    </>
                  )}
                </div>

                {/* 모드 전환 탭 */}
                <div className="flex justify-center">
                  <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                    <button
                      className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors ${
                        searchMode === "website"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSearchMode("website")}
                      type="button"
                    >
                      <Globe className="h-4 w-4" />
                      웹사이트로 시작
                    </button>
                    <button
                      className={`flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors ${
                        searchMode === "detailed"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSearchMode("detailed")}
                      type="button"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      조건으로 찾기
                    </button>
                  </div>
                </div>

                {/* 입력 영역 - 모드에 따라 다른 UI */}
                <div className="w-full">
                  {searchMode === "website" ? (
                    // 웹사이트 모드: 기존 텍스트 입력
                    <form className="space-y-2" onSubmit={handleSubmit}>
                      <div className="overflow-hidden rounded-2xl border bg-background">
                        <textarea
                          className="min-h-[72px] w-full resize-none border-0 bg-transparent px-4 pt-4 pb-2 text-base outline-none placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isSearching}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSubmit(e)
                            }
                          }}
                          placeholder="https://www.example.com"
                          ref={inputRef}
                          rows={3}
                          value={input}
                        />
                        <div className="flex items-center justify-end px-4 pb-3">
                          <Button
                            className="gap-2"
                            disabled={isSearching || !isInputValid()}
                            size="sm"
                            type="submit"
                          >
                            {isSearching ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                분석 시작
                                <ArrowRight className="h-4 w-4" />
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      {/* 유효성 에러 메시지 */}
                      <div className="mt-1.5 min-h-[22px] px-1">
                        {input.trim() && !isValidWebsiteUrl(input) && (
                          <div className="text-red-500 text-sm dark:text-red-400">
                            웹사이트 주소를 확인해주세요 (예: https://www.example.com)
                          </div>
                        )}
                      </div>
                    </form>
                  ) : (
                    // 조건 검색 모드: 드롭다운 폼
                    <div className="rounded-2xl border bg-background p-5">
                      <FilterSearchForm
                        disabled={isSearching}
                        isLoading={isSearching}
                        onSubmit={handleFilterSearch}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              {/* 새 검색 버튼 헤더 */}
              <div className="flex-shrink-0 border-border/50 border-b bg-background/95 px-4 pt-3 pb-2 backdrop-blur-sm">
                <Button
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleNewSearch}
                  size="sm"
                  variant="outline"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" />새 검색
                </Button>
              </div>
              <ScrollArea
                className="[&>[data-radix-scroll-area-viewport]]:!overflow-y-scroll min-h-0 flex-1"
                ref={scrollRef}
              >
                <div className="space-y-4 p-4 pt-4">
                  {/* 검색 중이고 메시지가 없을 때만 상단에 progress 표시 (메시지가 있으면 메시지 내부에서 표시) */}
                  {isSearching && messages.length === 0 && (
                    <div className="flex justify-start">
                      <div className="w-full space-y-4">
                        <LeadDiscoveryProgress
                          analyzedPages={streamingState.analyzedPages}
                          className="max-w-2xl"
                          customerAnalysisSummary={streamingState.customerAnalysisSummary}
                          message={streamingState.message}
                          mode={streamingState.mode}
                          status={streamingState.status}
                        />
                      </div>
                    </div>
                  )}
                  {messages
                    // 시간순 정렬 (로딩 중에도 올바른 순서 유지)
                    .slice()
                    .sort(
                      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                    )
                    .filter((message) => {
                      // 빈 assistant 메시지는 스트리밍 메시지 또는 분석 메시지가 아닐 때만 필터링
                      if (
                        message.role === "assistant" &&
                        !message.content &&
                        message.id !== streamingState.messageId &&
                        message.id !== streamingState.analysisMessageId
                      ) {
                        return false
                      }
                      return true
                    })
                    .map((message) => (
                      <div
                        className={cn(
                          "flex",
                          message.role === "user" ? "justify-end" : "justify-start",
                        )}
                        key={message.id}
                      >
                        {message.role === "user" ? (
                          <div className="max-w-[85%] rounded-lg bg-zinc-100 px-4 py-2.5 text-foreground dark:bg-zinc-800">
                            <p className="whitespace-pre-wrap text-base">{message.content}</p>
                          </div>
                        ) : (
                          <div className="w-full space-y-4">
                            {/* LangGraph 진행 상태 표시 */}
                            {message.id === streamingState.messageId && (
                              <>
                                {/* 웹사이트 분석 중일 때 (선택 후에는 표시 안 함) */}
                                {streamingState.status !== "idle" &&
                                  streamingState.status !== "complete" &&
                                  streamingState.status !== "waiting_selection" &&
                                  !streamingState.selectedRecommendationId && (
                                    <LeadDiscoveryProgress
                                      analyzedPages={streamingState.analyzedPages}
                                      className="max-w-2xl"
                                      customerAnalysisSummary={
                                        streamingState.customerAnalysisSummary
                                      }
                                      message={streamingState.message}
                                      mode={streamingState.mode}
                                      status={streamingState.status}
                                    />
                                  )}

                                {/* 선택 후 검색 중 로딩 UI */}
                                {isSearching && streamingState.selectedRecommendationId && (
                                  <motion.div
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3 py-4"
                                    initial={{ opacity: 0, y: 10 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="text-base text-muted-foreground">
                                      선택하신 타겟에 맞는 바이어를 찾고 있어요
                                    </span>
                                  </motion.div>
                                )}
                              </>
                            )}

                            {/* 메시지 콘텐츠 (검색 결과 등 - 분석 리포트는 BuyerRecommendationCards 내부에서 표시) */}
                            {message.content && (
                              <div className="prose prose-sm dark:prose-invert max-w-none text-base">
                                <ReactMarkdown components={markdownComponents}>
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}

                            {/* 워크스페이스 선택 UI */}
                            {message.type === "workspace_select" && workspaces.length > 0 && (
                              <div className="mt-4 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  {workspaces.map((ws) => (
                                    <Button
                                      className="gap-1.5"
                                      key={ws.id}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleSelectWorkspace(ws.id, ws.name)
                                      }}
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                    >
                                      <Globe className="h-3.5 w-3.5" />
                                      {ws.name}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 워크스페이스가 없는 경우 생성 안내 */}
                            {message.type === "workspace_select" && workspaces.length === 0 && (
                              <div className="mt-4 rounded-lg border border-border/50 bg-muted/50 p-4">
                                <p className="mb-3 text-muted-foreground text-sm">
                                  아직 워크스페이스가 없습니다. 워크스페이스를 먼저 생성해주세요.
                                </p>
                                <Button
                                  className="gap-1.5"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    navigate("/settings/workspaces")
                                  }}
                                  size="sm"
                                  type="button"
                                  variant="default"
                                >
                                  <FolderPlus className="h-3.5 w-3.5" />
                                  워크스페이스 생성하기
                                </Button>
                              </div>
                            )}

                            {/* 바이어 추천 선택 UI - 첫 번째 응답 메시지에 표시 (분석 중, 추천 중, 선택 후 모두 유지) */}
                            {message.id === streamingState.analysisMessageId &&
                              (streamingState.status === "analyzing" ||
                                streamingState.status === "recommending" ||
                                streamingState.status === "complete" ||
                                (streamingState.recommendations.length > 0 &&
                                  (isWaitingSelection ||
                                    streamingState.selectedRecommendationId))) && (
                                <BuyerRecommendationCards
                                  analysisSummary={streamingState.analysisSummary}
                                  className="max-w-2xl"
                                  disabled={
                                    isSearching || !!streamingState.selectedRecommendationId
                                  }
                                  isAnalysisComplete={
                                    isWaitingSelection ||
                                    streamingState.status === "complete" ||
                                    !!streamingState.selectedRecommendationId
                                  }
                                  isAnalyzing={
                                    streamingState.status === "analyzing" ||
                                    streamingState.status === "recommending"
                                  }
                                  isLoadingRecommendations={
                                    streamingState.status === "recommending"
                                  }
                                  onSelect={handleRecommendationSelect}
                                  recommendations={streamingState.recommendations}
                                  selectedId={streamingState.selectedRecommendationId}
                                />
                              )}

                            {/* 확인 질문 UI - 모호한 검색어에 대해 확인 질문 표시 */}
                            {message.id === streamingState.messageId &&
                              isWaitingClarification &&
                              streamingState.clarificationData && (
                                <ClarificationCards
                                  clarificationData={streamingState.clarificationData}
                                  className="max-w-2xl"
                                  disabled={isSearching}
                                  isSubmitting={clarifyMutation.isPending}
                                  onSubmit={handleClarificationSubmit}
                                />
                              )}

                            {/* 프로필 고도화 퀵액션 - 검색 완료 후 마지막 응답 메시지에 표시 */}
                            {message.id === streamingState.messageId &&
                              streamingState.status === "complete" &&
                              customers.length > 0 &&
                              !bulkEnrichmentState.isRunning && (
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
                                  initial={{ opacity: 0, y: 10 }}
                                  transition={{ duration: 0.3, delay: 0.5 }}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                      <Sparkles className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">프로필 고도화</p>
                                      <p className="mt-1 text-muted-foreground text-sm">
                                        {
                                          customers.filter((c) => c.web_address && !c.verified)
                                            .length
                                        }
                                        개 리드의 상세 정보를 AI로 추출합니다
                                      </p>
                                      <Button
                                        className="mt-3 gap-2"
                                        onClick={handleBulkEnrichment}
                                        size="sm"
                                      >
                                        <Sparkles className="h-4 w-4" />
                                        프로필 고도화 시작
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                            {/* 프로필 고도화 진행 상태 */}
                            {message.id === streamingState.messageId &&
                              bulkEnrichmentState.isRunning && (
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4"
                                  initial={{ opacity: 0, y: 10 }}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">
                                        프로필 고도화 진행 중
                                      </p>
                                      <div className="mt-2">
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                          <span className="max-w-[200px] truncate text-muted-foreground">
                                            {bulkEnrichmentState.currentCompany || "준비 중..."}
                                          </span>
                                          <span className="font-medium text-primary">
                                            {Math.round(
                                              (bulkEnrichmentState.completed /
                                                bulkEnrichmentState.total) *
                                                100,
                                            )}
                                            %
                                          </span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-primary/10">
                                          <motion.div
                                            animate={{
                                              width: `${(bulkEnrichmentState.completed / bulkEnrichmentState.total) * 100}%`,
                                            }}
                                            className="h-full rounded-full bg-primary"
                                            initial={{ width: 0 }}
                                            transition={{ duration: 0.3 }}
                                          />
                                        </div>
                                        <p className="mt-1 text-muted-foreground text-xs">
                                          {bulkEnrichmentState.completed} /{" "}
                                          {bulkEnrichmentState.total} 완료
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                            {/* 새 고객그룹으로 추가하기 퀵액션 - 검색 완료 후 표시 */}
                            {message.id === streamingState.messageId &&
                              streamingState.status === "complete" &&
                              customers.length > 0 &&
                              !bulkEnrichmentState.isRunning &&
                              !createGroupState.isCreating &&
                              !createGroupState.groupId && (
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
                                  initial={{ opacity: 0, y: 10 }}
                                  transition={{ duration: 0.3, delay: 0.7 }}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                                      <FolderPlus className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">
                                        새 고객그룹으로 추가하기
                                      </p>
                                      <p className="mt-1 text-muted-foreground text-sm">
                                        {customers.length}개 리드를 새 고객그룹으로 저장합니다
                                      </p>
                                      <Button
                                        className="mt-3 gap-2 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={handleCreateGroup}
                                        size="sm"
                                      >
                                        <FolderPlus className="h-4 w-4" />
                                        고객그룹 만들기
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                            {/* 그룹 생성 진행 상태 */}
                            {message.id === streamingState.messageId &&
                              createGroupState.isCreating && (
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
                                  initial={{ opacity: 0, y: 10 }}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                                      <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">
                                        고객그룹 생성 중...
                                      </p>
                                      <p className="mt-1 text-muted-foreground text-sm">
                                        {createGroupState.leadsCount}개 리드를 저장하고 있습니다
                                      </p>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                            {/* 그룹 생성 완료 */}
                            {message.id === streamingState.messageId &&
                              createGroupState.groupId && (
                                <motion.div
                                  animate={{ opacity: 1, y: 0 }}
                                  className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
                                  initial={{ opacity: 0, y: 10 }}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                                      <Check className="h-5 w-5 text-emerald-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-foreground">
                                        고객그룹이 생성되었습니다!
                                      </p>
                                      <p className="mt-1 text-muted-foreground text-sm">
                                        {customers.length}개 리드가 새 고객그룹에 추가되었습니다
                                      </p>
                                      <Button
                                        className="mt-3 gap-2"
                                        onClick={() =>
                                          window.open(
                                            `/customer-groups/${createGroupState.groupId}`,
                                            "_blank",
                                          )
                                        }
                                        size="sm"
                                        variant="outline"
                                      >
                                        고객그룹 보기
                                        <ArrowRight className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}

                            {message.customersAdded && message.customersAdded.length > 0 && (
                              <div className="mt-2 border-border/50 border-t pt-2">
                                <p className="text-sm opacity-70">
                                  새로 추가된 고객{" "}
                                  {message.customersAdded
                                    .map((c) => c.company_name || "-")
                                    .join(", ")}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  {/* 스크롤 앵커 */}
                  <div ref={scrollEndRef} />
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* 입력 영역 - 하단 고정 (메시지가 있거나 검색 중일 때 표시) */}
        {(messages.length > 0 || isSearching) && (
          <div className="shrink-0 border-t bg-background p-3">
            <form className="space-y-2" onSubmit={handleSubmit}>
              <div className="overflow-hidden rounded-2xl border border-border/50 bg-muted/50">
                {/* 1행: Textarea */}
                <textarea
                  className="min-h-[72px] w-full resize-none border-0 bg-transparent px-3 pt-3 pb-0 text-base outline-none placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSearching}
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
                  rows={3}
                  value={input}
                />

                {/* 2행: 버튼들 */}
                <div className="flex items-center justify-between px-3 pt-2 pb-3">
                  {/* 좌측: 검색 모드 선택 드롭다운 */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-8 gap-1.5 rounded-lg px-2.5 text-muted-foreground hover:text-foreground"
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {searchMode === "website" ? (
                          <Globe className="h-4 w-4" />
                        ) : (
                          <SlidersHorizontal className="h-4 w-4" />
                        )}
                        <span className="font-medium text-xs">
                          {searchMode === "website" ? "웹사이트" : "조건 검색"}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[260px]">
                      <DropdownMenuItem
                        className="flex cursor-pointer flex-col items-start gap-1 py-3"
                        onClick={() => setSearchMode("website")}
                      >
                        <div className="flex w-full items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <span className="font-medium">웹사이트로 시작하기</span>
                          {searchMode === "website" && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          )}
                        </div>
                        <span className="pl-6 text-muted-foreground text-xs">
                          우리 회사 웹사이트 주소만 있으면 돼요
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex cursor-pointer flex-col items-start gap-1 py-3"
                        onClick={() => setSearchMode("detailed")}
                      >
                        <div className="flex w-full items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4" />
                          <span className="font-medium">원하는 조건으로 찾기</span>
                          {searchMode === "detailed" && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          )}
                        </div>
                        <span className="pl-6 text-muted-foreground text-xs">
                          업종, 지역, 규모 등을 직접 정해요
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* 우측: 제출 버튼 */}
                  <Button
                    className="h-8 w-8 rounded-full"
                    disabled={isSearching || !isInputValid()}
                    size="icon"
                    type="submit"
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
              <div className="mt-1.5 min-h-[22px] px-1">
                {searchMode === "website" && input.trim() && !isValidWebsiteUrl(input) && (
                  <div className="text-red-500 text-sm dark:text-red-400">
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
