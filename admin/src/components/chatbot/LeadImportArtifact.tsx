import { CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { ImportResult } from "@/lib/api/services/lead-import"
import { type ProgressLog, ProgressLogger } from "./ProgressLogger"

interface LeadImportArtifactProps {
  result: ImportResult
  progressLogs?: ProgressLog[]
  startTime?: number
}

export function LeadImportArtifact({ result, progressLogs, startTime }: LeadImportArtifactProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="text-base font-semibold">리드 추가 완료</h3>
              </div>
              <Badge variant="default" className="text-sm font-mono">
                {result.success} / {result.total}
              </Badge>
            </div>
          </div>

          {/* Progress Bar - 100% filled */}
          <div className="space-y-2">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-green-600 transition-all duration-500"
                style={{ width: "100%" }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">완료</p>
          </div>

          {/* Progress Logger with Stats */}
          {progressLogs && progressLogs.length > 0 && startTime && (
            <ProgressLogger
              logs={progressLogs}
              startTime={startTime}
              currentProgress={result.total}
              totalItems={result.total}
              isComplete={true}
            />
          )}

          {/* Stats Grid */}
          {(result.success !== undefined ||
            result.skipped !== undefined ||
            result.failed !== undefined) && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-green-50 dark:bg-green-950/20 p-3">
                <div className="text-xs text-muted-foreground mb-1">성공</div>
                <div className="text-2xl font-bold text-green-600">{result.success || 0}</div>
              </div>
              <div className="rounded-lg border border-border bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="text-xs text-muted-foreground mb-1">스킵</div>
                <div className="text-2xl font-bold text-amber-600">{result.skipped || 0}</div>
              </div>
              <div className="rounded-lg border border-border bg-red-50 dark:bg-red-950/20 p-3">
                <div className="text-xs text-muted-foreground mb-1">실패</div>
                <div className="text-2xl font-bold text-red-600">{result.failed || 0}</div>
              </div>
            </div>
          )}

          {/* Complete Result Details */}
          {result.details && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="text-sm font-medium">상세 결과</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">리드 생성:</span>
                  <span className="font-medium">{result.details.leadsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">연락처 생성:</span>
                  <span className="font-medium">{result.details.contactsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">소셜미디어:</span>
                  <span className="font-medium">{result.details.socialMediaCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">제품:</span>
                  <span className="font-medium">{result.details.productsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">업종:</span>
                  <span className="font-medium">{result.details.sectorsCreated}건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">산업:</span>
                  <span className="font-medium">{result.details.industriesCreated}건</span>
                </div>
              </div>
              {result.duration && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  소요 시간: {(result.duration / 1000).toFixed(2)}초
                </div>
              )}
            </div>
          )}

          {/* Skipped Leads Info */}
          {result.skippedLeads && result.skippedLeads.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                중복으로 스킵된 리드 ({result.skippedLeads.length}건)
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {result.skippedLeads.slice(0, 5).map((lead, idx) => (
                  <div key={idx} className="text-amber-800 dark:text-amber-200">
                    #{lead.rowNumber}: {lead.companyName || lead.websiteUrl || "이름 없음"} -{" "}
                    {lead.reason}
                  </div>
                ))}
                {result.skippedLeads.length > 5 && (
                  <div className="text-amber-700 dark:text-amber-300 italic">
                    외 {result.skippedLeads.length - 5}건...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Failed Leads Info */}
          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                실패한 리드 ({result.errors.length}건)
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {result.errors.slice(0, 5).map((error, idx) => (
                  <div key={idx} className="text-red-800 dark:text-red-200">
                    #{error.row}: {error.companyName || error.websiteUrl || "이름 없음"} -{" "}
                    {error.error}
                  </div>
                ))}
                {result.errors.length > 5 && (
                  <div className="text-red-700 dark:text-red-300 italic">
                    외 {result.errors.length - 5}건...
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
