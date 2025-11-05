import { ArrowUp, FileText, Plus, Search, Square } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { type ChatMessage, useChatbotHistory, useChatbotMutation } from "@/lib/api/hooks/chatbot"
import { chatbotApi } from "@/lib/api/services/chatbot"
import type {
  FileAttachment as FileAttachmentType,
  NodeProgressUpdate,
} from "@/lib/api/types/chatbot"
import { readFileAsText } from "@/lib/utils/csv"
import { DataArtifact } from "./DataArtifact"
import { FileAttachment } from "./FileAttachment"
import { MessageBubble } from "./MessageBubble"
import type { NodeProgress } from "./NodeProgressTracker"
import { StreamingMessageContainer } from "./StreamingMessageContainer"

interface ChatInterfaceProps {
  workspaceId: string
  conversationId?: string
}

export function ChatInterface({ workspaceId, conversationId }: ChatInterfaceProps) {
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isProcessingFileRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaEmptyStateRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load conversation history if conversationId is provided
  const { data: historyData, isLoading: isLoadingHistory } = useChatbotHistory(
    conversationId || "",
    !!conversationId,
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

  // Setup chatbot mutation with TanStack Query - memoized to prevent recreation
  const chatbotMutation = useChatbotMutation({
    onMessage: handleMessage,
    onMessageUpdate: handleMessageUpdate,
    onThinking: handleThinking,
    onProgress: handleProgress,
    onConfirmationRequired: handleConfirmationRequired,
    onError: handleError,
    onNodeProgress: handleNodeProgress,
  })

  // Load history into messages when available
  useEffect(() => {
    if (historyData?.messages) {
      setMessages(historyData.messages)
    }
  }, [historyData])

  // Auto-scroll when messages or thinking state changes
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
    // Dependency array is intentionally empty to avoid infinite scrolling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Prevent duplicate processing
      if (isProcessingFileRef.current) {
        console.log("[ChatInterface] File already being processed, skipping duplicate")
        return
      }

      // Accept CSV, XLSX, XLS files
      const fileName = file.name.toLowerCase()
      if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        alert("Only CSV, XLSX, or XLS files are allowed.")
        return
      }

      try {
        // Mark as processing
        isProcessingFileRef.current = true

        // Check file type: xlsx/xls vs csv
        const isExcelFile = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

        if (isExcelFile) {
          // Excel file: Use lead-import API
          const fileAttachment: FileAttachmentType = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }

          setAttachedFile(fileAttachment)

          // Display user message about xlsx upload
          const userMessage: ChatMessage = {
            role: "user",
            content: "리드 데이터 임포트를 시작합니다",
            timestamp: new Date(),
            attachment: fileAttachment,
          }

          setMessages((prev) => [...prev, userMessage])
          setAttachedFile(null)
          setIsProcessing(true)

          // Initialize streaming message for import progress
          setStreamingMessage({
            role: "assistant",
            content: "임포트를 시작합니다...",
            timestamp: new Date(),
          })

          // Import lead-import service dynamically
          const { uploadLeadsFile } = await import("@/lib/api/services/lead-import")

          try {
            const result = await uploadLeadsFile({
              file,
              workspaceId,
              sheetName: "", // Will auto-select first sheet
              onProgress: (progress) => {
                // Update streaming message with progress
                const progressMsg = `임포트 진행 중: ${progress.processed || 0} / ${progress.total || 0}\n성공: ${progress.success || 0}, 스킵: ${progress.skipped || 0}, 실패: ${progress.failed || 0}`

                setStreamingMessage({
                  role: "assistant",
                  content: progressMsg,
                  timestamp: new Date(),
                  metadata: {
                    importProgress: progress,
                  },
                })
              },
            })

            // Final success message with artifact
            const finalMessage: ChatMessage = {
              role: "assistant",
              content: `임포트가 완료되었습니다!\n\n- 총 처리: ${result.total}건\n- 성공: ${result.success}건\n- 스킵: ${result.skipped}건\n- 실패: ${result.failed}건`,
              timestamp: new Date(),
              metadata: {
                importResult: result,
              },
            }

            setMessages((prev) => [...prev, finalMessage])
            setStreamingMessage(null)
          } catch (error) {
            console.error("Lead import failed:", error)
            const errorMessage: ChatMessage = {
              role: "assistant",
              content: `임포트 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
              timestamp: new Date(),
            }
            setMessages((prev) => [...prev, errorMessage])
            setStreamingMessage(null)
          } finally {
            setIsProcessing(false)
            isProcessingFileRef.current = false
          }
        } else {
          // CSV file: Use chatbot API (existing logic)
          const fileContent = await readFileAsText(file)

          // OPTIMIZATION: Don't parse CSV to verbose text format
          // Send raw CSV data - server will handle it more efficiently
          const fileAttachment: FileAttachmentType = {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            content: fileContent, // Raw CSV content, not parsed text
          }

          setAttachedFile(fileAttachment)

          // Auto-submit with custom prompt when CSV is uploaded
          const autoPrompt =
            "Create customer groups and leads, then design optimal sequences from attached CSV data"

          // Submit immediately with the auto prompt
          setIsProcessing(true)

          // Send ONLY the prompt, CSV data will be in attachment
          const finalContent = autoPrompt

          const userMessage: ChatMessage = {
            role: "user",
            content: finalContent,
            timestamp: new Date(),
            attachment: fileAttachment,
          }

          // Add user message to the list
          setMessages((prev) => [...prev, userMessage])
          setAttachedFile(null)

          // Initialize streaming message
          setStreamingMessage({
            role: "assistant",
            content: "",
            timestamp: new Date(),
          })

          // Use TanStack Query mutation
          const convId = conversationId || `conv_${Date.now()}`
          setCurrentConversationId(convId)

          // CRITICAL FIX: Don't call API inside setState
          // Call API directly with the updated messages
          try {
            await chatbotMutation.mutateAsync({
              question: finalContent,
              workspaceId,
              conversationId: convId,
              messages: [...messages, userMessage], // Use computed messages
            })
          } catch (error) {
            // Error is already handled in onError callback
            console.error("Submit error:", error)
          } finally {
            // Reset processing flag after completion
            isProcessingFileRef.current = false
          }
        }
      } catch (error) {
        console.error("Failed to process file:", error)
        alert("Failed to process file.")
        isProcessingFileRef.current = false
        setIsProcessing(false)
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [conversationId, workspaceId, chatbotMutation, messages],
  )

  const handleRemoveFile = useCallback(() => {
    setAttachedFile(null)
  }, [])

  const handleStop = useCallback(() => {
    // Stop the current processing
    setIsProcessing(false)
    setStreamingMessage(null)
    setCurrentThinking(null)
  }, [])

  const handleSubmit = useCallback(
    async (customInput?: string) => {
      const questionText = customInput || input
      if ((!questionText.trim() && !attachedFile) || isProcessing) return

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

      // Initialize streaming message
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
      })

      // Use TanStack Query mutation
      const convId = conversationId || `conv_${Date.now()}`
      setCurrentConversationId(convId)

      // CRITICAL FIX: Don't call API inside setState
      // Call API directly with the updated messages
      try {
        await chatbotMutation.mutateAsync({
          question: questionText,
          workspaceId,
          conversationId: convId,
          messages: [...messages, userMessage], // Use computed messages
        })
      } catch (error) {
        // Error is already handled in onError callback
        console.error("Submit error:", error)
      }
    },
    [input, isProcessing, chatbotMutation, workspaceId, conversationId, attachedFile, messages],
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
    "이번 달 이메일 성과는 어때?",
    "오픈율이 가장 높은 이메일 제목은?",
    "클릭률이 낮은 이메일의 공통점은?",
    "지난 주 대비 이번 주 응답률 변화는?",
    "반응이 좋은 발송 시간대는?",
    "이탈률이 높은 시퀀스는?",
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
              content: "Operation canceled.",
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
    [streamingMessage, currentConversationId],
  )

  // Auto-resize textarea based on content
  useEffect(() => {
    const adjustHeight = (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return

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
          <span className="ml-2 text-sm">Loading conversation...</span>
        </div>
      </div>
    )
  }

  // Check if any message has artifact data (for split view)
  const hasAnyArtifact =
    messages.some(
      (msg) => (msg.metadata?.insights && msg.metadata.insights.length > 0) || !!msg.metadata?.sql,
    ) ||
    (streamingMessage?.metadata?.insights && streamingMessage.metadata.insights.length > 0) ||
    !!streamingMessage?.metadata?.sql

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Hidden file input - shared across all states */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        onClick={(e) => {
          if (isProcessingFileRef.current) {
            e.preventDefault()
          }
        }}
        className="hidden"
      />

      {messages.length === 0 ? (
        // Empty state - Everything centered vertically and horizontally
        <div className="flex-1 flex flex-col items-center px-4 pt-[20vh] pb-8">
          <div className="mx-auto w-full space-y-8" style={{ maxWidth: "670px" }}>
            {/* Title */}
            <h1 className="text-3xl font-medium tracking-tight text-center">Ask RINDA anything</h1>

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
              <div className="relative border rounded-2xl shadow-sm bg-background">
                <Textarea
                  ref={textareaEmptyStateRef}
                  value={input}
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
                  placeholder="Ask a question about your data..."
                  className="min-h-[64px] resize-none pl-4 pr-12 pt-4 pb-12 text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto bg-transparent rounded-2xl placeholder:text-muted-foreground/60"
                  style={{ maxHeight: "400px" }}
                />
                {/* Submit / Stop button */}
                <Button
                  onClick={() => (isProcessing ? handleStop() : handleSubmit())}
                  disabled={!isProcessing && !input.trim() && !attachedFile}
                  size="icon"
                  className="absolute bottom-3 right-3 h-8 w-8 rounded-full"
                >
                  {isProcessing ? (
                    <Square className="h-4 w-4" fill="currentColor" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
                {/* Plus button with dropdown - Bottom left */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute bottom-3 left-3 h-8 w-8 rounded-lg"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="top" align="start" className="w-56">
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!!attachedFile || isProcessing}
                      className="gap-2 cursor-pointer"
                    >
                      <FileText className="h-4 w-4" />
                      Upload Excel/CSV File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Suggested questions below input */}
              {showSuggestions && displayQuestions.length > 0 && !isProcessing && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-full mt-2 w-full bg-background border rounded-2xl shadow-lg overflow-hidden z-50"
                >
                  <div className="max-h-[300px] overflow-y-auto">
                    {displayQuestions.map((question, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectQuestion(question)}
                        className="w-full px-4 py-3 text-left hover:bg-accent transition-colors flex items-start gap-3 group"
                      >
                        <Search className="h-4 w-4 mt-0.5 text-muted-foreground group-hover:text-foreground flex-shrink-0" />
                        <span className="text-[15px] leading-relaxed text-foreground line-clamp-2">
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
        <div className="flex-1 flex overflow-hidden">
          {/* Left side: Messages + Input (50% when artifact exists, 100% otherwise) */}
          <div
            className={`flex flex-col ${hasAnyArtifact ? "w-1/2" : "w-full"} transition-all duration-300`}
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

                    return (
                      <MessageBubble
                        key={`msg-${index}-${message.timestamp?.getTime() || index}`}
                        message={message}
                        isStreaming={false}
                        hideArtifact={hasAnyArtifact}
                        onViewArtifact={() => setSelectedArtifact(message)}
                        questionText={questionText}
                      />
                    )
                  })}

                  {/* Unified streaming container - Claude/ChatGPT style */}
                  <StreamingMessageContainer
                    message={streamingMessage}
                    isStreaming={!needsConfirmation}
                    needsConfirmation={needsConfirmation}
                    onConfirm={handleConfirmation}
                    nodeProgress={nodeProgress}
                    thinkingMessage={currentThinking}
                    hideArtifact={hasAnyArtifact}
                  />

                  <div ref={scrollRef} />
                </div>
              </div>
            </div>

            {/* Input area - Fixed at bottom */}
            <div className="relative border-t border-border">
              {/* Input container */}
              <div className="bg-background p-4">
                <div
                  className="mx-auto w-full"
                  style={{ maxWidth: hasAnyArtifact ? "100%" : "670px" }}
                >
                  {/* File attachment preview */}
                  {attachedFile && (
                    <div className="flex items-center gap-2 mb-3">
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
                    <div className="relative border rounded-2xl bg-background">
                      <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            handleSubmit()
                          }
                        }}
                        placeholder="Ask a question about your data..."
                        className="min-h-[56px] resize-none pl-4 pr-12 pt-3 pb-11 text-[15px] leading-relaxed border-0 focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto bg-transparent rounded-2xl placeholder:text-muted-foreground/60"
                        style={{ maxHeight: "400px" }}
                      />
                      {/* Submit / Stop button */}
                      <Button
                        onClick={() => (isProcessing ? handleStop() : handleSubmit())}
                        disabled={!isProcessing && !input.trim() && !attachedFile}
                        size="icon"
                        className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
                      >
                        {isProcessing ? (
                          <Square className="h-4 w-4" fill="currentColor" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </Button>
                      {/* Plus button with dropdown - Bottom left */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className="absolute bottom-2 left-2 h-8 w-8 rounded-lg"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="start" className="w-56">
                          <DropdownMenuItem
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!!attachedFile || isProcessing}
                            className="gap-2 cursor-pointer"
                          >
                            <FileText className="h-4 w-4" />
                            Upload Excel/CSV File
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side: Artifact panel (50% width, full height, sticky) */}
          {hasAnyArtifact && (
            <div className="w-1/2 border-l border-border bg-muted/20 overflow-hidden">
              <DataArtifact
                sql={
                  selectedArtifact?.metadata?.sql ||
                  streamingMessage?.metadata?.sql ||
                  messages[messages.length - 1]?.metadata?.sql
                }
                insights={
                  selectedArtifact?.metadata?.insights ||
                  streamingMessage?.metadata?.insights ||
                  messages[messages.length - 1]?.metadata?.insights
                }
                data={
                  selectedArtifact?.metadata?.result ||
                  streamingMessage?.metadata?.result ||
                  messages[messages.length - 1]?.metadata?.result
                }
                isStreaming={!selectedArtifact && isProcessing}
                question={(() => {
                  // If selected artifact, find its corresponding user message
                  if (selectedArtifact) {
                    const selectedIndex = messages.indexOf(selectedArtifact)
                    if (selectedIndex > 0) {
                      // Find the user message before this assistant message
                      for (let i = selectedIndex - 1; i >= 0; i--) {
                        if (messages[i].role === "user") {
                          return messages[i].content
                        }
                      }
                    }
                  }
                  // Otherwise, find the last user message
                  const userMessages = messages.filter((m) => m.role === "user")
                  return userMessages[userMessages.length - 1]?.content || undefined
                })()}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
