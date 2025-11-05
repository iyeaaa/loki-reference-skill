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
import type { FileAttachment as FileAttachmentType } from "@/lib/api/types/chatbot"
import { readFileAsText } from "@/lib/utils/csv"
import { FileAttachment } from "./FileAttachment"
import { MessageBubble } from "./MessageBubble"
import { ThinkingIndicator } from "./ThinkingIndicator"

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
    // Final message - replace streaming message with completed one
    setMessages((prev) => [...prev, message])
    setStreamingMessage(null)
    setCurrentThinking(null)
    setIsProcessing(false)
    setNeedsConfirmation(false)
  }, [])

  const handleMessageUpdate = useCallback((message: ChatMessage) => {
    // Real-time streaming update
    setStreamingMessage(message)
  }, [])

  const handleThinking = useCallback((thinking: string) => {
    setCurrentThinking(thinking)
  }, [])

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
  }, [])

  // Setup chatbot mutation with TanStack Query - memoized to prevent recreation
  const chatbotMutation = useChatbotMutation({
    onMessage: handleMessage,
    onMessageUpdate: handleMessageUpdate,
    onThinking: handleThinking,
    onConfirmationRequired: handleConfirmationRequired,
    onError: handleError,
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

      // Only accept CSV files
      if (!file.name.endsWith(".csv")) {
        alert("Only CSV files are allowed.")
        return
      }

      try {
        // Mark as processing
        isProcessingFileRef.current = true

        // Read file content
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
      } catch (error) {
        console.error("Failed to read file:", error)
        alert("Failed to read file.")
        isProcessingFileRef.current = false
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
    "What insights can you provide from my customer data?",
    "Help me create customer segments for targeted campaigns",
    "Analyze customer behavior patterns",
    "Generate email sequences based on customer data",
    "What are the key trends in my sales data?",
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

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Hidden file input - shared across all states */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
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
                  <DropdownMenuContent side="top" align="start" className="w-48">
                    <DropdownMenuItem
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!!attachedFile || isProcessing}
                      className="gap-2 cursor-pointer"
                    >
                      <FileText className="h-4 w-4" />
                      Upload CSV File
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
        // Messages view - Traditional layout with fixed input at bottom
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto">
            {/* Messages */}
            <div className="mx-auto max-w-3xl px-4 py-8">
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={`msg-${index}-${message.timestamp?.getTime() || index}`}
                    message={message}
                    isStreaming={false}
                  />
                ))}

                {streamingMessage && (
                  <MessageBubble
                    key="streaming-message"
                    message={streamingMessage}
                    isStreaming={!needsConfirmation}
                    needsConfirmation={needsConfirmation}
                    onConfirm={handleConfirmation}
                  />
                )}

                {currentThinking && !streamingMessage?.content && (
                  <ThinkingIndicator key="thinking" thinking={currentThinking} />
                )}

                <div ref={scrollRef} />
              </div>
            </div>
          </div>

          {/* Input area - Fixed at bottom */}
          <div className="bg-background/95 backdrop-blur">
            <div className="mx-auto w-full px-4 py-2" style={{ maxWidth: "670px" }}>
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
                    <DropdownMenuContent side="top" align="start" className="w-48">
                      <DropdownMenuItem
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!!attachedFile || isProcessing}
                        className="gap-2 cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        Upload CSV File
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
