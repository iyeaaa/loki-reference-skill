import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ImportProgress } from "@/lib/api/services/lead-import"
import { EnhancedProgressBar } from "./EnhancedProgressBar"
import { type ProgressLog, ProgressLogger } from "./ProgressLogger"
import { StarSpinner } from "./StarSpinner"

type LeadImportProgressProps = {
  progress: ImportProgress
}

export function LeadImportProgress({ progress }: LeadImportProgressProps) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<ProgressLog[]>([])
  const [startTime, setStartTime] = useState<number>(Date.now())
  const prevProgressRef = useRef<ImportProgress | null>(null)

  const isComplete = progress.type === "complete"
  const isError = progress.type === "error"
  const isInit = progress.type === "init"
  const isInProgress = progress.type === "progress"

  // Track logs from progress updates
  useEffect(() => {
    const prev = prevProgressRef.current

    // Initialize start time on first progress
    if (!prev || prev.type === "init") {
      setStartTime(Date.now())
    }

    // Add log entry for significant changes
    if (progress.type === "progress") {
      const newLog: ProgressLog = {
        timestamp: Date.now(),
        message: progress.currentCompanyName
          ? `Processing: ${progress.currentCompanyName}${progress.currentRow ? ` (row #${progress.currentRow})` : ""}`
          : progress.message || "Processing...",
        type: "info",
        processed: progress.processed,
        total: progress.total,
      }

      // Only add if it's a new entry (avoid duplicates)
      if (
        !prev ||
        prev.processed !== progress.processed ||
        prev.currentCompanyName !== progress.currentCompanyName
      ) {
        setLogs((prevLogs) => {
          // Keep last 50 logs to prevent memory issues
          const newLogs = [...prevLogs, newLog]
          return newLogs.slice(-50)
        })
      }
    } else if (progress.type === "complete") {
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          timestamp: Date.now(),
          message: `Complete: ${progress.success} succeeded, ${progress.skipped} skipped, ${progress.failed} failed`,
          type: "success",
          processed: progress.total,
          total: progress.total,
        },
      ])
    } else if (progress.type === "error") {
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          timestamp: Date.now(),
          message: progress.error || "An error occurred",
          type: "error",
        },
      ])
    }

    prevProgressRef.current = progress
  }, [progress])

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : isError ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <StarSpinner size={20} />
                )}
                <h3 className="font-semibold text-base">
                  {isComplete
                    ? t("chatbot.leadProgress.complete")
                    : isError
                      ? t("chatbot.leadProgress.failed")
                      : isInit
                        ? t("chatbot.leadProgress.preparing")
                        : t("chatbot.leadProgress.inProgress")}
                </h3>
              </div>
              {!isInit && progress.processed !== undefined && progress.total !== undefined && (
                <Badge className="font-mono text-sm" variant={isComplete ? "default" : "secondary"}>
                  {progress.processed} / {progress.total}
                </Badge>
              )}
            </div>

            {/* Customer Group Info */}
            {progress.customerGroupName && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">
                    {t("chatbot.leadProgress.customerGroup")}
                  </span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {progress.customerGroupName}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Progress Bar */}
          {!(isInit || isError) && progress.total !== undefined && progress.total > 0 && (
            <EnhancedProgressBar
              animated={isInProgress}
              max={progress.total}
              value={progress.processed || 0}
            />
          )}

          {/* Progress Logger with Stats */}
          {!(isInit || isError) && logs.length > 0 && (
            <ProgressLogger
              currentProgress={progress.processed || 0}
              isComplete={isComplete}
              logs={logs}
              startTime={startTime}
              totalItems={progress.total || 0}
            />
          )}

          {/* Stats Grid */}
          {!isInit &&
            (progress.success !== undefined ||
              progress.skipped !== undefined ||
              progress.failed !== undefined) && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-green-50 p-3 dark:bg-green-950/20">
                  <div className="mb-1 text-muted-foreground text-xs">
                    {t("chatbot.leadResult.success")}
                  </div>
                  <div className="font-bold text-2xl text-green-600">{progress.success || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-amber-50 p-3 dark:bg-amber-950/20">
                  <div className="mb-1 text-muted-foreground text-xs">
                    {t("chatbot.leadResult.skipped")}
                  </div>
                  <div className="font-bold text-2xl text-amber-600">{progress.skipped || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-red-50 p-3 dark:bg-red-950/20">
                  <div className="mb-1 text-muted-foreground text-xs">
                    {t("chatbot.leadResult.failed")}
                  </div>
                  <div className="font-bold text-2xl text-red-600">{progress.failed || 0}</div>
                </div>
              </div>
            )}

          {/* Message */}
          {progress.message && <p className="text-muted-foreground text-sm">{progress.message}</p>}

          {/* Error Message */}
          {isError && progress.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:bg-red-950/20">
              <p className="text-red-600 text-sm">{progress.error}</p>
            </div>
          )}

          {/* Complete Result Details */}
          {isComplete && progress.result && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="font-medium text-sm">{t("chatbot.leadResult.detailedResults")}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("chatbot.leadResult.leadsCreated")}
                  </span>
                  <span className="font-medium">{progress.result.details.leadsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("chatbot.leadResult.contactsCreated")}
                  </span>
                  <span className="font-medium">{progress.result.details.contactsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("chatbot.leadResult.socialMedia")}
                  </span>
                  <span className="font-medium">{progress.result.details.socialMediaCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("chatbot.leadResult.products")}</span>
                  <span className="font-medium">{progress.result.details.productsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("chatbot.leadResult.sectors")}</span>
                  <span className="font-medium">{progress.result.details.sectorsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("chatbot.leadResult.industries")}
                  </span>
                  <span className="font-medium">{progress.result.details.industriesCreated}</span>
                </div>
              </div>
              {progress.result.duration && (
                <div className="border-t pt-2 text-muted-foreground text-xs">
                  {t("chatbot.leadResult.duration")} {(progress.result.duration / 1000).toFixed(2)}s
                </div>
              )}
            </div>
          )}

          {/* Duplicate Emails Info (Workspace-scoped) */}
          {isComplete &&
            progress.result?.duplicateEmails &&
            progress.result.duplicateEmails.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20">
                <div className="mb-2 font-medium text-blue-900 text-sm dark:text-blue-100">
                  {t("chatbot.leadResult.duplicateEmails")} (
                  {progress.result.emailsSkipped || progress.result.duplicateEmails.length})
                </div>
                <div className="mb-2 text-blue-700 text-xs dark:text-blue-300">
                  ℹ️ {t("chatbot.leadResult.duplicateNote")}
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                  {progress.result.duplicateEmails.slice(0, 5).map((item, idx) => (
                    <div className="text-blue-800 dark:text-blue-200" key={idx}>
                      #{item.rowNumber}: {item.email} (
                      {item.companyName || t("chatbot.leadResult.noName")})
                      {item.existingLeadId !== "CSV_DUPLICATE" && (
                        <span className="ml-1 text-blue-600 dark:text-blue-400">
                          - {t("chatbot.leadResult.existingLeadId")}{" "}
                          {item.existingLeadId.substring(0, 8)}...
                        </span>
                      )}
                      {item.existingLeadId === "CSV_DUPLICATE" && (
                        <span className="ml-1 text-blue-600 dark:text-blue-400">
                          - {t("chatbot.leadResult.duplicateInFile")}
                        </span>
                      )}
                    </div>
                  ))}
                  {progress.result.duplicateEmails.length > 5 && (
                    <div className="text-blue-700 italic dark:text-blue-300">
                      {t("chatbot.leadResult.andMore", {
                        count: progress.result.duplicateEmails.length - 5,
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Skipped Leads Info */}
          {isComplete &&
            progress.result?.skippedLeads &&
            progress.result.skippedLeads.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
                <div className="mb-2 font-medium text-amber-900 text-sm dark:text-amber-100">
                  {t("chatbot.leadProgress.duplicates")} ({progress.result.skippedLeads.length})
                </div>
                <div className="mb-2 text-amber-700 text-xs dark:text-amber-300">
                  ℹ️ {t("chatbot.leadProgress.duplicateNote")}
                </div>
                <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                  {progress.result.skippedLeads.slice(0, 5).map((lead, idx) => (
                    <div className="text-amber-800 dark:text-amber-200" key={idx}>
                      #{lead.rowNumber}:{" "}
                      {lead.companyName || lead.websiteUrl || t("chatbot.leadResult.noName")} -{" "}
                      {lead.reason}
                    </div>
                  ))}
                  {progress.result.skippedLeads.length > 5 && (
                    <div className="text-amber-700 italic dark:text-amber-300">
                      {t("chatbot.leadResult.andMore", {
                        count: progress.result.skippedLeads.length - 5,
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  )
}
