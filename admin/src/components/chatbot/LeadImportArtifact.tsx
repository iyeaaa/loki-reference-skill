import { CheckCircle2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { ImportResult } from "@/lib/api/services/lead-import"
import { type ProgressLog, ProgressLogger } from "./ProgressLogger"

interface LeadImportArtifactProps {
  result: ImportResult
  progressLogs?: ProgressLog[]
  startTime?: number
  customerGroupId?: string
  customerGroupName?: string
  membersAdded?: number
  onGenerateSequence?: (groupId: string, groupName: string, membersAdded: number) => void
}

export function LeadImportArtifact({
  result,
  progressLogs,
  startTime,
  customerGroupId,
  customerGroupName,
  membersAdded,
  onGenerateSequence,
}: LeadImportArtifactProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h3 className="text-base font-semibold">Lead Import Complete</h3>
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
            <p className="text-xs text-muted-foreground text-right">Complete</p>
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
                <div className="text-xs text-muted-foreground mb-1">Success</div>
                <div className="text-2xl font-bold text-green-600">{result.success || 0}</div>
              </div>
              <div className="rounded-lg border border-border bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="text-xs text-muted-foreground mb-1">Skipped</div>
                <div className="text-2xl font-bold text-amber-600">{result.skipped || 0}</div>
              </div>
              <div className="rounded-lg border border-border bg-red-50 dark:bg-red-950/20 p-3">
                <div className="text-xs text-muted-foreground mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-600">{result.failed || 0}</div>
              </div>
            </div>
          )}

          {/* Complete Result Details */}
          {result.details && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <div className="text-sm font-medium">Detailed Results</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Leads created:</span>
                  <span className="font-medium">{result.details.leadsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contacts created:</span>
                  <span className="font-medium">{result.details.contactsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Social media:</span>
                  <span className="font-medium">{result.details.socialMediaCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Products:</span>
                  <span className="font-medium">{result.details.productsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sectors:</span>
                  <span className="font-medium">{result.details.sectorsCreated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Industries:</span>
                  <span className="font-medium">{result.details.industriesCreated}</span>
                </div>
              </div>
              {result.duration && (
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Duration: {(result.duration / 1000).toFixed(2)}s
                </div>
              )}
            </div>
          )}

          {/* Duplicate Emails Info (Workspace-scoped) */}
          {result.duplicateEmails && result.duplicateEmails.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Duplicate Emails in Workspace (
                {result.emailsSkipped || result.duplicateEmails.length})
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                ℹ️ Leads were created but duplicate emails were excluded
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {result.duplicateEmails.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="text-blue-800 dark:text-blue-200">
                    #{item.rowNumber}: {item.email} ({item.companyName || "No name"})
                    {item.existingLeadId !== "CSV_DUPLICATE" && (
                      <span className="text-blue-600 dark:text-blue-400 ml-1">
                        - Existing lead ID: {item.existingLeadId.substring(0, 8)}...
                      </span>
                    )}
                    {item.existingLeadId === "CSV_DUPLICATE" && (
                      <span className="text-blue-600 dark:text-blue-400 ml-1">
                        - Duplicate in file
                      </span>
                    )}
                  </div>
                ))}
                {result.duplicateEmails.length > 5 && (
                  <div className="text-blue-700 dark:text-blue-300 italic">
                    and {result.duplicateEmails.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Skipped Leads Info */}
          {result.skippedLeads && result.skippedLeads.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
              <div className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                Skipped Leads ({result.skippedLeads.length})
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                ℹ️ Entire lead was skipped because the Website URL already exists in the workspace
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {result.skippedLeads.slice(0, 5).map((lead, idx) => (
                  <div key={idx} className="text-amber-800 dark:text-amber-200">
                    #{lead.rowNumber}: {lead.companyName || lead.websiteUrl || "No name"} -{" "}
                    {lead.reason}
                  </div>
                ))}
                {result.skippedLeads.length > 5 && (
                  <div className="text-amber-700 dark:text-amber-300 italic">
                    and {result.skippedLeads.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Failed Leads Info */}
          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
              <div className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                Failed Leads ({result.errors.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {result.errors.slice(0, 5).map((error, idx) => (
                  <div key={idx} className="text-red-800 dark:text-red-200">
                    #{error.row}: {error.companyName || error.websiteUrl || "No name"} -{" "}
                    {error.error}
                  </div>
                ))}
                {result.errors.length > 5 && (
                  <div className="text-red-700 dark:text-red-300 italic">
                    and {result.errors.length - 5} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Sequence Button */}
          {customerGroupId &&
            customerGroupName &&
            membersAdded &&
            membersAdded > 0 &&
            onGenerateSequence && (
              <div className="pt-2">
                <Button
                  onClick={() =>
                    onGenerateSequence(customerGroupId, customerGroupName, membersAdded)
                  }
                  className="w-full"
                  size="lg"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Email Sequence for This Group
                </Button>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  )
}
