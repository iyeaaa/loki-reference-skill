/**
 * StepChatOnboarding - ChatGPT 스타일 대화형 온보딩 컴포넌트
 *
 * LeadDiscoveryPage 패턴 적용:
 * - react-resizable-panels 사용
 * - 초기 화면: ChatRoom만 전체 표시
 * - 진행 중/완료: 좌측 ChatRoom + 우측 Canvas 분할
 */

import { useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { CheckCircle2, GripVertical, Loader2, Send } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { StarSpinner } from "@/components/chatbot/StarSpinner"
import { Card } from "@/components/ui/card"
import { trackOnboardingComplete, trackOnboardingStep4Complete } from "@/lib/analytics"
import { apiFetch } from "@/lib/api/client"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import {
  useCompleteOnboarding,
  useOnboardingProgress as useOnboardingProgressAPI,
} from "@/lib/api/hooks/onboarding"
import { sequenceKeys, useSequenceSteps } from "@/lib/api/hooks/sequences"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { getUnipileAuthUrl } from "@/lib/api/services/unipile"
import { useOnboardingProgress } from "@/store/onboarding-progress"
import { OnboardingCanvas } from "./OnboardingCanvas"
import { type ChatMessage, OnboardingChatRoom } from "./OnboardingChatRoom"

export function StepChatOnboarding() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isKorean = i18n.language === "ko"

  // User & workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces, isLoading: workspacesLoading } = useUserWorkspaces(!!userId)
  const workspace = userWorkspaces?.[0]
  const workspaceId = workspace?.id || ""

  // Onboarding progress from DB
  const { data: onboardingData, isLoading: onboardingLoading } = useOnboardingProgressAPI(
    workspaceId,
    !!workspaceId,
  )

  // Email account
  const { data: emailAccount } = useEmailAccountByWorkspaceAndUser(workspaceId, !!workspaceId)

  // Sequence steps for execution
  const sequenceId = onboardingData?.generatedSequenceId || ""
  const { data: stepsData } = useSequenceSteps(sequenceId, !!sequenceId)

  // Complete onboarding mutation
  const completeOnboardingMutation = useCompleteOnboarding()

  // SSE Progress hook
  const {
    phase,
    parallelProgress,
    isComplete: sseComplete,
    hasError: sseError,
    leads: sseLeads,
    steps: sseSteps, // 🆕 SSE에서 직접 받은 이메일 템플릿 스텝
    reasonings, // 🆕 누적된 reasoning 배열
    completionSummary, // 🆕 LLM 생성 완료 요약
    phaseSummaries, // 🆕 Phase별 AI 요약
  } = useOnboardingProgress(workspaceId, {
    enabled: !!workspaceId && !workspacesLoading && !onboardingLoading,
  })

  // 🆕 Track displayed phase summaries to avoid duplicates
  const displayedSummariesRef = useRef<Set<string>>(new Set())

  // UI State
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnectingEmail, setIsConnectingEmail] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionComplete, setExecutionComplete] = useState(false)

  // 🆕 스트리밍 효과를 위한 상태
  const [streamingText, setStreamingText] = useState<string>("")
  const [isStreamingComplete, setIsStreamingComplete] = useState(false)
  const streamingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [cachedCompletionSummary, setCachedCompletionSummary] = useState<{
    ko: string
    en: string
  } | null>(null)

  // Cache completion summary to avoid fallback on re-render/remount
  useEffect(() => {
    if (!workspaceId) {
      return
    }

    const storageKey = `onboarding_completion_summary_${workspaceId}`
    if (completionSummary) {
      setCachedCompletionSummary(completionSummary)
      try {
        localStorage.setItem(storageKey, JSON.stringify(completionSummary))
      } catch {
        // localStorage 실패는 무시
      }
      return
    }

    if (!cachedCompletionSummary) {
      try {
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          setCachedCompletionSummary(JSON.parse(stored))
        }
      } catch {
        // localStorage 파싱 실패는 무시
      }
    }
  }, [completionSummary, workspaceId, cachedCompletionSummary])

  const effectiveCompletionSummary = completionSummary || cachedCompletionSummary

  // 🆕 Phase 변경 시 쿼리 refetch (이메일 스텝이 생성되면 즉시 표시)
  const prevPhaseRef = useRef<string | null>(null)
  useEffect(() => {
    if (phase && phase !== prevPhaseRef.current) {
      prevPhaseRef.current = phase

      // sequence phase 이후 onboarding 데이터 refetch (sequenceId 가져오기)
      if (phase === "sequence" || phase === "previews" || phase === "complete") {
        queryClient.invalidateQueries({ queryKey: ["onboarding", workspaceId] })
        if (sequenceId) {
          queryClient.invalidateQueries({ queryKey: sequenceKeys.steps(sequenceId) })
        }
      }
    }
  }, [phase, workspaceId, queryClient, sequenceId])

  // 🆕 sequenceId가 생기면 즉시 steps 쿼리 refetch
  const prevSequenceIdRef = useRef<string>("")
  useEffect(() => {
    if (sequenceId && sequenceId !== prevSequenceIdRef.current) {
      prevSequenceIdRef.current = sequenceId
      // sequenceId가 새로 생기면 즉시 steps 데이터 가져오기
      queryClient.invalidateQueries({ queryKey: sequenceKeys.steps(sequenceId) })
    }
  }, [sequenceId, queryClient])

  // DB에서 리드 정보 가져오기 (LeadsSection용 전체 필드 포함)
  const [dbLeads, setDbLeads] = useState<
    Array<{
      id: string
      companyName: string
      country?: string
      email?: string
      industry?: string
      contactName?: string
      description?: string
      employeeCount?: string
      businessType?: string
      websiteUrl?: string
      leadScore?: number // LLM 평가 점수 (0-100)
    }>
  >([])

  // Lead IDs from onboarding
  const allLeadIds = useMemo(() => onboardingData?.selectedLeadIds || [], [onboardingData])

  // 작업 완료 여부 (DB에서도 확인)
  const isJobComplete = sseComplete || onboardingData?.jobStatus === "completed"

  // DB에서 리드 정보 조회 (완료 상태에서도 조회)
  // allLeadIds (onboardingData) 또는 sseLeads 중 하나라도 있으면 fetch
  useEffect(() => {
    const isUuid = (value: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

    // SSE 리드 ID 추출
    const sseLeadIds = sseLeads.map((l) => l.leadId).filter((id): id is string => Boolean(id))
    // onboardingData 리드 ID 또는 SSE 리드 ID 사용
    const leadIdsToFetch = (allLeadIds.length > 0 ? allLeadIds : sseLeadIds).filter(isUuid)

    if (leadIdsToFetch.length > 0 && (dbLeads.length === 0 || isJobComplete)) {
      const fetchLeads = async () => {
        try {
          const response = await apiFetch<{
            data: Array<{
              id: string
              companyName: string
              country?: string
              email?: string
              industry?: string
              contactName?: string
              description?: string
              employeeCount?: string
              businessType?: string
              websiteUrl?: string
              leadScore?: number // LLM 평가 점수 (0-100)
            }>
          }>(`/api/v1/leads?ids=${leadIdsToFetch.join(",")}`)
          if (response.data) {
            setDbLeads(response.data)
          }
        } catch (error) {
          console.error("Failed to fetch leads:", error)
        }
      }
      fetchLeads()
    }
  }, [allLeadIds, sseLeads, dbLeads.length, isJobComplete])

  // 실제 사용할 리드/이메일 데이터 (SSE 우선, DB fallback)
  const leads = useMemo(() => {
    if (sseLeads.length > 0) {
      return sseLeads
    }
    // DB 리드를 SSE 형식으로 변환
    return dbLeads.map((lead) => ({
      leadId: lead.id,
      companyName: lead.companyName,
      country: lead.country,
      email: lead.email,
      status: "done" as const,
      score: lead.leadScore, // DB의 leadScore를 score로 매핑
      description: lead.description,
    }))
  }, [sseLeads, dbLeads])

  // 🆕 fullLeads 변환 (DB의 leadScore를 score로 매핑 - SimpleLeadsSection용)
  const fullLeadsWithScore = useMemo(() => {
    return dbLeads.map((lead) => ({
      ...lead,
      score: lead.leadScore, // DB의 leadScore를 score로 매핑
    }))
  }, [dbLeads])

  // 🆕 전체 이메일 개수 (leads × steps로 계산)
  const totalEmailCount = useMemo(() => {
    const stepCount = stepsData?.length || 3 // 기본 3-touch sequence
    return leads.length * stepCount
  }, [leads.length, stepsData])

  // Check if email is connected (not a trial preview)
  const isEmailConnected = emailAccount && emailAccount.apiKey !== "TRIAL_PREVIEW"

  // 🆕 스트리밍 효과 useEffect
  useEffect(() => {
    // 🆕 이메일 연동 전에는 스트리밍하지 않음
    // 완료 상태이고 completionSummary가 있고 이메일이 연동되어 있을 때만 스트리밍 시작
    if (
      !((phase === "complete" || isJobComplete) && effectiveCompletionSummary) ||
      isStreamingComplete ||
      !isEmailConnected
    ) {
      return
    }

    // CTA 메시지 생성 (이메일 연동 후)
    const ctaMessage = isKorean ? "\n\n이메일을 보내볼까요?" : "\n\nShall we send the emails?"

    const summaryContent = isKorean ? effectiveCompletionSummary.ko : effectiveCompletionSummary.en
    const fullText = `${summaryContent}${ctaMessage}`

    // 이미 스트리밍 완료된 경우
    if (streamingText.length >= fullText.length) {
      setIsStreamingComplete(true)
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current)
        streamingIntervalRef.current = null
      }
      return
    }

    // 스트리밍 시작 (이미 interval이 있으면 중복 생성 방지)
    if (streamingIntervalRef.current) {
      return
    }

    let currentIndex = streamingText.length || 0

    streamingIntervalRef.current = setInterval(() => {
      if (currentIndex < fullText.length) {
        // 한번에 2-4글자씩 추가 (더 자연스러운 속도)
        const charsToAdd = Math.min(3, fullText.length - currentIndex)
        currentIndex += charsToAdd
        setStreamingText(fullText.slice(0, currentIndex))
      } else {
        // 스트리밍 완료
        setIsStreamingComplete(true)
        if (streamingIntervalRef.current) {
          clearInterval(streamingIntervalRef.current)
          streamingIntervalRef.current = null
        }
      }
    }, 15) // 15ms마다 업데이트

    // Cleanup
    return () => {
      if (streamingIntervalRef.current) {
        clearInterval(streamingIntervalRef.current)
        streamingIntervalRef.current = null
      }
    }
  }, [
    phase,
    isJobComplete,
    effectiveCompletionSummary,
    isStreamingComplete,
    isEmailConnected,
    isKorean,
    streamingText.length,
  ])

  // 🆕 스트리밍 텍스트가 변경될 때 completion-message 업데이트
  useEffect(() => {
    if (!streamingText || isStreamingComplete) {
      return
    }

    setMessages((prev) => {
      const completionIndex = prev.findIndex((m) => m.id === "completion-message")
      if (completionIndex >= 0 && prev[completionIndex].isStreaming) {
        const ctaMessage = isKorean ? "\n\n이메일을 보내볼까요?" : "\n\nShall we send the emails?"
        const summaryContent = effectiveCompletionSummary
          ? isKorean
            ? effectiveCompletionSummary.ko
            : effectiveCompletionSummary.en
          : ""
        const fullText = `${summaryContent}${ctaMessage}`
        const isDone = streamingText.length >= fullText.length

        const updated = [...prev]
        updated[completionIndex] = {
          ...updated[completionIndex],
          content: streamingText,
          isStreaming: !isDone,
          buttons: isDone
            ? [
                { label: isKorean ? "보내기" : "Send", action: "send-emails", variant: "default" },
                { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
              ]
            : undefined,
        }
        return updated
      }
      return prev
    })
  }, [streamingText, isStreamingComplete, isKorean, effectiveCompletionSummary])

  // 회사명 가져오기
  const companyName = workspace?.companyName || workspace?.name || ""

  // 초기 화면 표시 조건: 메시지가 없고 회사명도 없는 경우
  const showInitialScreen = messages.length === 0 && !companyName

  // 분할 화면 표시 조건: 메시지가 있거나 진행 중
  const showSplitScreen = messages.length > 0 || (companyName && !showInitialScreen)

  // 첫 메시지 생성 (이미 완료된 상태라면 완료 메시지로 시작)
  useEffect(() => {
    if (companyName && messages.length === 0) {
      // 이미 작업이 완료된 상태라면 완료 메시지로 시작
      if (isJobComplete && leads.length > 0) {
        const completionButtons: ChatMessage["buttons"] = isEmailConnected
          ? [
              { label: isKorean ? "보내기" : "Send", action: "send-emails", variant: "default" },
              { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
            ]
          : [
              {
                label: isKorean ? "이메일 연동하기" : "Connect Email",
                action: "connect-email",
                variant: "default",
              },
              { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
            ]

        // 🆕 이메일 연동 전: 간단한 메시지만 표시
        // 🆕 이메일 연동 후: LLM 요약 스트리밍 표시
        if (isEmailConnected) {
          // 이메일 연동 후 - LLM 요약 표시
          const summaryContent = effectiveCompletionSummary
            ? isKorean
              ? effectiveCompletionSummary.ko
              : effectiveCompletionSummary.en
            : null

          // 기본 완료 메시지 (fallback)
          const fallbackContent = isKorean
            ? `✨ **모든 준비가 끝났어요!**\n\n**${leads.length}명**의 바이어와 **${totalEmailCount}개**의 이메일이 준비됐어요.\n\n이메일을 보내볼까요?`
            : `✨ **All done!**\n\n**${leads.length}** buyers and **${totalEmailCount}** emails are ready.\n\nShall we send the emails?`

          // 요약이 있으면 스트리밍 시작, 없으면 바로 전체 메시지 표시
          if (summaryContent && !isStreamingComplete) {
            // 스트리밍으로 표시 (스트리밍 useEffect가 처리)
            const assistantMessage: ChatMessage = {
              id: "assistant-1",
              role: "assistant",
              content: "✨ ",
              timestamp: new Date(),
              isStreaming: true,
              buttons: undefined,
            }
            setMessages([assistantMessage])
          } else {
            // 스트리밍 완료 또는 fallback
            const ctaMessage = isKorean
              ? "\n\n이메일을 보내볼까요?"
              : "\n\nShall we send the emails?"

            const assistantMessage: ChatMessage = {
              id: "assistant-1",
              role: "assistant",
              content: summaryContent ? `${summaryContent}${ctaMessage}` : fallbackContent,
              timestamp: new Date(),
              isStreaming: false,
              buttons: completionButtons,
            }
            setMessages([assistantMessage])
          }
        } else {
          // 이메일 연동 전 - 간단한 메시지
          const simpleContent = isKorean
            ? `✨ **바이어와 이메일을 모두 찾았어요!**\n\n**${leads.length}명**의 바이어와 **${totalEmailCount}개**의 이메일 초안이 준비됐어요.\n\n이메일 발송을 위해 이메일 계정을 연동해주세요.`
            : `✨ **Found all buyers and emails!**\n\n**${leads.length}** buyers and **${totalEmailCount}** email drafts are ready.\n\nPlease connect your email account to send.`

          const assistantMessage: ChatMessage = {
            id: "assistant-1",
            role: "assistant",
            content: simpleContent,
            timestamp: new Date(),
            isStreaming: false,
            buttons: completionButtons,
          }
          setMessages([assistantMessage])
        }
      } else {
        // 진행 중인 상태
        const assistantMessage: ChatMessage = {
          id: "assistant-1",
          role: "assistant",
          content: isKorean
            ? `**${companyName}**에 맞는 해외 바이어를 찾고 있어요.\n\n잠시만 기다려주세요...`
            : `Finding overseas buyers for **${companyName}**.\n\nPlease wait...`,
          timestamp: new Date(),
          isStreaming: true,
        }

        setMessages([assistantMessage])
      }
    }
  }, [
    companyName,
    isKorean,
    messages.length,
    isJobComplete,
    leads.length,
    totalEmailCount,
    isEmailConnected,
    effectiveCompletionSummary,
    isStreamingComplete,
  ])

  // 🆕 Phase Summary 메시지 자동 추가
  // SSE에서 phaseSummary가 수신되면 채팅에 AI 요약 메시지 추가
  useEffect(() => {
    if (phaseSummaries.length === 0 || messages.length === 0) {
      return
    }

    // 새로운 phase summary 확인
    for (const summary of phaseSummaries) {
      // 이미 표시된 summary인지 확인
      if (displayedSummariesRef.current.has(summary.phase)) {
        continue
      }

      // 메시지 내용 선택 (언어별)
      const summaryContent = isKorean ? summary.summary.ko : summary.summary.en

      // 새 메시지 ID 생성
      const messageId = `phase-summary-${summary.phase}-${Date.now()}`

      // 메시지 추가
      setMessages((prev) => {
        // 중복 방지: 이미 같은 phase의 summary가 있는지 확인
        const existingIndex = prev.findIndex((m) =>
          m.id.startsWith(`phase-summary-${summary.phase}-`),
        )
        if (existingIndex >= 0) {
          return prev
        }

        // assistant-1 메시지 찾기
        const assistantIndex = prev.findIndex((m) => m.id === "assistant-1")
        if (assistantIndex < 0) {
          return prev
        }

        // assistant-1 바로 뒤에 새 메시지 삽입
        const newMessage: ChatMessage = {
          id: messageId,
          role: "assistant",
          content: summaryContent,
          timestamp: new Date(),
          isStreaming: false,
        }

        const updated = [...prev]
        // assistant-1 뒤에 삽입 (기존 phase summary 메시지들 뒤에)
        // findLastIndex 대신 reverse + findIndex 사용 (ES2023 이전 호환성)
        let insertIndex = -1
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].id.startsWith("phase-summary-")) {
            insertIndex = i
            break
          }
        }
        if (insertIndex >= 0) {
          updated.splice(insertIndex + 1, 0, newMessage)
        } else {
          updated.splice(assistantIndex + 1, 0, newMessage)
        }

        return updated
      })

      // 표시됨으로 표시
      displayedSummariesRef.current.add(summary.phase)
    }
  }, [phaseSummaries, isKorean, messages.length])

  // SSE 진행 상황에 따른 메시지 업데이트 (reasoning 포함)
  // phase가 null이어도 isJobComplete가 true면 완료 메시지 표시
  useEffect(() => {
    if (!(phase || isJobComplete) || messages.length === 0) {
      return
    }

    const updateAssistantMessage = (content: string, buttons?: ChatMessage["buttons"]) => {
      // 진행 중인 phase 여부 확인
      const isInProgress = !(
        sseComplete ||
        sseError ||
        phase === "complete" ||
        phase === "error" ||
        isJobComplete
      )

      setMessages((prev) => {
        const lastAssistant = prev.findIndex((m) => m.id === "assistant-1")
        if (lastAssistant >= 0) {
          const updated = [...prev]
          updated[lastAssistant] = {
            ...updated[lastAssistant],
            content,
            isStreaming: isInProgress,
            buttons,
          }
          return updated
        }
        return prev
      })
    }

    // Phase별 메시지
    if (phase === "discovery") {
      // 0명일 때는 발견 수를 표시하지 않음
      const discoveryMessage =
        leads.length > 0
          ? isKorean
            ? `**${companyName}**에 맞는 해외 바이어를 찾고 있어요...\n\n🔍 **${leads.length}명** 발견`
            : `Finding overseas buyers for **${companyName}**...\n\n🔍 **${leads.length}** found`
          : isKorean
            ? `**${companyName}**에 맞는 해외 바이어를 찾고 있어요...`
            : `Finding overseas buyers for **${companyName}**...`
      updateAssistantMessage(discoveryMessage)
    } else if (phase === "group") {
      updateAssistantMessage(
        isKorean
          ? `**${leads.length}명**의 바이어 정보를 정리하고 있어요...`
          : `Organizing **${leads.length}** buyer information...`,
      )
    } else if (phase === "templates" || phase === "sequence") {
      // 0명일 때는 바이어 발견 메시지 표시하지 않음
      const templatesMessage =
        leads.length > 0
          ? isKorean
            ? `✅ **${leads.length}명**의 바이어를 찾았어요!\n\n🔍 바이어 정보를 분석하고 있어요...`
            : `✅ Found **${leads.length}** buyers!\n\n🔍 Analyzing buyer information...`
          : isKorean
            ? "🔍 바이어 정보를 분석하고 있어요..."
            : "🔍 Analyzing buyer information..."
      updateAssistantMessage(templatesMessage)
    } else if (phase === "previews") {
      updateAssistantMessage(
        isKorean
          ? `바이어별 맞춤 이메일을 마무리하고 있어요...\n\n✉️ **${totalEmailCount}개** 완료`
          : `Finalizing personalized emails...\n\n✉️ **${totalEmailCount}** done`,
      )
    } else if (phase === "complete" || isJobComplete) {
      // 🆕 완료 메시지는 대화 흐름 순서에 맞게 최하단에 새 메시지로 추가
      // 버튼
      const completionButtons: ChatMessage["buttons"] = isEmailConnected
        ? [
            { label: isKorean ? "보내기" : "Send", action: "send-emails", variant: "default" },
            { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
          ]
        : [
            {
              label: isKorean ? "이메일 연동하기" : "Connect Email",
              action: "connect-email",
              variant: "default",
            },
          ]

      // 먼저 assistant-1의 스트리밍 상태를 완료로 변경
      setMessages((prev) => {
        const assistantIndex = prev.findIndex((m) => m.id === "assistant-1")
        if (assistantIndex >= 0 && prev[assistantIndex].isStreaming) {
          const updated = [...prev]
          updated[assistantIndex] = {
            ...updated[assistantIndex],
            isStreaming: false,
          }
          return updated
        }
        return prev
      })

      // 이미 완료 메시지가 있으면 건너뜀
      setMessages((prev) => {
        if (prev.some((m) => m.id === "completion-message")) {
          // 이미 완료 메시지가 있으면 버튼만 업데이트
          const completionIndex = prev.findIndex((m) => m.id === "completion-message")
          if (completionIndex >= 0 && !prev[completionIndex].buttons) {
            const updated = [...prev]
            updated[completionIndex] = {
              ...updated[completionIndex],
              buttons: completionButtons,
            }
            return updated
          }
          return prev
        }

        // 🆕 완료 메시지를 배열 끝에 새로 추가
        let completionContent: string

        if (isEmailConnected) {
          const summaryContent = effectiveCompletionSummary
            ? isKorean
              ? effectiveCompletionSummary.ko
              : effectiveCompletionSummary.en
            : null
          const ctaMessage = isKorean ? "\n\n이메일을 보내볼까요?" : "\n\nShall we send the emails?"
          const fallbackContent = isKorean
            ? `✨ **모든 준비가 끝났어요!**\n\n**${leads.length}명**의 바이어와 **${totalEmailCount}개**의 이메일이 준비됐어요.${ctaMessage}`
            : `✨ **All done!**\n\n**${leads.length}** buyers and **${totalEmailCount}** emails are ready.${ctaMessage}`

          if (summaryContent && !isStreamingComplete) {
            completionContent = streamingText || "✨ "
          } else {
            completionContent = summaryContent ? `${summaryContent}${ctaMessage}` : fallbackContent
          }
        } else {
          completionContent = isKorean
            ? `✨ **바이어와 이메일을 모두 찾았어요!**\n\n**${leads.length}명**의 바이어와 **${totalEmailCount}개**의 이메일 초안이 준비됐어요.\n\n이메일 발송을 위해 이메일 계정을 연동해주세요.`
            : `✨ **Found all buyers and emails!**\n\n**${leads.length}** buyers and **${totalEmailCount}** email drafts are ready.\n\nPlease connect your email account to send.`
        }

        const isStillStreaming = !!(
          isEmailConnected &&
          effectiveCompletionSummary &&
          !isStreamingComplete
        )

        return [
          ...prev,
          {
            id: "completion-message",
            role: "assistant" as const,
            content: completionContent,
            timestamp: new Date(),
            isStreaming: isStillStreaming,
            buttons: isStillStreaming ? undefined : completionButtons,
          },
        ]
      })
    } else if (phase === "error" || sseError) {
      updateAssistantMessage(
        isKorean
          ? "❌ 작업 중 문제가 발생했어요. 다시 시도해주세요."
          : "❌ An error occurred. Please try again.",
      )
    }
  }, [
    phase,
    isJobComplete,
    sseError,
    sseComplete,
    leads,
    totalEmailCount,
    companyName,
    isKorean,
    isEmailConnected,
    messages.length,
    effectiveCompletionSummary,
    streamingText,
    isStreamingComplete,
  ])

  // 이메일 연동 후 메시지 업데이트 - LLM 요약 스트리밍 또는 완료 메시지 추가
  const hasAddedCompletionMessageRef = useRef(false)
  useEffect(() => {
    if (!(isEmailConnected && isJobComplete && messages.length >= 1)) {
      return
    }

    // 이미 처리했으면 건너뜀
    if (hasAddedCompletionMessageRef.current) {
      return
    }

    // 이미 이메일 연동 메시지 또는 보내기 버튼이 있는 완료 메시지가 있으면 건너뜀
    const hasEmailConnectedMessage = messages.some((m) => m.id === "email-connected-message")
    const hasCompletionWithSendButton = messages.some(
      (m) =>
        (m.id === "completion-message" || m.id === "assistant-1") &&
        m.buttons?.some((b) => b.action === "send-emails"),
    )

    if (hasEmailConnectedMessage || hasCompletionWithSendButton) {
      return
    }

    // "assistant-1" 또는 "completion-message"에 connect-email 버튼이 있는지 확인
    const hasConnectEmailButton = messages.some(
      (m) =>
        (m.id === "assistant-1" || m.id === "completion-message") &&
        m.buttons?.some((b) => b.action === "connect-email"),
    )

    if (!hasConnectEmailButton) {
      return
    }

    // 처리 시작
    hasAddedCompletionMessageRef.current = true

    // LLM 요약이 있으면 스트리밍 리셋 후 새 메시지 추가
    if (effectiveCompletionSummary && !isStreamingComplete) {
      setStreamingText("")
      setIsStreamingComplete(false)
    }

    setMessages((prev) => {
      const connectEmailMsgIndex = prev.findIndex(
        (m) =>
          (m.id === "assistant-1" || m.id === "completion-message") &&
          m.buttons?.some((b) => b.action === "connect-email"),
      )

      // LLM 요약이 있으면 스트리밍으로 새 메시지 추가
      if (effectiveCompletionSummary) {
        const summaryContent = isKorean
          ? effectiveCompletionSummary.ko
          : effectiveCompletionSummary.en
        const ctaMessage = isKorean ? "\n\n이메일을 보내볼까요?" : "\n\nShall we send the emails?"

        // 기존 connect-email 메시지가 있으면 버튼 제거하고 새 메시지 추가
        const updatedPrev =
          connectEmailMsgIndex >= 0
            ? prev.map((m, i) => (i === connectEmailMsgIndex ? { ...m, buttons: undefined } : m))
            : prev

        return [
          ...updatedPrev,
          {
            id: "completion-message",
            role: "assistant" as const,
            content: isStreamingComplete ? `${summaryContent}${ctaMessage}` : "✨ ",
            timestamp: new Date(),
            isStreaming: !isStreamingComplete,
            buttons: isStreamingComplete
              ? [
                  {
                    label: isKorean ? "보내기" : "Send",
                    action: "send-emails",
                    variant: "default",
                  },
                  { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
                ]
              : undefined,
          },
        ]
      }

      // LLM 요약이 없으면 기본 완료 메시지로 업데이트
      if (connectEmailMsgIndex >= 0) {
        const updated = [...prev]
        updated[connectEmailMsgIndex] = {
          ...updated[connectEmailMsgIndex],
          content: isKorean
            ? `✨ **이메일 연동이 완료됐어요!**\n\n**${leads.length}명**의 바이어에게 **${totalEmailCount}개**의 이메일을 보낼 준비가 됐어요.\n\n이메일을 보내볼까요?`
            : `✨ **Email connected!**\n\nReady to send **${totalEmailCount}** emails to **${leads.length}** buyers.\n\nShall we send them?`,
          buttons: [
            { label: isKorean ? "보내기" : "Send", action: "send-emails", variant: "default" },
            { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
          ],
        }
        return updated
      }

      // 새 이메일 연동 완료 메시지를 배열 끝에 추가
      return [
        ...prev,
        {
          id: "email-connected-message",
          role: "assistant" as const,
          content: isKorean
            ? `✨ **이메일 연동이 완료됐어요!**\n\n**${leads.length}명**의 바이어에게 **${totalEmailCount}개**의 이메일을 보낼 준비가 됐어요.\n\n이메일을 보내볼까요?`
            : `✨ **Email connected!**\n\nReady to send **${totalEmailCount}** emails to **${leads.length}** buyers.\n\nShall we send them?`,
          timestamp: new Date(),
          isStreaming: false,
          buttons: [
            { label: isKorean ? "보내기" : "Send", action: "send-emails", variant: "default" },
            { label: isKorean ? "나중에 하기" : "Later", action: "skip", variant: "outline" },
          ],
        },
      ]
    })
  }, [
    isEmailConnected,
    isJobComplete,
    leads.length,
    totalEmailCount,
    isKorean,
    messages,
    effectiveCompletionSummary,
    isStreamingComplete,
  ])

  // 이메일 연동 핸들러 (팝업 방식)
  const handleConnectEmail = useCallback(async () => {
    setIsConnectingEmail(true)
    try {
      if (workspaceId) {
        try {
          localStorage.setItem("unipile_oauth_workspace_id", workspaceId)
        } catch {
          // localStorage 저장 실패는 무시
        }
      }

      const response = await getUnipileAuthUrl(workspaceId)

      // 팝업 창 크기 및 위치 계산 (화면 중앙)
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      // 팝업 창 열기
      const popup = window.open(
        response.hostedAuthUrl,
        "email-connect-popup",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
      )

      if (!popup) {
        // 팝업 차단된 경우 기존 방식으로 fallback
        toast.error(
          isKorean
            ? "팝업이 차단되었습니다. 팝업을 허용하거나 새 탭에서 진행해주세요."
            : "Popup blocked. Please allow popups or continue in a new tab.",
        )
        window.location.href = response.hostedAuthUrl
        return
      }

      // 팝업 창 닫힘 감지 및 메시지 수신
      const handleMessage = async (event: MessageEvent) => {
        // 보안: origin 검증
        if (event.origin !== window.location.origin) {
          return
        }

        if (event.data?.type === "EMAIL_CONNECT_SUCCESS") {
          // 연동 성공 - emailAccount 쿼리 즉시 refetch
          await queryClient.refetchQueries({
            queryKey: ["emailAccounts", "workspaceAndUser", workspaceId],
          })
          // 약간의 딜레이 후 상태 업데이트 (React Query 상태가 완전히 업데이트되도록)
          setTimeout(() => {
            setIsConnectingEmail(false)
            toast.success(isKorean ? "이메일 계정이 연동되었습니다!" : "Email account connected!")
          }, 300)
          window.removeEventListener("message", handleMessage)
        } else if (event.data?.type === "EMAIL_CONNECT_ERROR") {
          // 연동 실패
          setIsConnectingEmail(false)
          toast.error(
            event.data.message ||
              (isKorean
                ? "이메일 연동에 실패했습니다. 다시 시도해주세요."
                : "Failed to connect email. Please try again."),
          )
          window.removeEventListener("message", handleMessage)
        }
      }

      window.addEventListener("message", handleMessage)

      // 팝업이 닫히면 이벤트 리스너 정리 및 상태 업데이트
      const checkPopupClosed = setInterval(async () => {
        if (popup.closed) {
          clearInterval(checkPopupClosed)
          window.removeEventListener("message", handleMessage)
          // 팝업이 닫히면 emailAccount 쿼리 즉시 refetch (사용자가 직접 닫은 경우에도)
          await queryClient.refetchQueries({
            queryKey: ["emailAccounts", "workspaceAndUser", workspaceId],
          })
          // 약간의 딜레이 후 상태 업데이트
          setTimeout(() => {
            setIsConnectingEmail(false)
          }, 300)
        }
      }, 500)
    } catch (error) {
      console.error("Failed to get auth URL:", error)
      toast.error(
        isKorean
          ? "이메일 연동에 실패했습니다. 다시 시도해주세요."
          : "Failed to connect email. Please try again.",
      )
      setIsConnectingEmail(false)
    }
  }, [workspaceId, isKorean, queryClient])

  // 이메일 발송 핸들러
  const handleSendEmails = useCallback(async () => {
    if (!sequenceId) {
      toast.error(isKorean ? "시퀀스 정보가 없습니다" : "Missing sequence information")
      return
    }

    if (!emailAccount?.id) {
      toast.error(isKorean ? "이메일 계정을 먼저 연동해주세요" : "Please connect your email first")
      return
    }

    setIsExecuting(true)

    try {
      // Fetch leads
      const leadsResponse = await apiFetch<{ data: Array<{ id: string; email?: string }> }>(
        `/api/v1/leads?ids=${allLeadIds.join(",")}`,
      )
      const validLeads = leadsResponse.data?.filter((l) => l.email) || []

      if (validLeads.length === 0) {
        toast.error(isKorean ? "발송할 리드가 없어요" : "No leads to send to")
        setIsExecuting(false)
        return
      }

      // Bulk enroll leads
      const enrollResult = await apiFetch<{
        enrolledCount: number
        totalSteps: number
        scheduledExecutions: number
      }>(`/api/v1/admin/sequences/${sequenceId}/enrollments/bulk-with-scheduling`, {
        method: "POST",
        body: JSON.stringify({
          leadIds: validLeads.map((l) => l.id),
          userEmailAccountId: emailAccount.id,
          enrolledBy: userId,
        }),
      })

      // Activate sequence
      await apiFetch(`/api/v1/sequences/${sequenceId}/activate-step-based`, {
        method: "POST",
      })

      // Analytics
      trackOnboardingStep4Complete({
        leadsCount: enrollResult.enrolledCount,
        emailsScheduled: enrollResult.scheduledExecutions,
      })

      toast.success(
        isKorean
          ? `${enrollResult.enrolledCount}명에게 이메일이 예약됐어요`
          : `Emails scheduled for ${enrollResult.enrolledCount} leads`,
      )

      // Complete onboarding
      await completeOnboardingMutation.mutateAsync({ workspaceId, userId })
      trackOnboardingComplete()

      setExecutionComplete(true)

      setTimeout(() => {
        navigate("/dashboard")
      }, 2000)
    } catch (error) {
      console.error("Failed to execute:", error)
      toast.error(
        isKorean
          ? "이메일 발송에 실패했습니다. 다시 시도해주세요."
          : "Failed to send emails. Please try again.",
      )
      setIsExecuting(false)
    }
  }, [
    sequenceId,
    emailAccount?.id,
    allLeadIds,
    userId,
    workspaceId,
    isKorean,
    completeOnboardingMutation,
    navigate,
  ])

  // 나중에 하기 핸들러
  const handleSkip = useCallback(async () => {
    try {
      await completeOnboardingMutation.mutateAsync({ workspaceId, userId })
      trackOnboardingComplete()
      navigate("/dashboard")
    } catch (error) {
      console.error("Failed to complete onboarding:", error)
      toast.error(isKorean ? "온보딩 완료 처리에 실패했습니다." : "Failed to complete onboarding.")
    }
  }, [workspaceId, userId, isKorean, completeOnboardingMutation, navigate])

  // 버튼 액션 핸들러
  const handleButtonAction = useCallback(
    (action: string) => {
      switch (action) {
        case "connect-email":
          handleConnectEmail()
          break
        case "send-emails":
          handleSendEmails()
          break
        case "skip":
          handleSkip()
          break
      }
    },
    [handleConnectEmail, handleSendEmails, handleSkip],
  )

  // 로딩 상태
  if (workspacesLoading || onboardingLoading) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <div className="text-center">
          <StarSpinner size={48} />
          <p className="mt-4 text-muted-foreground">{isKorean ? "준비 중..." : "Loading..."}</p>
        </div>
      </div>
    )
  }

  // 실행 중 상태
  if (isExecuting) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }}>
          <Card className="border-0 bg-background p-12 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-blue-500/30 shadow-lg">
                  <Send className="h-7 w-7 text-white" />
                </div>
                <div className="-inset-2 absolute animate-pulse rounded-2xl bg-blue-500/20" />
              </div>
              <h2 className="mb-2 font-bold text-foreground text-xl">
                {isKorean ? "영업 이메일을 발송하고 있어요" : "Sending sales emails"}
              </h2>
              <p className="text-muted-foreground">
                {isKorean ? "잠시만 기다려주세요..." : "Please wait..."}
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  // 완료 상태
  if (executionComplete) {
    return (
      <div className="flex h-[calc(100vh-200px)] items-center justify-center">
        <motion.div animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }}>
          <Card className="border-0 bg-background p-12 shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-green-500 to-emerald-600 shadow-green-500/30 shadow-lg">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 font-bold text-foreground text-xl">
                {isKorean ? "영업이 시작됐어요!" : "Outreach is now live!"}
              </h2>
              <p className="mb-4 text-muted-foreground">
                {isKorean
                  ? "대시보드에서 바이어 반응을 확인해보세요"
                  : "Track buyer responses on your dashboard"}
              </p>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isKorean ? "대시보드로 이동 중..." : "Redirecting to dashboard..."}</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    )
  }

  // 메인 레이아웃
  return (
    <div className="-mx-4 h-[calc(100vh-140px)]">
      {showInitialScreen ? (
        // 초기 화면: ChatRoom만 전체 표시
        <OnboardingChatRoom
          isConnectingEmail={isConnectingEmail}
          isKorean={isKorean}
          isLoading={workspacesLoading || onboardingLoading}
          isProcessing={!(sseComplete || sseError || isJobComplete)}
          messages={messages}
          onButtonAction={handleButtonAction}
          reasonings={reasonings}
        />
      ) : showSplitScreen ? (
        // 분할 화면: 좌측 ChatRoom + 우측 Canvas
        <PanelGroup className="h-full" direction="horizontal">
          <Panel defaultSize={30} maxSize={50} minSize={20}>
            <OnboardingChatRoom
              isConnectingEmail={isConnectingEmail}
              isKorean={isKorean}
              isProcessing={!(sseComplete || sseError || isJobComplete)}
              messages={messages}
              onButtonAction={handleButtonAction}
              reasonings={reasonings}
            />
          </Panel>
          <PanelResizeHandle className="group flex w-2 items-center justify-center bg-border/50 transition-colors hover:bg-border">
            <GripVertical className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </PanelResizeHandle>
          <Panel defaultSize={70} minSize={50}>
            <OnboardingCanvas
              fullLeads={fullLeadsWithScore}
              isComplete={isJobComplete}
              leads={leads}
              parallelProgress={parallelProgress}
              phase={phase}
              sequenceId={sequenceId}
              steps={
                // 🆕 DB 데이터 우선, SSE 데이터 fallback (즉시 표시)
                (stepsData && stepsData.length > 0 ? stepsData : sseSteps) as Array<{
                  id: string
                  stepOrder: number
                  delayDays: number
                  scheduledHour?: number
                  scheduledMinute?: number
                  emailSubject: string
                  emailBodyText?: string
                  emailBodyHtml?: string
                }>
              }
            />
          </Panel>
        </PanelGroup>
      ) : (
        // 폴백: ChatRoom만 표시
        <OnboardingChatRoom
          isConnectingEmail={isConnectingEmail}
          isKorean={isKorean}
          isProcessing={!(sseComplete || sseError || isJobComplete)}
          messages={messages}
          onButtonAction={handleButtonAction}
          reasonings={reasonings}
        />
      )}
    </div>
  )
}
