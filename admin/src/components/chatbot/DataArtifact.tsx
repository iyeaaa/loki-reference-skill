import { useEffect, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { Badge } from "@/components/ui/badge"
import type { Insight } from "@/lib/api/types/chatbot"

// Claude-style syntax highlighting theme
const claudeTheme = {
  'code[class*="language-"]': {
    color: "#374151",
    background: "transparent",
    textShadow: "none",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "0.75rem",
    lineHeight: "1.5",
    direction: "ltr" as const,
    textAlign: "left" as const,
    whiteSpace: "pre-wrap" as const,
    wordSpacing: "normal",
    wordBreak: "break-word" as const,
    MozTabSize: "2",
    OTabSize: "2",
    tabSize: "2",
    WebkitHyphens: "none" as const,
    MozHyphens: "none" as const,
    msHyphens: "none" as const,
    hyphens: "none" as const,
  },
  'pre[class*="language-"]': {
    color: "#374151",
    background: "transparent",
    textShadow: "none",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "0.75rem",
    lineHeight: "1.5",
    direction: "ltr" as const,
    textAlign: "left" as const,
    whiteSpace: "pre-wrap" as const,
    wordSpacing: "normal",
    wordBreak: "break-word" as const,
    MozTabSize: "2",
    OTabSize: "2",
    tabSize: "2",
    WebkitHyphens: "none" as const,
    MozHyphens: "none" as const,
    msHyphens: "none" as const,
    hyphens: "none" as const,
    padding: "1rem",
    margin: "0",
    overflow: "visible" as const,
  },
  // SQL Keywords - Purple/Violet (Claude style)
  keyword: {
    color: "#a855f7",
    fontWeight: "500",
  },
  // Strings - Green
  string: {
    color: "#059669",
  },
  // Numbers - Amber
  number: {
    color: "#d97706",
  },
  // Functions - Blue
  function: {
    color: "#2563eb",
  },
  // Operators
  operator: {
    color: "#6b7280",
  },
  // Punctuation
  punctuation: {
    color: "#6b7280",
  },
  // Comments - Gray
  comment: {
    color: "#9ca3af",
    fontStyle: "italic",
  },
  // Boolean
  boolean: {
    color: "#a855f7",
  },
  // NULL, constants
  constant: {
    color: "#dc2626",
  },
}

interface DataArtifactProps {
  sql?: string
  insights?: Insight[]
  data?: unknown[]
  isStreaming?: boolean
  question?: string
}

/**
 * DataArtifact - Right-side artifact panel for streaming data
 * Shows SQL and insights
 * Claude-style full-height panel (50% of screen)
 */
export function DataArtifact({
  sql,
  insights = [],
  data = [],
  isStreaming = false,
  question,
}: DataArtifactProps) {
  const hasAnyContent = sql || insights.length > 0
  const [mounted, setMounted] = useState(false)

  // Debug logging
  useEffect(() => {
    console.log("[DataArtifact] Props received:", {
      sql: !!sql,
      insightsCount: insights.length,
      dataCount: data.length,
      isStreaming,
    })
    if (insights.length > 0) {
      console.log("[DataArtifact] Insights data:", insights)
    }
  }, [sql, insights, data, isStreaming])

  // Animation mount effect
  useEffect(() => {
    if (hasAnyContent) {
      setTimeout(() => setMounted(true), 50)
    }
  }, [hasAnyContent])

  if (!hasAnyContent) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <p className="text-sm text-muted-foreground text-center">
          Analysis results will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with streaming indicator */}
      <div className="border-b border-border px-6 py-4 bg-muted/30 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {question || "Analysis Results"}
          </h3>
          {isStreaming && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Streaming...</span>
            </div>
          )}
        </div>
      </div>

      {/* Content area with full-height scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* SQL Query - First section */}
        {sql && (
          <div
            className={`
              space-y-3 transition-all duration-500 ease-out
              ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
          >
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-cyan-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Executed Query
              </span>
            </div>
            <div className="rounded-lg border border-border bg-muted/50">
              <SyntaxHighlighter
                language="sql"
                style={claudeTheme}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "0.75rem",
                  lineHeight: "1.5",
                  background: "transparent",
                  overflow: "visible",
                }}
                wrapLongLines={true}
                showLineNumbers={false}
              >
                {sql}
              </SyntaxHighlighter>
            </div>
          </div>
        )}

        {/* Insights - One card per row */}
        {insights.length > 0 && (
          <div
            className={`
              space-y-3 transition-all duration-500 ease-out
              ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            `}
            style={{ transitionDelay: sql ? "100ms" : "0ms" }}
          >
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-green-500" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key Insights
              </span>
            </div>
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`
                    w-full rounded-lg border border-border bg-background/80 p-4 text-sm
                    transition-all duration-500 ease-out
                    ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
                  `}
                  style={{
                    transitionDelay: `${(sql ? 100 : 0) + i * 100}ms`,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      variant={
                        insight.impact === "high"
                          ? "default"
                          : insight.impact === "medium"
                            ? "secondary"
                            : "outline"
                      }
                      className="text-xs"
                    >
                      {insight.impact.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="font-medium text-foreground mb-2 leading-relaxed">
                    {insight.insight}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
