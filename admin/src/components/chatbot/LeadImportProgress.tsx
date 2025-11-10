import { CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ImportProgress } from "@/lib/api/services/lead-import"
import { EnhancedProgressBar } from "./EnhancedProgressBar"
import { type ProgressLog, ProgressLogger } from "./ProgressLogger"
import { StarSpinner } from "./StarSpinner"

interface LeadImportProgressProps {
  progress: ImportProgress
}

export function LeadImportProgress({ progress }: LeadImportProgressProps) {
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
          ? `처리 중: ${progress.currentCompanyName}${progress.currentRow ? ` (행 #${progress.currentRow})` : ""}`
          : progress.message || "처리 중...",
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
          message: `완료: 성공 ${progress.success}건, 스킵 ${progress.skipped}건, 실패 ${progress.failed}건`,
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
          message: progress.error || "오류가 발생했습니다",
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
                <h3 className="text-base font-semibold">
                  {isComplete
                    ? "리드 추가 완료"
                    : isError
                      ? "리드 추가 실패"
                      : isInit
                        ? "리드 추가 준비 중"
                        : "리드 추가 진행 중"}
                </h3>
              </div>
              {!isInit && progress.processed !== undefined && progress.total !== undefined && (
                <Badge variant={isComplete ? "default" : "secondary"} className="text-sm font-mono">
                  {progress.processed} / {progress.total}
                </Badge>
              )}
            </div>

            {/* Customer Group Info */}
            {progress.customerGroupName && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">고객 그룹:</span>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    {progress.customerGroupName}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Progress Bar */}
          {!isInit && !isError && progress.total !== undefined && progress.total > 0 && (
            <EnhancedProgressBar
              value={progress.processed || 0}
              max={progress.total}
              animated={isInProgress}
            />
          )}

          {/* Progress Logger with Stats */}
          {!isInit && !isError && logs.length > 0 && (
            <ProgressLogger
              logs={logs}
              startTime={startTime}
              currentProgress={progress.processed || 0}
              totalItems={progress.total || 0}
              isComplete={isComplete}
            />
          )}

          {/* Stats Grid */}
          {!isInit &&
            (progress.success !== undefined ||
              progress.skipped !== undefined ||
              progress.failed !== undefined) && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-green-50 dark:bg-green-950/20 p-3">
                  <div className="text-xs text-muted-foreground mb-1">성공</div>
                  <div className="text-2xl font-bold text-green-600">{progress.success || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-amber-50 dark:bg-amber-950/20 p-3">
                  <div className="text-xs text-muted-foreground mb-1">스킵</div>
                  <div className="text-2xl font-bold text-amber-600">{progress.skipped || 0}</div>
                </div>
                <div className="rounded-lg border border-border bg-red-50 dark:bg-red-950/20 p-3">
                  <div className="text-xs text-muted-foreground mb-1">실패</div>
                  <div className="text-2xl font-bold text-red-600">{progress.failed || 0}</div>
                </div>
              </div>
            )}

          {/* Message */}
          {progress.message && <p className="text-sm text-muted-foreground">{progress.message}</p>}

          {/* Error Message */}
          {isError && progress.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3">
              <p className="text-sm text-red-600">{progress.error}</p>
            </div>
          )}

          {/* Complete Result Details */}
          {isComplete && progress.result && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="text-sm font-medium">상세 결과</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">리드 생성:</span>
                  <span className="font-medium">{progress.result.details.leadsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">연락처 생성:</span>
                  <span className="font-medium">{progress.result.details.contactsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">소셜미디어:</span>
                  <span className="font-medium">
                    {progress.result.details.socialMediaCreated}건
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">제품:</span>
                  <span className="font-medium">{progress.result.details.productsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">업종:</span>
                  <span className="font-medium">{progress.result.details.sectorsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">산업:</span>
                  <span className="font-medium">{progress.result.details.industriesCreated}건</span>
                </div>
              </div>
              {progress.result.duration && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  소요 시간: {(progress.result.duration / 1000).toFixed(2)}초
                </div>
              )}
            </div>
          )}

          {/* Duplicate Emails Info (Workspace-scoped) */}
          {isComplete &&
            progress.result?.duplicateEmails &&
            progress.result.duplicateEmails.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
                <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  워크스페이스 내 중복 이메일 (
                  {progress.result.emailsSkipped || progress.result.duplicateEmails.length}건)
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  ℹ️ 해당 리드는 생성되었지만 중복된 이메일은 제외되었습니다
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                  {progress.result.duplicateEmails.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="text-blue-800 dark:text-blue-200">
                      #{item.rowNumber}: {item.email} ({item.companyName || "이름 없음"})
                      {item.existingLeadId !== "CSV_DUPLICATE" && (
                        <span className="text-blue-600 dark:text-blue-400 ml-1">
                          - 기존 리드 ID: {item.existingLeadId.substring(0, 8)}...
                        </span>
                      )}
                      {item.existingLeadId === "CSV_DUPLICATE" && (
                        <span className="text-blue-600 dark:text-blue-400 ml-1">
                          - 파일 내 중복
                        </span>
                      )}
                    </div>
                  ))}
                  {progress.result.duplicateEmails.length > 5 && (
                    <div className="text-blue-700 dark:text-blue-300 italic">
                      외 {progress.result.duplicateEmails.length - 5}건...
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Skipped Leads Info */}
          {isComplete &&
            progress.result?.skippedLeads &&
            progress.result.skippedLeads.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                  중복으로 스킵된 리드 ({progress.result.skippedLeads.length}건)
                </div>
                <div className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                  ℹ️ Website URL이 이미 워크스페이스에 존재하여 리드 전체가 스킵되었습니다
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                  {progress.result.skippedLeads.slice(0, 5).map((lead, idx) => (
                    <div key={idx} className="text-amber-800 dark:text-amber-200">
                      #{lead.rowNumber}: {lead.companyName || lead.websiteUrl || "이름 없음"} -{" "}
                      {lead.reason}
                    </div>
                  ))}
                  {progress.result.skippedLeads.length > 5 && (
                    <div className="text-amber-700 dark:text-amber-300 italic">
                      외 {progress.result.skippedLeads.length - 5}건...
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
