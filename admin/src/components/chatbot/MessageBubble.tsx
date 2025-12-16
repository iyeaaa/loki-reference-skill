import { Check, Copy, CornerDownRight, FileCode2, ThumbsDown, ThumbsUp } from "lucide-react"
import React, { Suspense, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import type { ChatMessage } from "@/lib/api/types/chatbot"
import { FileAttachment } from "./FileAttachment"

// Lazy load Streamdown (includes shiki ~9MB, mermaid ~2MB)
const Streamdown = React.lazy(() =>
  import("streamdown").then((mod) => ({ default: mod.Streamdown })),
)

type MessageBubbleProps = {
  message: ChatMessage
  isStreaming?: boolean
  needsConfirmation?: boolean
  onConfirm?: (confirmed: boolean) => void
  hideArtifact?: boolean
  onViewArtifact?: () => void
  questionText?: string
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  isStreaming = false,
  needsConfirmation = false,
  onConfirm,
  hideArtifact: _hideArtifact = false,
  onViewArtifact,
  questionText,
  ref,
}: MessageBubbleProps & { ref?: React.RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation()
  const isUser = message.role === "user"
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null)
  const [copied, setCopied] = useState(false)

  const handleLike = () => {
    setFeedback("like")
    toast.success(t("chatbot.feedback.thanks"))
  }

  const handleDislike = () => {
    setFeedback("dislike")
    toast.success(t("chatbot.feedback.thanks"))
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      toast.success(t("chatbot.copy.success"))
      setTimeout(() => setCopied(false), 2000)
    } catch (_err) {
      toast.error(t("chatbot.copy.failed"))
    }
  }

  // Check if this message has artifact data
  const hasArtifact =
    message.metadata?.sql ||
    (message.metadata?.insights && message.metadata.insights.length > 0) ||
    message.metadata?.importResult

  // Show metadata when available (even during streaming for real-time artifact updates)
  const shouldShowMetadata = message.metadata

  // Memoize markdown components to prevent re-creation
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
    if (!content) {
      return ""
    }
    // If content contains CSV data, extract only the text before it
    const csvIndex = content.indexOf("\n\nCSV Data")
    if (csvIndex > 0) {
      return content.substring(0, csvIndex)
    }
    return content
  }

  return (
    <div className="w-full" ref={ref} style={isUser ? { scrollMarginTop: "6rem" } : undefined}>
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
        /* Assistant message - full width when hideArtifact is true */
        <div className="w-full space-y-4">
          {/* Main response with markdown support */}
          {/* @ts-ignore - Complex markdown component types */}
          <div className="prose prose-sm dark:prose-invert max-w-none will-change-auto">
            {isStreaming ? (
              // Streaming mode: real-time markdown rendering with Streamdown (lazy loaded)
              <Suspense fallback={<div className="animate-pulse">{message.content}</div>}>
                <Streamdown>{message.content}</Streamdown>
              </Suspense>
            ) : (
              // Normal mode: show full content with ReactMarkdown
              <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
            )}
          </div>

          {/* Confirmation buttons - Claude Code style */}
          {needsConfirmation && onConfirm && (
            <div className="mt-4 flex gap-2">
              <Button
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => onConfirm(true)}
                size="sm"
              >
                ✓ {t("chatbot.button.continue")}
              </Button>
              <Button
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onConfirm(false)}
                size="sm"
                variant="outline"
              >
                ✗ {t("chatbot.button.cancel")}
              </Button>
            </div>
          )}

          {/* Artifact card - between content and follow-up questions */}
          {!(isStreaming || needsConfirmation) && hasArtifact && onViewArtifact && (
            <button
              className="mt-4 w-full rounded-lg border border-border bg-muted/30 p-4 text-left transition-all hover:border-primary/50 hover:bg-muted/50"
              onClick={onViewArtifact}
              type="button"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileCode2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground text-sm">
                    {message.metadata?.importResult
                      ? t("chatbot.artifact.importResults")
                      : questionText || t("chatbot.artifact.viewArtifact")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {message.metadata?.importResult
                      ? `${message.metadata.importResult.success} ${t("chatbot.artifact.succeeded")} · ${message.metadata.importResult.skipped} ${t("chatbot.artifact.skipped")} · ${message.metadata.importResult.failed} ${t("chatbot.artifact.failed")}`
                      : message.metadata?.sql &&
                          message.metadata?.insights?.length &&
                          message.metadata.insights.length > 0
                        ? t("chatbot.artifact.sqlAndInsights", {
                            count: message.metadata.insights.length,
                          })
                        : message.metadata?.sql
                          ? t("chatbot.artifact.sqlQuery")
                          : t("chatbot.artifact.insights", {
                              count: message.metadata?.insights?.length || 0,
                            })}
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Feedback buttons - below artifact card */}
          {!(isStreaming || needsConfirmation) && (
            <div className="mt-2 flex items-center justify-end gap-1">
              <Button
                className="h-8 w-8 rounded-lg hover:bg-accent"
                onClick={handleLike}
                size="icon"
                variant="ghost"
              >
                <ThumbsUp
                  className={`h-4 w-4 ${feedback === "like" ? "fill-current text-primary" : ""}`}
                />
              </Button>
              <Button
                className="h-8 w-8 rounded-lg hover:bg-accent"
                onClick={handleDislike}
                size="icon"
                variant="ghost"
              >
                <ThumbsDown
                  className={`h-4 w-4 ${feedback === "dislike" ? "fill-current text-primary" : ""}`}
                />
              </Button>
              <Button
                className="h-8 w-8 rounded-lg hover:bg-accent"
                onClick={handleCopy}
                size="icon"
                variant="ghost"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          {/* Follow-up questions - Perplexity style */}
          {shouldShowMetadata &&
            message.metadata?.followUpQuestions &&
            message.metadata.followUpQuestions.length > 0 && (
              <div className="mt-6 space-y-0">
                <div className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  {t("chatbot.followUp.title")}
                </div>
                <div className="divide-y divide-border/50">
                  {message.metadata.followUpQuestions.map((q: string, i: number) => (
                    <button
                      className="group flex w-full items-start gap-2 py-3 text-left transition-colors hover:bg-accent/50"
                      key={i}
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent("quickQuestion", {
                            detail: { question: q },
                          }),
                        )
                      }}
                      type="button"
                    >
                      <CornerDownRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                      <span className="text-foreground text-sm transition-colors group-hover:text-primary">
                        {q}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}
    </div>
  )
})
