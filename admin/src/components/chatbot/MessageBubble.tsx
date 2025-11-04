import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import { Streamdown } from "streamdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/lib/api/hooks/chatbot"
import { FileAttachment } from "./FileAttachment"

interface MessageBubbleProps {
  message: ChatMessage
  isStreaming?: boolean
  needsConfirmation?: boolean
  onConfirm?: (confirmed: boolean) => void
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isStreaming = false,
  needsConfirmation = false,
  onConfirm,
}: MessageBubbleProps) {
  const isUser = message.role === "user"

  // Show metadata only when not streaming or when streaming is complete
  const shouldShowMetadata = !isStreaming && message.metadata

  // Memoize markdown components to prevent re-creation
  const markdownComponents = useMemo(
    () => ({
      p: ({ children }: { children?: React.ReactNode }) => (
        <p className="mb-4 leading-relaxed last:mb-0">{children}</p>
      ),
      h1: ({ children }: { children?: React.ReactNode }) => (
        <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0">{children}</h1>
      ),
      h2: ({ children }: { children?: React.ReactNode }) => (
        <h2 className="mb-3 mt-5 text-xl font-bold first:mt-0">{children}</h2>
      ),
      h3: ({ children }: { children?: React.ReactNode }) => (
        <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
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
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">{children}</code>
        ) : (
          <code className="font-mono text-sm">{children}</code>
        )
      },
      pre: ({ children }: { children?: React.ReactNode }) => (
        <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-3">{children}</pre>
      ),
      blockquote: ({ children }: { children?: React.ReactNode }) => (
        <blockquote className="mb-4 border-l-4 border-border pl-4 italic text-muted-foreground">
          {children}
        </blockquote>
      ),
      a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          {children}
        </a>
      ),
      // Remove table decorations - simple, clean table styling
      table: ({ children }: { children?: React.ReactNode }) => (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      ),
      thead: ({ children }: { children?: React.ReactNode }) => (
        <thead className="border-b">{children}</thead>
      ),
      tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
      tr: ({ children }: { children?: React.ReactNode }) => (
        <tr className="border-b last:border-0">{children}</tr>
      ),
      th: ({ children }: { children?: React.ReactNode }) => (
        <th className="px-3 py-2 text-left font-medium">{children}</th>
      ),
      td: ({ children }: { children?: React.ReactNode }) => (
        <td className="px-3 py-2">{children}</td>
      ),
    }),
    [],
  )

  // Extract user text from content (remove CSV data if present)
  const getUserDisplayText = (content: string): string => {
    if (!content) return ""
    // If content contains CSV data, extract only the text before it
    const csvIndex = content.indexOf("\n\nCSV Data")
    if (csvIndex > 0) {
      return content.substring(0, csvIndex)
    }
    return content
  }

  return (
    <div className="w-full">
      {/* User message - right aligned, compact */}
      {isUser ? (
        <div className="flex justify-end">
          <div className="max-w-[80%] space-y-2">
            {/* File attachment display */}
            {message.attachment && (
              <div className="flex justify-end">
                <FileAttachment
                  fileName={message.attachment.fileName}
                  fileSize={message.attachment.fileSize}
                  variant="display"
                />
              </div>
            )}
            {/* Message content - show user's text input */}
            {getUserDisplayText(message.content) && (
              <div className="rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {getUserDisplayText(message.content)}
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Assistant message - full width, clean layout */
        <div className="space-y-4">
          {/* Main response with markdown support */}
          <div className="prose prose-sm max-w-none dark:prose-invert will-change-auto">
            {isStreaming ? (
              // Streaming mode: real-time markdown rendering with Streamdown
              <Streamdown>{message.content}</Streamdown>
            ) : (
              // Normal mode: show full content with ReactMarkdown
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            )}
          </div>

          {/* Confirmation buttons - Claude Code style */}
          {needsConfirmation && onConfirm && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => onConfirm(true)}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                ✓ 계속 진행
              </Button>
              <Button
                onClick={() => onConfirm(false)}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                ✗ 취소
              </Button>
            </div>
          )}

          {/* Metadata sections - only show when not streaming */}
          {shouldShowMetadata && (
            <div className="space-y-4 border-l-2 border-border pl-4">
              {/* SQL Query */}
              {message.metadata?.sql && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Executed Query
                  </div>
                  <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs font-mono">
                    <code className="text-foreground">{message.metadata?.sql}</code>
                  </pre>
                </div>
              )}

              {/* Insights */}
              {message.metadata?.insights && message.metadata?.insights.length > 0 && (
                <div className="space-y-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Key Insights
                  </div>
                  <div className="space-y-2">
                    {message.metadata?.insights.map((insight: unknown, i: number) => {
                      const insightData = insight as {
                        impact: string
                        insight: string
                        recommendation: string
                      }
                      return (
                        <div
                          key={i}
                          className="rounded-lg border border-border bg-card/50 p-3 text-sm"
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <Badge
                              variant={
                                insightData.impact === "high"
                                  ? "default"
                                  : insightData.impact === "medium"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs"
                            >
                              {insightData.impact.toUpperCase()}
                            </Badge>
                            <span className="font-medium text-foreground">
                              {insightData.insight}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {insightData.recommendation}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Follow-up questions */}
              {message.metadata?.followUpQuestions &&
                message.metadata?.followUpQuestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Related Questions
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {message.metadata?.followUpQuestions.map((q: string, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("quickQuestion", {
                                detail: { question: q },
                              }),
                            )
                          }}
                          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
