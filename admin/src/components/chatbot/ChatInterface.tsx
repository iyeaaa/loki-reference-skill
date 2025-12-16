import { ArrowUp, Search, Square } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import TextPlus from "@/assets/text-plus.svg"
import TextRinda from "@/assets/text-rinda.svg"
import { AddLeadSheet } from "@/components/leads/AddLeadSheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { type ChatMessage, useChatbotHistory, useChatbotMutation } from "@/lib/api/hooks/chatbot"
import { useCustomerGroupsByWorkspace } from "@/lib/api/hooks/customer-groups"
import { chatbotApi } from "@/lib/api/services/chatbot"
import type { PreviewLeadData } from "@/lib/api/services/lead-import"
import type {
  FileAttachment as FileAttachmentType,
  NodeProgressUpdate,
  SequenceModalPayload,
} from "@/lib/api/types/chatbot"
import { DataArtifact } from "./DataArtifact"
import { FileAttachment } from "./FileAttachment"
import { MessageBubble } from "./MessageBubble"
import type { NodeProgress } from "./NodeProgressTracker"
import { ResizableDivider } from "./ResizableDivider"
import { SequenceGeneratorModal } from "./SequenceGeneratorModal"
import { StreamingMessageContainer } from "./StreamingMessageContainer"

type ChatInterfaceProps = {
  workspaceId: string
  conversationId?: string
  onConversationCreated?: (
    conversationId: string,
    firstMessage: string,
  ) => Promise<string | undefined>
}

