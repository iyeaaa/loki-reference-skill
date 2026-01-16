/**
 * OnboardingChatRoom - 온보딩 채팅방 컴포넌트
 *
 * LeadDiscoveryPage의 ChatRoom 스타일을 적용
 * - 초기 화면: 로고 + 타이틀 + 안내 메시지
 * - 메시지 있을 때: 메시지 목록 + 액션 버튼
 */

import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, Bot, ChevronRight, Link2, Loader2, Send, Sparkles, User } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import TextRinda from "@/assets/text-rinda.svg"
import { StarSpinner } from "@/components/chatbot/StarSpinner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ThinkingBlock } from "@/pages/lead-discovery/components/ThinkingBlock"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
  buttons?: Array<{
    label: string
    action: "connect-email" | "send-emails" | "skip"
    variant?: "default" | "outline" | "ghost"
  }>
}

type ReasoningInfo = {
  step: string
  stepKr: string
  details?: string
  detailsKr?: string
}

type OnboardingChatRoomProps = {
  messages: ChatMessage[]
  isLoading?: boolean
  isConnectingEmail?: boolean
  isKorean?: boolean
  onButtonAction?: (action: string) => void
  reasonings?: ReasoningInfo[] // Claude Desktop 스타일 누적 Thinking Indicator
  isProcessing?: boolean // 진행 중 여부
}

export function OnboardingChatRoom({
  messages,
  isLoading,
  isConnectingEmail,
  isKorean = true,
  onButtonAction,
  reasonings = [],
  isProcessing,
}: OnboardingChatRoomProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollEndRef = useRef<HTMLDivElement>(null)
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)

  // 스크롤 자동 이동 (메시지 개수 변경 시)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 의도적으로 messages.length 변경 시에만 스크롤
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length])

  const showInitialScreen = messages.length === 0

  // Markdown 컴포넌트 설정
  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-2 last:mb-0">{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
  }

  // 초기 화면 (메시지 없을 때)
  if (showInitialScreen) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="w-full max-w-md space-y-8">
            {/* 로고 & 타이틀 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex items-center gap-2">
                <img alt="Rinda" className="h-8" src={TextRinda} />
                <span className="rounded-full bg-linear-to-r from-blue-500 to-indigo-500 px-2 py-0.5 font-medium text-white text-xs">
                  AI
                </span>
              </div>
              <h1 className="mb-2 font-bold text-2xl text-foreground">
                {isKorean ? "AI 해외영업사원" : "AI Sales Assistant"}
              </h1>
              <p className="text-muted-foreground">
                {isKorean
                  ? "바이어 탐색부터 이메일 작성까지 한번에"
                  : "From buyer discovery to email writing, all at once"}
              </p>
            </div>

            {/* 로딩 상태 */}
            {isLoading && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, y: 10 }}
              >
                <StarSpinner size={40} />
                <p className="text-muted-foreground text-sm">
                  {isKorean ? "준비 중..." : "Preparing..."}
                </p>
              </motion.div>
            )}

            {/* 기능 안내 카드 */}
            {!isLoading && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.2 }}
              >
                <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-500">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {isKorean ? "AI가 자동으로 진행해요" : "AI handles everything"}
                      </p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        {isKorean
                          ? "귀사에 맞는 바이어를 찾고 맞춤 이메일을 작성합니다"
                          : "Finding buyers and writing personalized emails for your company"}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 메시지 화면
  return (
    <div className="flex h-full flex-col bg-background">
      {/* 헤더 */}
      <div className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-blue-500/20 shadow-lg">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">RINDA</h3>
            <p className="text-muted-foreground text-xs">
              {isKorean ? "AI 해외영업사원" : "AI Sales Assistant"}
            </p>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
        <div className="space-y-4 p-4">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}
                exit={{ opacity: 0, y: -10 }}
                initial={{ opacity: 0, y: 10 }}
                key={msg.id}
              >
                {/* 아바타 */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    msg.role === "user"
                      ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      : "bg-linear-to-br from-blue-500 to-indigo-600 text-white",
                  )}
                >
                  {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* 메시지 버블 */}
                <div
                  className={cn(
                    "max-w-[85%] space-y-3 rounded-2xl px-4 py-3",
                    msg.role === "user" ? "bg-blue-500 text-white" : "bg-muted/80 text-foreground",
                  )}
                >
                  {/* 메시지 콘텐츠 */}
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
                    <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                  </div>

                  {/* 스트리밍 인디케이터 */}
                  {msg.isStreaming && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <StarSpinner size={14} />
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap gap-2 pt-2"
                      initial={{ opacity: 0, y: 5 }}
                      transition={{ delay: 0.3 }}
                    >
                      {msg.buttons.map((btn, idx) => (
                        <Button
                          className={cn(
                            "h-9 gap-2",
                            btn.variant === "default" &&
                              "bg-linear-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
                          )}
                          disabled={isConnectingEmail}
                          key={idx}
                          onClick={() => onButtonAction?.(btn.action)}
                          size="sm"
                          variant={btn.variant || "default"}
                        >
                          {btn.action === "connect-email" &&
                            (isConnectingEmail ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            ))}
                          {btn.action === "send-emails" && <Send className="h-4 w-4" />}
                          {btn.label}
                          {btn.action !== "skip" && <ArrowRight className="h-4 w-4" />}
                        </Button>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 스크롤 앵커 */}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Claude Desktop 스타일 누적 Thinking Indicator - 채팅창 최하단 고정 */}
      {reasonings.length > 0 && isProcessing && (
        <div className="shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur-sm">
          <div className="space-y-2">
            {/* 완료된 thinking들 (접을 수 있는 그룹) */}
            {reasonings.length > 1 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                  type="button"
                >
                  <motion.div
                    animate={{ rotate: isCompletedExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                  <span className="text-muted-foreground text-sm">
                    {isKorean
                      ? `${reasonings.length - 1}개의 완료된 단계`
                      : `${reasonings.length - 1} completed steps`}
                  </span>
                </button>

                {/* 펼쳐진 완료 목록 */}
                <AnimatePresence>
                  {isCompletedExpanded && (
                    <motion.div
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 max-h-48 space-y-2 overflow-y-auto"
                      exit={{ opacity: 0, height: 0 }}
                      initial={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {reasonings.slice(0, -1).map((reasoning, index) => (
                        <ThinkingBlock
                          defaultExpanded={false}
                          detail={(isKorean ? reasoning.detailsKr : reasoning.details) || ""}
                          isStreaming={false}
                          key={`completed-${reasoning.step}-${index}`}
                          summary={(isKorean ? reasoning.stepKr : reasoning.step) || ""}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* 현재 진행 중인 thinking (항상 표시) */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 10 }}
              key={`current-${reasonings.at(-1)?.step}`}
              transition={{ duration: 0.2 }}
            >
              <ThinkingBlock
                defaultExpanded={true}
                detail={
                  (isKorean ? reasonings.at(-1)?.detailsKr : reasonings.at(-1)?.details) || ""
                }
                isStreaming={true}
                summary={(isKorean ? reasonings.at(-1)?.stepKr : reasonings.at(-1)?.step) || ""}
              />
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}
