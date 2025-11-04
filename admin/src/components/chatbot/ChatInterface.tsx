import { ArrowUp, BarChart3, GitBranch, Paperclip, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { type ChatMessage, useChatbotHistory, useChatbotMutation } from "@/lib/api/hooks/chatbot"
import { chatbotApi } from "@/lib/api/services/chatbot"
import type { FileAttachment as FileAttachmentType } from "@/lib/api/types/chatbot"
import { parseCsvToText, readFileAsText } from "@/lib/utils/csv"
import { FileAttachment } from "./FileAttachment"
import { MessageBubble } from "./MessageBubble"
import { ThinkingIndicator } from "./ThinkingIndicator"

interface ChatInterfaceProps {
  workspaceId: string
  conversationId?: string
}

type QuestionCategory = "performance" | "leads" | "sequences"

export function ChatInterface({ workspaceId, conversationId }: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null)
  const [currentThinking, setCurrentThinking] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory>("performance")
  const [isProcessing, setIsProcessing] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState(conversationId || "")
  const [attachedFile, setAttachedFile] = useState<FileAttachmentType | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load conversation history if conversationId is provided
  const { data: historyData, isLoading: isLoadingHistory } = useChatbotHistory(
    conversationId || "",
    !!conversationId,
  )

  // Setup chatbot mutation with TanStack Query
  const chatbotMutation = useChatbotMutation({
    onMessage: (message) => {
      // Final message - replace streaming message with completed one
      setMessages((prev) => [...prev, message])
      setStreamingMessage(null)
      setCurrentThinking(null)
      setIsProcessing(false)
      setNeedsConfirmation(false)
    },
    onMessageUpdate: (message) => {
      // Real-time streaming update
      setStreamingMessage(message)
    },
    onThinking: (thinking) => {
      setCurrentThinking(thinking)
    },
    onConfirmationRequired: (message) => {
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
    },
    onError: (error) => {
      console.error("Chatbot error:", error)
      setStreamingMessage(null)
      setCurrentThinking(null)
      setIsProcessing(false)
      setNeedsConfirmation(false)
    },
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
  })

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      // Only accept CSV files
      if (!file.name.endsWith(".csv")) {
        alert("Only CSV files are allowed.")
        return
      }

      try {
        // Read file content
        const fileContent = await readFileAsText(file)
        const parsedContent = parseCsvToText(fileContent)

        const fileAttachment: FileAttachmentType = {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          content: parsedContent,
        }

        setAttachedFile(fileAttachment)

        // Auto-submit with custom prompt when CSV is uploaded
        const autoPrompt =
          "Create customer groups and leads, then design optimal sequences from attached CSV data"

        // Submit immediately with the auto prompt
        setIsProcessing(true)

        // Combine prompt with CSV content
        const finalContent = `${autoPrompt}\n\n${parsedContent}`

        const userMessage: ChatMessage = {
          role: "user",
          content: finalContent,
          timestamp: new Date(),
          attachment: fileAttachment,
        }

        setMessages((prev) => [...prev, userMessage])
        setAttachedFile(null)

        // Initialize streaming message
        setStreamingMessage({
          role: "assistant",
          content: "",
          timestamp: new Date(),
        })

        try {
          // Use TanStack Query mutation
          const convId = conversationId || `conv_${Date.now()}`
          setCurrentConversationId(convId)
          await chatbotMutation.mutateAsync({
            question: finalContent, // Send the complete content with CSV data
            workspaceId,
            conversationId: convId,
            messages,
          })
        } catch (error) {
          // Error is already handled in onError callback
          console.error("Submit error:", error)
        }
      } catch (error) {
        console.error("Failed to read file:", error)
        alert("Failed to read file.")
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [conversationId, workspaceId, messages, chatbotMutation],
  )

  const handleRemoveFile = useCallback(() => {
    setAttachedFile(null)
  }, [])

  const handleSubmit = useCallback(
    async (customInput?: string) => {
      const questionText = customInput || input
      if ((!questionText.trim() && !attachedFile) || isProcessing) return

      setIsProcessing(true)

      // Combine text input with CSV content if file is attached
      let finalContent = questionText
      if (attachedFile?.content) {
        finalContent = `${questionText}\n\n${attachedFile.content}`
      }

      const userMessage: ChatMessage = {
        role: "user",
        content: finalContent,
        timestamp: new Date(),
        attachment: attachedFile || undefined,
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")
      setAttachedFile(null)

      // Initialize streaming message
      setStreamingMessage({
        role: "assistant",
        content: "",
        timestamp: new Date(),
      })

      try {
        // Use TanStack Query mutation
        const convId = conversationId || `conv_${Date.now()}`
        setCurrentConversationId(convId)
        await chatbotMutation.mutateAsync({
          question: questionText,
          workspaceId,
          conversationId: convId,
          messages,
        })
      } catch (error) {
        // Error is already handled in onError callback
        console.error("Submit error:", error)
      }
    },
    [input, isProcessing, chatbotMutation, workspaceId, conversationId, messages, attachedFile],
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
      {/* Messages area - Perplexity style centered layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {messages.length === 0 && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
              <h2 className="mb-8 text-2xl font-semibold tracking-tight text-center">
                Ask RINDA anything
              </h2>

              {/* Quick question cards */}
              <div className="w-full max-w-2xl">
                <div className="flex gap-2 mb-6 justify-center">
                  <Button
                    variant={selectedCategory === "performance" ? "default" : "outline"}
                    className="flex items-center gap-2"
                    onClick={() => setSelectedCategory("performance")}
                  >
                    <BarChart3 className="h-4 w-4" />
                    Performance
                  </Button>
                  <Button
                    variant={selectedCategory === "leads" ? "default" : "outline"}
                    className="flex items-center gap-2"
                    onClick={() => setSelectedCategory("leads")}
                  >
                    <Users className="h-4 w-4" />
                    Leads
                  </Button>
                  <Button
                    variant={selectedCategory === "sequences" ? "default" : "outline"}
                    className="flex items-center gap-2"
                    onClick={() => setSelectedCategory("sequences")}
                  >
                    <GitBranch className="h-4 w-4" />
                    Sequences
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCategory === "performance" && (
                    <>
                      <QuestionCard
                        question="How many emails sent today?"
                        onClick={() => handleSubmit("How many emails sent today?")}
                      />
                      <QuestionCard
                        question="What's this week's open rate?"
                        onClick={() => handleSubmit("What's this week's open rate?")}
                      />
                      <QuestionCard
                        question="Which sequence has the highest reply rate?"
                        onClick={() => handleSubmit("Which sequence has the highest reply rate?")}
                      />
                      <QuestionCard
                        question="Show me the last 7 days trend"
                        onClick={() => handleSubmit("Show me the last 7 days trend")}
                      />
                    </>
                  )}

                  {selectedCategory === "leads" && (
                    <>
                      <QuestionCard
                        question="What's the status of new leads?"
                        onClick={() => handleSubmit("What's the status of new leads?")}
                      />
                      <QuestionCard
                        question="How many leads converted?"
                        onClick={() => handleSubmit("How many leads converted?")}
                      />
                      <QuestionCard
                        question="What's the lead distribution by industry?"
                        onClick={() => handleSubmit("What's the lead distribution by industry?")}
                      />
                      <QuestionCard
                        question="Show me leads by highest score"
                        onClick={() => handleSubmit("Show me leads by highest score")}
                      />
                    </>
                  )}

                  {selectedCategory === "sequences" && (
                    <>
                      <QuestionCard
                        question="List active sequences"
                        onClick={() => handleSubmit("List active sequences")}
                      />
                      <QuestionCard
                        question="Completion rate by sequence"
                        onClick={() => handleSubmit("Completion rate by sequence")}
                      />
                      <QuestionCard
                        question="Which sequence has most enrollments?"
                        onClick={() => handleSubmit("Which sequence has most enrollments?")}
                      />
                      <QuestionCard
                        question="Compare performance by sequence"
                        onClick={() => handleSubmit("Compare performance by sequence")}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-8">
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

            {/* Show thinking indicator only when there's no streaming message content */}
            {currentThinking && !streamingMessage?.content && (
              <ThinkingIndicator key="thinking" thinking={currentThinking} />
            )}

            <div ref={scrollRef} />
          </div>
        </div>
      </div>

      {/* Input area - Fixed at bottom with max-width */}
      <div className="border-t bg-background">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="space-y-2">
            {/* File attachment preview */}
            {attachedFile && (
              <div className="flex items-center gap-2">
                <FileAttachment
                  fileName={attachedFile.fileName}
                  fileSize={attachedFile.fileSize}
                  onRemove={handleRemoveFile}
                  variant="removable"
                />
              </div>
            )}

            {/* Input area */}
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder="Ask a question about your data..."
                className="min-h-[56px] max-h-[200px] resize-none pl-12 pr-12 text-base"
                disabled={isProcessing}
              />
              {/* File upload button */}
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing || !!attachedFile}
                size="icon"
                variant="ghost"
                className="absolute bottom-2 left-2 h-8 w-8 rounded-full"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              {/* Submit button */}
              <Button
                onClick={() => handleSubmit()}
                disabled={(!input.trim() && !attachedFile) || isProcessing}
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Question card component
function QuestionCard({ question, onClick }: { question: string; onClick: () => void }) {
  return (
    <Card
      className="p-4 cursor-pointer hover:bg-accent hover:border-[#2563EB]/50 transition-all duration-200 group"
      onClick={onClick}
    >
      <p className="text-sm font-medium group-hover:text-[#2563EB] transition-colors">{question}</p>
    </Card>
  )
}
