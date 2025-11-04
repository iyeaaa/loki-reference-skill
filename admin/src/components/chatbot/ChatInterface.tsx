import { ArrowUp, BarChart3, GitBranch, Users } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { type ChatMessage, useChatbotHistory, useChatbotMutation } from "@/lib/api/hooks/chatbot"
import { chatbotApi } from "@/lib/api/services/chatbot"
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
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const handleSubmit = useCallback(
    async (customInput?: string) => {
      const questionText = customInput || input
      if (!questionText.trim() || isProcessing) return

      setIsProcessing(true)

      const userMessage: ChatMessage = {
        role: "user",
        content: questionText,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setInput("")

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
    [input, isProcessing, chatbotMutation, workspaceId, conversationId, messages],
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
              content: "작업이 취소되었습니다.",
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
                RINDA에게 무엇이든 물어보세요
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
                    성과
                  </Button>
                  <Button
                    variant={selectedCategory === "leads" ? "default" : "outline"}
                    className="flex items-center gap-2"
                    onClick={() => setSelectedCategory("leads")}
                  >
                    <Users className="h-4 w-4" />
                    리드
                  </Button>
                  <Button
                    variant={selectedCategory === "sequences" ? "default" : "outline"}
                    className="flex items-center gap-2"
                    onClick={() => setSelectedCategory("sequences")}
                  >
                    <GitBranch className="h-4 w-4" />
                    시퀀스
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedCategory === "performance" && (
                    <>
                      <QuestionCard
                        question="오늘 발송한 이메일 수는?"
                        onClick={() => handleSubmit("오늘 발송한 이메일 수는?")}
                      />
                      <QuestionCard
                        question="이번 주 오픈율은?"
                        onClick={() => handleSubmit("이번 주 오픈율은?")}
                      />
                      <QuestionCard
                        question="가장 높은 응답률을 보인 시퀀스는?"
                        onClick={() => handleSubmit("가장 높은 응답률을 보인 시퀀스는?")}
                      />
                      <QuestionCard
                        question="최근 7일 트렌드를 보여줘"
                        onClick={() => handleSubmit("최근 7일 트렌드를 보여줘")}
                      />
                    </>
                  )}

                  {selectedCategory === "leads" && (
                    <>
                      <QuestionCard
                        question="신규 리드 현황은?"
                        onClick={() => handleSubmit("신규 리드 현황은?")}
                      />
                      <QuestionCard
                        question="전환된 리드 수는?"
                        onClick={() => handleSubmit("전환된 리드 수는?")}
                      />
                      <QuestionCard
                        question="업종별 리드 분포는?"
                        onClick={() => handleSubmit("업종별 리드 분포는?")}
                      />
                      <QuestionCard
                        question="리드 점수가 높은 순으로 보여줘"
                        onClick={() => handleSubmit("리드 점수가 높은 순으로 보여줘")}
                      />
                    </>
                  )}

                  {selectedCategory === "sequences" && (
                    <>
                      <QuestionCard
                        question="활성 시퀀스 목록"
                        onClick={() => handleSubmit("활성 시퀀스 목록")}
                      />
                      <QuestionCard
                        question="시퀀스별 완료율"
                        onClick={() => handleSubmit("시퀀스별 완료율")}
                      />
                      <QuestionCard
                        question="가장 많이 등록된 시퀀스는?"
                        onClick={() => handleSubmit("가장 많이 등록된 시퀀스는?")}
                      />
                      <QuestionCard
                        question="시퀀스별 성과 비교"
                        onClick={() => handleSubmit("시퀀스별 성과 비교")}
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
              className="min-h-[56px] max-h-[200px] resize-none pr-12 text-base"
              disabled={isProcessing}
            />
            <Button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isProcessing}
              size="icon"
              className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
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
