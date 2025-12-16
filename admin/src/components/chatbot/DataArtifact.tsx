import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { Badge } from "@/components/ui/badge"
import type { ImportProgress, ImportResult, PreviewLeadData } from "@/lib/api/services/lead-import"
import type { Insight } from "@/lib/api/types/chatbot"
import { isDevelopment } from "@/lib/env"
import { LeadPreviewArtifact } from "./LeadPreviewArtifact"
import { LeadProgressSection } from "./LeadProgressSection"
import { LeadResultSection } from "./LeadResultSection"
import type { ProgressLog } from "./ProgressLogger"
import { SectionHeader } from "./SectionHeader"

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

type DataArtifactProps = {
  sql?: string
  insights?: Insight[]
  data?: unknown[]
  isStreaming?: boolean
  question?: string
  leadPreview?: {
    totalRows: number
    previewRows: number
    leads: PreviewLeadData[]
    sheetName: string
  }
  leadImportProgress?: ImportProgress
  leadImportResult?: ImportResult
  progressLogs?: ProgressLog[]
  startTime?: number
  onLeadImportApproval?: (approved: boolean) => void
  onGenerateSequence?: (groupId: string, groupName: string, membersAdded: number) => void
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
  leadPreview,
  leadImportProgress,
  leadImportResult,
  progressLogs,
  startTime,
  onLeadImportApproval,
  onGenerateSequence,
}: DataArtifactProps) {
  const { t } = useTranslation()
  // Note: SQL is only shown in development mode (process.env.NODE_ENV === 'development')
  // In production, SQL queries are hidden for security, but results/insights are still shown
  const hasAnyContent =
    sql ||
    insights.length > 0 ||
    data.length > 0 ||
    !!leadPreview ||
    !!leadImportProgress ||
    !!leadImportResult
  const [mounted, setMounted] = useState(false)
  const [isProcessingLead, setIsProcessingLead] = useState(false)

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

  // Reset processing state when new lead preview is loaded
  useEffect(() => {
    if (leadPreview) {
      setIsProcessingLead(false)
    }
  }, [leadPreview])

  // Prepare lead preview handlers
  const handleApprove = () => {
    if (onLeadImportApproval) {
      setIsProcessingLead(true)
      onLeadImportApproval(true)
    }
  }

  const handleReject = () => {
    if (onLeadImportApproval) {
      setIsProcessingLead(true)
      onLeadImportApproval(false)
    }
  }

  // Show empty state if no content
  if (!hasAnyContent) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-center text-muted-foreground text-sm">
          {t("chatbot.artifact.analysisResults")}
        </p>
      </div>
    )
  }

  // Determine the main title based on what content is available
  const getTitle = () => {
    if (leadImportProgress) {
      return t("chatbot.artifact.leadImportProgress")
    }
    if (leadImportResult) {
      return t("chatbot.artifact.leadImportComplete")
    }
    if (leadPreview) {
      return t("chatbot.artifact.leadPreview")
    }
    return question || t("chatbot.artifact.analysisResults")
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header with streaming indicator */}
      <div className="flex-shrink-0 border-border border-b bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">{getTitle()}</h3>
          {isStreaming && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              <span className="text-muted-foreground text-xs">
                {t("chatbot.artifact.streaming")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content area with full-height scroll */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Lead Preview Section */}
        {leadPreview && onLeadImportApproval && (
          <LeadPreviewArtifact
            data={leadPreview}
            isProcessing={isProcessingLead}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}

        {/* Lead Import Progress Section */}
        {leadImportProgress && <LeadProgressSection progress={leadImportProgress} />}

        {/* Lead Import Result Section */}
        {leadImportResult && (
          <LeadResultSection
            onGenerateSequence={onGenerateSequence}
            progressLogs={progressLogs}
            result={leadImportResult}
            startTime={startTime}
          />
        )}
        {/* SQL Query Section - Only show in development mode */}
        {sql && isDevelopment && (
          <div
            className={`space-y-3 transition-all duration-500 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
            `}
          >
            <SectionHeader title={t("chatbot.artifact.executedQuery")} />
            <div className="rounded-lg border border-border bg-muted/50">
              <SyntaxHighlighter
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "0.75rem",
                  lineHeight: "1.5",
                  background: "transparent",
                  overflow: "visible",
                }}
                language="sql"
                showLineNumbers={false}
                style={claudeTheme}
                wrapLongLines={true}
              >
                {sql}
              </SyntaxHighlighter>
            </div>
          </div>
        )}

        {/* Query Result Table Section */}
        {data && data.length > 0 && (
          <div
            className={`space-y-3 transition-all duration-500 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
            `}
            style={{
              transitionDelay: sql && isDevelopment ? "50ms" : "0ms",
            }}
          >
            <SectionHeader title={t("chatbot.artifact.queryResults", { count: data.length })} />
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-background shadow-sm">
                    <tr>
                      {Object.keys(data[0] as Record<string, unknown>).map((key) => (
                        <th
                          className="whitespace-nowrap border-border border-b bg-background px-3 py-2 text-left font-medium text-foreground"
                          key={key}
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 100).map((row, i) => (
                      <tr className="border-b last:border-0 hover:bg-muted/30" key={i}>
                        {Object.values(row as Record<string, unknown>).map((value, j) => (
                          <td
                            className="max-w-[200px] truncate whitespace-nowrap px-3 py-2 text-foreground"
                            key={j}
                          >
                            {value === null ? (
                              <span className="text-muted-foreground italic">null</span>
                            ) : (
                              String(value)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Insights Section */}
        {insights.length > 0 && (
          <div
            className={`space-y-3 transition-all duration-500 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
            `}
            style={{
              transitionDelay: sql && isDevelopment ? "100ms" : "0ms",
            }}
          >
            <SectionHeader title={t("chatbot.artifact.keyInsights")} />
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div
                  className={`w-full rounded-lg border border-border bg-background/80 p-4 text-sm transition-all duration-500 ease-out ${mounted ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}
                  `}
                  key={i}
                  style={{
                    transitionDelay: `${(sql && isDevelopment ? 100 : 0) + i * 100}ms`,
                  }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      className="text-xs"
                      variant={
                        insight.impact === "high"
                          ? "default"
                          : insight.impact === "medium"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {insight.impact.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="mb-2 font-medium text-foreground leading-relaxed">
                    {insight.insight}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
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