export function ChatInterface({
  workspaceId,
  conversationId,
  onConversationCreated,
}: ChatInterfaceProps) {
  const { t, i18n } = useTranslation()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [currentThinking, setCurrentThinking] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState(conversationId || "")
  const [attachedFile, setAttachedFile] = useState<FileAttachmentType | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [nodeProgress, setNodeProgress] = useState<NodeProgress[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState<ChatMessage | null>(null)
  const [leadPreviewData, setLeadPreviewData] = useState<{
    totalRows: number
    previewRows: number
    leads: PreviewLeadData[]
    sheetName: string
    file: File
  } | null>(null)
  const [leadImportProgress, setLeadImportProgress] = useState<
    import("@/lib/api/services/lead-import").ImportProgress | null
  >(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isSequenceModalOpen, setIsSequenceModalOpen] = useState(false)
  const [defaultCustomerGroupId, setDefaultCustomerGroupId] = useState<string | undefined>(
    undefined,
  )
  // Resizable split pane - left panel width percentage
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem("chatbot-split-width")
    return saved ? Number.parseFloat(saved) : 50 // Default 50%
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastUserMessageRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaEmptyStateRef = useRef<HTMLTextAreaElement>(null)
  // Track if we're in the middle of creating a new conversation (to avoid resetting messages)
  const isCreatingConversationRef = useRef(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load conversation history if conversationId is provided
  const { data: historyData, isLoading: isLoadingHistory } = useChatbotHistory(
    conversationId || "",
    !!conversationId,
  )

  // Load customer groups for the workspace (used by AddLeadSheet)
  const { data: customerGroups } = useCustomerGroupsByWorkspace(
    workspaceId,
    workspaceId !== "all" && !!workspaceId,
  )

  // Memoize callbacks to prevent unnecessary re-renders
  const handleMessage = useCallback((message: ChatMessage) => {
    // Final message - add to messages array
    setMessages((prev) => [...prev, message])

    // Delay clearing streamingMessage and thinking to prevent sudden disappearance
    setTimeout(() => {
      setStreamingMessage(null)
      setCurrentThinking(null)
      setIsProcessing(false)
      setNeedsConfirmation(false)
      setNodeProgress([]) // Clear node progress when done
    }, 150) // Brief delay for smooth transition
  }, [])

  const handleMessageUpdate = useCallback((message: ChatMessage) => {
    // Real-time streaming update
    setStreamingMessage(message)
  }, [])

  const handleThinking = useCallback((thinking: string) => {
    setCurrentThinking(thinking)
  }, [])

  const handleProgress = useCallback(
    (progress: { message?: string; percent?: number; node?: string }) => {
      // Update thinking with progress info
      if (progress.message) {
        const progressText =
          progress.percent !== undefined
            ? `${progress.message} (${progress.percent}%)`
            : progress.message
        setCurrentThinking(progressText)
      }
    },
    [],
  )

  const handleConfirmationRequired = useCallback((message: string) => {
    // Confirmation required - show confirmation UI
    console.log("[ChatInterface] Confirmation required:", message)
    setNeedsConfirmation(true)
    setStreamingMessage({
      role: "assistant",
      content: message,
      timestamp: new Date(),
    })
    setCurrentThinking(null)
    setIsProcessing(false)
  }, [])

  const handleError = useCallback((error: string) => {
    console.error("Chatbot error:", error)
    setStreamingMessage(null)
    setCurrentThinking(null)
    setIsProcessing(false)
    setNeedsConfirmation(false)
    setNodeProgress([]) // Clear node progress on error
  }, [])

  const handleNodeProgress = useCallback((update: NodeProgressUpdate) => {
    setNodeProgress((prev) => {
      // Find if this node already exists in the progress array
      const existingIndex = prev.findIndex((p) => p.nodeName === update.nodeName)

      if (existingIndex >= 0) {
        // Update existing node progress
        const updated = [...prev]
        updated[existingIndex] = update
        return updated
      }

      // Add new node progress
      return [...prev, update]
    })
  }, [])

  // Handle open sequence modal event from chatbot
  const handleOpenSequenceModal = useCallback((payload: SequenceModalPayload) => {
    console.log("[ChatInterface] Opening sequence modal with payload:", payload)
    setDefaultCustomerGroupId(payload.customerGroupId)
    setIsSequenceModalOpen(true)
    // Clear processing state since modal is taking over
    setIsProcessing(false)
    setStreamingMessage(null)
    setCurrentThinking(null)
  }, [])

  // Setup chatbot mutation with TanStack Query - memoized to prevent recreation
  const chatbotMutation = useChatbotMutation({
    onMessage: handleMessage,
    onMessageUpdate: handleMessageUpdate,
    onThinking: handleThinking,
    onProgress: handleProgress,
    onConfirmationRequired: handleConfirmationRequired,
    onError: handleError,
    onNodeProgress: handleNodeProgress,
    onOpenSequenceModal: handleOpenSequenceModal,
  })

  // Load history into messages when available
  // Skip if we're creating a new conversation (to avoid overwriting user's first message)
  useEffect(() => {
    if (historyData?.messages && historyData.messages.length > 0) {
      // Only load history if we're not in the middle of creating a conversation
      if (!isCreatingConversationRef.current) {
        setMessages(historyData.messages)
      }
    }
  }, [historyData])

  // Reset state when conversationId changes (including when switching to new chat)
  useEffect(() => {
    // Skip reset if we're in the middle of creating a new conversation
    if (isCreatingConversationRef.current) {
      isCreatingConversationRef.current = false
      setCurrentConversationId(conversationId || "")
      return
    }

    // When conversationId changes externally, reset the local state
    setCurrentConversationId(conversationId || "")

    // If switching to a new chat (no conversationId), clear messages
    if (!conversationId) {
      setMessages([])
      setStreamingMessage(null)
      setCurrentThinking(null)
      setIsProcessing(false)
      setNeedsConfirmation(false)
      setNodeProgress([])
      setSelectedArtifact(null)
      setLeadPreviewData(null)
      setLeadImportProgress(null)
    }
  }, [conversationId])

  // Auto-scroll when new user message is added
  useEffect(() => {
    // Only scroll when a new user message is added (not during streaming)
    if (messages.length > 0 && messages.at(-1)?.role === "user") {
      // Scroll to the latest user message, positioning it near the top
      lastUserMessageRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }, [messages.length, messages.at])

  const handleRemoveFile = useCallback(() => {
    setAttachedFile(null)
  }, [])

  // Handler for when leads are added via AddLeadSheet - auto-send message to AI
  const handleLeadsAdded = useCallback(
    async (groupId: string, groupName: string, leadsCount: number) => {
      // Create a user message that prompts AI to query and analyze the leads
      const userMessage: ChatMessage = {
        role: "user",
        content: `"${groupName}" 그룹에 ${leadsCount}개의 고객 정보를 업로드했어요.`,
        additionalPrompt: `"${groupName}" 그룹(ID: ${groupId})에 ${leadsCount}개의 리드가 추가되었습니다.

이 그룹의 리드 데이터를 조회하고 분석해주세요:
1. 먼저 customer_group_members와 leads 테이블을 조인하여 이 그룹의 리드를 조회해주세요
2. 회사명, 업종, 국가/도시, 회사 규모 등의 패턴을 파악해주세요
3. 이 리드들의 특성에 맞는 이메일 캠페인(시퀀스) 전략을 제안해주세요:
   - 각 이메일의 주제 등`,
        timestamp: new Date(),
        metadata: {
          leadGroupCreated: {
            groupId,
            groupName,
            leadsCount,
          },
        },
      }

      // Add message and trigger chatbot
      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      // ⭐ CRITICAL: Clear selectedArtifact and initialize empty streamingMessage
      // This ensures artifact panel shows ONLY current streaming data
      setSelectedArtifact(null)
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
        metadata: {
          sql: undefined,
          result: undefined,
          insights: undefined,
          followUpQuestions: undefined,
        },
      })

      // Call chatbot API with the lead group info
      let convId = conversationId || `conv_${Date.now()}`

      // If this is a new conversation, create it in DB
      const isNewConversation = !conversationId && messages.length === 0
      if (isNewConversation && onConversationCreated) {
        try {
          isCreatingConversationRef.current = true
          const newId = await onConversationCreated(convId, userMessage.content)
          if (newId) {
            convId = newId
          }
        } catch (error) {
          console.error("Failed to create conversation:", error)
          isCreatingConversationRef.current = false
        }
      }

      setCurrentConversationId(convId)

      chatbotMutation.mutateAsync({
        question: userMessage.additionalPrompt || userMessage.content,
        workspaceId,
        conversationId: convId,
        messages: [...messages, userMessage],
        locale: i18n.language,
      })
    },
    [messages, chatbotMutation, workspaceId, conversationId, i18n.language, onConversationCreated],
  )

  const handleStop = useCallback(() => {
    // Stop the current processing
    setIsProcessing(false)
    setStreamingMessage(null)
    setCurrentThinking(null)
  }, [])

  const handleSubmit = useCallback(
    async (customInput?: string) => {
      const questionText = customInput || input
      if (!(questionText.trim() || attachedFile) || isProcessing) {
        return
      }

      setIsProcessing(true)

      // OPTIMIZATION: Don't combine CSV content with prompt
      // Let the server handle CSV data separately for better performance
      const finalContent = questionText

      const userMessage: ChatMessage = {
        role: "user",
        content: finalContent,
        timestamp: new Date(),
        attachment: attachedFile || undefined,
      }

      // Add user message to the list
      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setAttachedFile(null)

      // ⭐ CRITICAL: Clear selectedArtifact and initialize empty streamingMessage
      // This ensures artifact panel shows ONLY current streaming data
      setSelectedArtifact(null)
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
        metadata: {
          sql: undefined,
          result: undefined,
          insights: undefined,
          followUpQuestions: undefined,
        },
      })

      // Use TanStack Query mutation
      let convId = conversationId || `conv_${Date.now()}`

      // If this is a new conversation (no conversationId), notify parent to create it in DB
      const isNewConversation = !conversationId && messages.length === 0
      if (isNewConversation && onConversationCreated) {
        try {
          // Mark that we're creating a conversation to avoid resetting messages in useEffect
          isCreatingConversationRef.current = true
          const newId = await onConversationCreated(convId, questionText)
          if (newId) {
            convId = newId
          }
        } catch (error) {
          console.error("Failed to create conversation:", error)
          isCreatingConversationRef.current = false
        }
      }

      setCurrentConversationId(convId)

      // CRITICAL FIX: Don't call API inside setState
      // Call API directly with the updated messages
      try {
        await chatbotMutation.mutateAsync({
          question: questionText,
          workspaceId,
          conversationId: convId,
          messages: [...messages, userMessage], // Use computed messages
          locale: i18n.language,
        })
      } catch (error) {
        // Error is already handled in onError callback
        console.error("Submit error:", error)
      }
    },
    [
      input,
      isProcessing,
      chatbotMutation,
      workspaceId,
      conversationId,
      attachedFile,
      messages,
      i18n.language,
      onConversationCreated,
    ],
  )

  // Get previous questions from messages (user messages only)
  const previousQuestions = messages
    .filter((msg) => msg.role === "user")
    .map((msg) => msg.content)
    .filter((content) => content.trim().length > 0)
    .slice(-5) // Show last 5 questions
    .reverse() // Most recent first

  // Suggested questions for empty state
  const suggestedQuestions = [
    t("chatbot.suggested.question1"),
    t("chatbot.suggested.question2"),
    t("chatbot.suggested.question3"),
    t("chatbot.suggested.question4"),
    t("chatbot.suggested.question5"),
    t("chatbot.suggested.question6"),
  ]

  // Use previous questions if available, otherwise use suggested questions
  const displayQuestions = previousQuestions.length > 0 ? previousQuestions : suggestedQuestions

  const handleSelectQuestion = useCallback(
    (question: string) => {
      setInput(question)
      setShowSuggestions(false)
      // Immediately submit the selected question
      setTimeout(() => {
        handleSubmit(question)
      }, 0)
    },
    [handleSubmit],
  )

  const handleLeadImportApproval = useCallback(
    async (approved: boolean) => {
      if (!(approved && leadPreviewData)) {
        // User rejected
        const rejectionMessage: ChatMessage = {
          role: "assistant",
          content: t("chatbot.lead.import.cancelled"),
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, rejectionMessage])
        setLeadPreviewData(null)
        return
      }

      // User approved - start actual import
      setIsProcessing(true)

      // Show approval message
      const approvalMessage: ChatMessage = {
        role: "user",
        content: t("chatbot.lead.import.approved"),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, approvalMessage])

      // Clear lead preview and show progress UI
      setLeadPreviewData(null)

      // Import upload service
      const { uploadLeadsFile } = await import("@/lib/api/services/lead-import")

      // Track progress logs and timing
      const progressLogs: Array<{
        timestamp: number
        message: string
        type: "info" | "success" | "warning" | "error"
        processed?: number
        total?: number
      }> = []
      const startTime = Date.now()

      try {
        const result = await uploadLeadsFile({
          file: leadPreviewData.file,
          workspaceId,
          sheetName: leadPreviewData.sheetName,
          onProgress: (progress) => {
            // Update lead import progress state for real-time UI
            setLeadImportProgress(progress)

            // Collect progress logs
            if (progress.type === "progress" && progress.currentCompanyName) {
              progressLogs.push({
                timestamp: Date.now(),
                message: `Processing: ${progress.currentCompanyName}${progress.currentRow ? ` (row #${progress.currentRow})` : ""}`,
                type: "info",
                processed: progress.processed,
                total: progress.total,
              })
            }
          },
        })

        // Add completion log
        progressLogs.push({
          timestamp: Date.now(),
          message: `Complete: ${result.success} succeeded, ${result.skipped} skipped, ${result.failed} failed`,
          type: "success",
          processed: result.total,
          total: result.total,
        })

        // Show final complete progress
        setLeadImportProgress({
          type: "complete",
          message: "Lead import complete!",
          timestamp: new Date().toISOString(),
          total: result.total,
          processed: result.total,
          success: result.success,
          skipped: result.skipped,
          failed: result.failed,
          result,
        })

        // Save result as a message with metadata for artifact display
        const completionMessage: ChatMessage = {
          role: "assistant",
          content: `${t("chatbot.lead.import.complete")}\n\n- ${t("chatbot.lead.import.succeeded")}: ${result.success}\n- ${t("chatbot.lead.import.skipped")}: ${result.skipped}\n- ${t("chatbot.lead.import.failed")}: ${result.failed}\n\n${t("chatbot.lead.import.viewArtifact")}`,
          timestamp: new Date(),
          metadata: {
            importResult: result,
            progressLogs,
            startTime,
          },
        }

        // Keep progress visible for a moment, then add message and clear
        setTimeout(() => {
          setMessages((prev) => [...prev, completionMessage])
          setLeadImportProgress(null)
          setIsProcessing(false)
        }, 2000)
      } catch (error) {
        console.error("Lead import failed:", error)

        // Show error in progress UI
        setLeadImportProgress({
          type: "error",
          error: error instanceof Error ? error.message : "An unknown error occurred",
          timestamp: new Date().toISOString(),
        })

        // Keep error visible for a moment
        setTimeout(() => {
          setLeadImportProgress(null)
          setIsProcessing(false)
        }, 5000)
      }
    },
    [leadPreviewData, workspaceId, t],
  )

  const handleConfirmation = useCallback(
    async (confirmed: boolean) => {
      if (!confirmed) {
        // User rejected - add rejection message and clear confirmation state
        if (streamingMessage) {
          setMessages((prev) => [
            ...prev,
            streamingMessage,
            {
              role: "assistant",
              content: t("chatbot.operation.cancelled"),
              timestamp: new Date(),
            },
          ])
        }
        setStreamingMessage(null)
        setNeedsConfirmation(false)
        setIsProcessing(false)
        return
      }

      // User confirmed - continue execution
      setIsProcessing(true)
      setNeedsConfirmation(false)

      // Add confirmation message to messages
      if (streamingMessage) {
        setMessages((prev) => [...prev, streamingMessage])
      }
      setStreamingMessage(null)

      // Initialize new streaming message for results
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
      })

      try {
        await chatbotApi.confirmMutation(currentConversationId, true, {
          onMessage: (message) => {
            setMessages((prev) => [...prev, message])
            setStreamingMessage(null)
            setCurrentThinking(null)
            setIsProcessing(false)
          },
          onMessageUpdate: (message) => {
            setStreamingMessage(message)
          },
          onThinking: (thinking) => {
            setCurrentThinking(thinking)
          },
          onError: (error) => {
            console.error("Confirmation error:", error)
            setStreamingMessage(null)
            setCurrentThinking(null)
            setIsProcessing(false)
          },
        })
      } catch (error) {
        console.error("Confirmation error:", error)
        setIsProcessing(false)
      }
    },
    [streamingMessage, currentConversationId, t],
  )

  const handleGenerateSequenceFromImport = useCallback(
    async (groupId: string, groupName: string, membersAdded: number) => {
      // Create a user message with sequence generation request metadata
      const userMessage: ChatMessage = {
        role: "user",
        content: `Generate an optimal email sequence for customer group "${groupName}"`,
        timestamp: new Date(),
        metadata: {
          sequenceGenerationRequest: {
            customerGroupId: groupId,
            customerGroupName: groupName,
            membersCount: membersAdded,
          },
        },
      }

      // Add message and trigger chatbot
      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      // ⭐ CRITICAL: Clear selectedArtifact and initialize empty streamingMessage
      // This ensures artifact panel shows ONLY current streaming data
      setSelectedArtifact(null)
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
        metadata: {
          sql: undefined,
          result: undefined,
          insights: undefined,
          followUpQuestions: undefined,
        },
      })

      // Call chatbot API with the sequence generation request
      let convId = conversationId || `conv_${Date.now()}`

      // If this is a new conversation, create it in DB
      const isNewConversation = !conversationId && messages.length === 0
      if (isNewConversation && onConversationCreated) {
        try {
          isCreatingConversationRef.current = true
          const newId = await onConversationCreated(convId, userMessage.content)
          if (newId) {
            convId = newId
          }
        } catch (error) {
          console.error("Failed to create conversation:", error)
          isCreatingConversationRef.current = false
        }
      }

      setCurrentConversationId(convId)

      chatbotMutation.mutateAsync({
        question: userMessage.content,
        workspaceId,
        conversationId: convId,
        messages: [...messages, userMessage],
        locale: i18n.language,
      })
    },
    [messages, chatbotMutation, workspaceId, conversationId, i18n.language, onConversationCreated],
  )

  // Handle sequence generation from modal
  const handleSequenceModalSubmit = useCallback(
    async (data: { customerGroupId: string; prompt: string }) => {
      // Find the customer group name from the list
      const group = customerGroups?.find((g) => g.id === data.customerGroupId)
      const groupName = group?.name || "선택된 그룹"

      // Create a user message with sequence generation request metadata
      const userMessage: ChatMessage = {
        role: "user",
        content: `${groupName} 그룹에 대한 이메일 시퀀스를 생성해주세요:\n\n${data.prompt}`,
        timestamp: new Date(),
        metadata: {
          sequenceGenerationRequest: {
            customerGroupId: data.customerGroupId,
            customerGroupName: groupName,
            membersCount: group?.leadCount || 0,
          },
        },
      }

      // Add message and trigger chatbot
      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)

      // ⭐ CRITICAL: Clear selectedArtifact and initialize empty streamingMessage
      // This ensures artifact panel shows ONLY current streaming data
      setSelectedArtifact(null)
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
        metadata: {
          sql: undefined,
          result: undefined,
          insights: undefined,
          followUpQuestions: undefined,
        },
      })

      // Call chatbot API with the sequence generation request
      let convId = conversationId || `conv_${Date.now()}`

      // If this is a new conversation, create it in DB
      const isNewConversation = !conversationId && messages.length === 0
      if (isNewConversation && onConversationCreated) {
        try {
          isCreatingConversationRef.current = true
          const newId = await onConversationCreated(convId, userMessage.content)
          if (newId) {
            convId = newId
          }
        } catch (error) {
          console.error("Failed to create conversation:", error)
          isCreatingConversationRef.current = false
        }
      }

      setCurrentConversationId(convId)

      await chatbotMutation.mutateAsync({
        question: userMessage.content,
        workspaceId,
        conversationId: convId,
        messages: [...messages, userMessage],
        locale: i18n.language,
      })
    },
    [
      messages,
      chatbotMutation,
      workspaceId,
      conversationId,
      customerGroups,
      i18n.language,
      onConversationCreated,
    ],
  )

  // Auto-resize textarea based on content
  useEffect(() => {
    const adjustHeight = (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) {
        return
      }

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto"

      // Calculate new height (max 400px)
      const newHeight = Math.min(textarea.scrollHeight, 400)
      textarea.style.height = `${newHeight}px`
    }

    adjustHeight(textareaRef.current)
    adjustHeight(textareaEmptyStateRef.current)
  }, [])

  // Handle click outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !textareaEmptyStateRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Quick question event listener
  useEffect(() => {
    const handleQuickQuestion = (event: CustomEvent) => {
      const question = event.detail.question
      setInput(question)
      setTimeout(() => {
        handleSubmit(question)
      }, 100)
    }

    window.addEventListener("quickQuestion", handleQuickQuestion as EventListener)

    return () => {
      window.removeEventListener("quickQuestion", handleQuickQuestion as EventListener)
    }
  }, [handleSubmit])

  // Handle split pane resize - optimized with instant state update
  const handleResize = useCallback((newLeftWidth: number) => {
    setLeftPanelWidth(newLeftWidth)

    // Debounce localStorage write - only save after user stops dragging for 300ms
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    resizeTimeoutRef.current = setTimeout(() => {
      localStorage.setItem("chatbot-split-width", newLeftWidth.toString())
    }, 300)
  }, [])

  const handleDragStart = useCallback(() => {
    setIsResizing(true)
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsResizing(false)
    // Ensure final width is saved immediately
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    localStorage.setItem("chatbot-split-width", leftPanelWidth.toString())
  }, [leftPanelWidth])

  // Show loading state while history is being fetched
  if (isLoadingHistory) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-1 w-1 animate-pulse rounded-full bg-current" />
          <div
            className="h-1 w-1 animate-pulse rounded-full bg-current"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="h-1 w-1 animate-pulse rounded-full bg-current"
            style={{ animationDelay: "0.4s" }}
          />
          <span className="ml-2 text-sm">{t("chatbot.loading.conversation")}</span>
        </div>
      </div>
    )
  }

  // Helper function to check if metadata has any artifact data
  const hasArtifactData = (metadata: ChatMessage["metadata"]) => {
    if (!metadata) {
      return false
    }
    return (
      (metadata.insights && metadata.insights.length > 0) ||
      !!metadata.sql ||
      !!metadata.result ||
      !!metadata.leadPreview ||
      !!metadata.importResult
    )
  }

  // ⭐ SMART ARTIFACT SOURCE SELECTION
  // Determines which message to display artifacts from, with priority:
  // 1. Explicit user selection (selectedArtifact)
  // 2. Current streaming message (streamingMessage)
  // 3. Latest completed message (when idle)
  const currentArtifactSource =
    selectedArtifact ||
    streamingMessage ||
    (!(isProcessing || selectedArtifact) && messages.length > 0 ? messages.at(-1) : null)

  // Check if any message has artifact data (for split view)
  const hasAnyArtifact =
    (currentArtifactSource?.metadata && hasArtifactData(currentArtifactSource.metadata)) ||
    !!leadPreviewData ||
    !!leadImportProgress

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Add Lead Sheet - Smart CSV/XLSX parsing with column mapping */}
      <AddLeadSheet
        customerGroups={customerGroups || []}
        onComplete={handleLeadsAdded}
        onOpenChange={setIsUploadModalOpen}
        open={isUploadModalOpen}
        uploadOnly={true}
        workspaceId={workspaceId}
      />

      {/* Sequence Generator Modal - Triggered by chatbot when user asks to create sequence */}
      <SequenceGeneratorModal
        defaultCustomerGroupId={defaultCustomerGroupId}
        onOpenChange={setIsSequenceModalOpen}
        onSubmit={handleSequenceModalSubmit}
        open={isSequenceModalOpen}
        workspaceId={workspaceId}
      />

      {messages.length === 0 ? (
        // Empty state - Everything centered vertically and horizontally
        <div className="flex flex-1 flex-col items-center px-4 pt-[20vh] pb-8">
          <div className="mx-auto w-full space-y-8" style={{ maxWidth: "670px" }}>
            {/* Logo */}
            <div className="flex items-center justify-center gap-2">
              <img alt="RINDA" className="h-10 w-auto" src={TextRinda} />
              <img alt="Plus" className="h-10 w-auto" src={TextPlus} />
            </div>

            {/* File attachment preview */}
            {attachedFile && (
              <div className="flex justify-center">
                <FileAttachment
                  fileName={attachedFile.fileName}
                  fileSize={attachedFile.fileSize}
                  onRemove={handleRemoveFile}
                  variant="removable"
                />
              </div>
            )}

            {/* Input area - Centered */}
            <div className="relative w-full">
              <div className="relative rounded-2xl border bg-background shadow-sm">
                <Textarea
                  className="min-h-[64px] resize-none overflow-y-auto rounded-2xl border-0 bg-transparent pt-4 pr-12 pb-12 pl-4 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                  onChange={(e) => {
                    setInput(e.target.value)
                    if (e.target.value.length > 0) {
                      setShowSuggestions(false)
                    }
                  }}
                  onFocus={() => {
                    if (input.length === 0) {
                      setShowSuggestions(true)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder={t("chatbot.input.placeholder")}
                  ref={textareaEmptyStateRef}
                  style={{ maxHeight: "400px" }}
                  value={input}
                />
                {/* Submit / Stop button */}
                <Button
                  className="absolute right-3 bottom-3 h-8 w-8 rounded-full"
                  disabled={!(isProcessing || input.trim() || attachedFile)}
                  onClick={() => (isProcessing ? handleStop() : handleSubmit())}
                  size="icon"
                >
                  {isProcessing ? (
                    <Square className="h-4 w-4" fill="currentColor" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
                {/* Drop Your Leads Here button - Bottom left */}
                <Button
                  className="absolute bottom-3 left-3 h-8 rounded-lg px-3 font-medium text-sm"
                  disabled={!!attachedFile || isProcessing}
                  onClick={() => setIsUploadModalOpen(true)}
                  variant="outline"
                >
                  {t("chatbot.button.dropLeads")}
                </Button>
              </div>

              {/* Suggested questions below input */}
              {showSuggestions && displayQuestions.length > 0 && !isProcessing && (
                <div
                  className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border bg-background shadow-lg"
                  ref={suggestionsRef}
                >
                  <div className="max-h-[300px] overflow-y-auto">
                    {displayQuestions.map((question) => (
                      <button
                        className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
                        key={question}
                        onClick={() => handleSelectQuestion(question)}
                        type="button"
                      >
                        <Search className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                        <span className="line-clamp-2 text-[15px] text-foreground leading-relaxed">
                          {question}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Messages view - Claude-style split layout when artifacts exist
        <div className="flex flex-1 overflow-hidden">
          {/* Left side: Messages + Input (dynamic width when artifact exists, 100% otherwise) */}
          <div
            className={`flex flex-col ${isResizing ? "" : "transition-all duration-300"}`}
            style={{
              width: hasAnyArtifact ? `${leftPanelWidth}%` : "100%",
            }}
          >
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-8 pb-24">
                <div className="space-y-6">
                  {messages.map((message, index) => {
                    // Find the corresponding user question for this assistant message
                    let questionText: string | undefined
                    if (message.role === "assistant" && index > 0) {
                      for (let i = index - 1; i >= 0; i--) {
                        if (messages[i].role === "user") {
                          questionText = messages[i].content
                          break
                        }
                      }
                    }

                    // Determine if this is the last user message
                    const isLastUserMessage =
                      message.role === "user" && index === messages.length - 1

                    // Ensure timestamp is a Date object for key generation
                    const timestampValue = message.timestamp
                      ? typeof message.timestamp === "string"
                        ? new Date(message.timestamp).getTime()
                        : message.timestamp.getTime()
                      : index

                    return (
                      <MessageBubble
                        hideArtifact={hasAnyArtifact}
                        isStreaming={false}
                        key={`msg-${index}-${timestampValue}`}
                        message={message}
                        onViewArtifact={() => setSelectedArtifact(message)}
                        questionText={questionText}
                        ref={isLastUserMessage ? lastUserMessageRef : undefined}
                      />
                    )
                  })}

                  {/* Unified streaming container - Claude/ChatGPT style */}
                  <StreamingMessageContainer
                    hideArtifact={hasAnyArtifact}
                    isStreaming={!needsConfirmation}
                    message={streamingMessage}
                    needsConfirmation={needsConfirmation}
                    nodeProgress={nodeProgress}
                    onConfirm={handleConfirmation}
                    thinkingMessage={currentThinking}
                  />

                  <div ref={scrollRef} />
                </div>
              </div>
            </div>

            {/* Input area - Fixed at bottom */}
            <div className="relative border-border border-t">
              {/* Input container */}
              <div className="bg-background p-4">
                <div
                  className="mx-auto w-full"
                  style={{ maxWidth: hasAnyArtifact ? "100%" : "670px" }}
                >
                  {/* File attachment preview */}
                  {attachedFile && (
                    <div className="mb-3 flex items-center gap-2">
                      <FileAttachment
                        fileName={attachedFile.fileName}
                        fileSize={attachedFile.fileSize}
                        onRemove={handleRemoveFile}
                        variant="removable"
                      />
                    </div>
                  )}

                  {/* Input area */}
                  <div className="relative w-full">
                    <div className="relative rounded-2xl border bg-background">
                      <Textarea
                        className="min-h-[56px] resize-none overflow-y-auto rounded-2xl border-0 bg-transparent pt-3 pr-12 pb-11 pl-4 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit()
                          }
                        }}
                        placeholder={t("chatbot.input.placeholder")}
                        ref={textareaRef}
                        style={{ maxHeight: "400px" }}
                        value={input}
                      />
                      {/* Submit / Stop button */}
                      <Button
                        className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
                        disabled={!(isProcessing || input.trim() || attachedFile)}
                        onClick={() => (isProcessing ? handleStop() : handleSubmit())}
                        size="icon"
                      >
                        {isProcessing ? (
                          <Square className="h-4 w-4" fill="currentColor" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Drop Your Leads Here button - Bottom left */}
                      <Button
                        className="absolute bottom-2 left-2 h-8 rounded-lg px-3 font-medium text-sm"
                        disabled={!!attachedFile || isProcessing}
                        onClick={() => setIsUploadModalOpen(true)}
                        variant="outline"
                      >
                        {t("chatbot.button.dropLeads")}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resizable divider */}
          {hasAnyArtifact && (
            <ResizableDivider
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
              onResize={handleResize}
            />
          )}

          {/* Right side: Artifact panel (dynamic width, full height, sticky) */}
          {hasAnyArtifact && (
            <div
              className={`overflow-hidden bg-muted/20 ${isResizing ? "" : "transition-all duration-300"}`}
              style={{
                width: `${100 - leftPanelWidth}%`,
              }}
            >
              <DataArtifact
                data={currentArtifactSource?.metadata?.result}
                insights={currentArtifactSource?.metadata?.insights}
                isStreaming={!selectedArtifact && isProcessing}
                leadImportProgress={leadImportProgress || undefined}
                leadImportResult={currentArtifactSource?.metadata?.importResult}
                leadPreview={leadPreviewData || currentArtifactSource?.metadata?.leadPreview}
                onGenerateSequence={handleGenerateSequenceFromImport}
                onLeadImportApproval={handleLeadImportApproval}
                progressLogs={currentArtifactSource?.metadata?.progressLogs}
                question={(() => {
                  // Find the corresponding user question for the artifact source
                  if (currentArtifactSource) {
                    const sourceIndex = messages.indexOf(currentArtifactSource)
                    if (sourceIndex > 0) {
                      // Find the user message before this assistant message
                      for (let i = sourceIndex - 1; i >= 0; i--) {
                        if (messages[i].role === "user") {
                          return messages[i].content
                        }
                      }
                    }
                  }
                  // Fallback: find the last user message
                  const userMessages = messages.filter((m) => m.role === "user")
                  return userMessages.at(-1)?.content || undefined
                })()}
                sql={currentArtifactSource?.metadata?.sql}
                startTime={currentArtifactSource?.metadata?.startTime}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
