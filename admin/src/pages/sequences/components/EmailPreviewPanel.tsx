import { AlertCircle, Calendar, Clock, Mail, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Lead } from "@/lib/api/types/lead"
import type { SequenceStep } from "@/lib/api/types/sequence"
import type { WorkflowGeneratedEmail } from "@/lib/api/types/workflow-email"

interface EmailPreviewPanelProps {
  lead: Lead
  steps: SequenceStep[]
  emails: WorkflowGeneratedEmail[]
}

export function EmailPreviewPanel({ lead, steps, emails }: EmailPreviewPanelProps) {
  const { t } = useTranslation()

  // Map emails to steps based on nodeId === stepId
  const getEmailForStep = (step: SequenceStep): WorkflowGeneratedEmail | undefined => {
    return emails.find((email) => email.nodeId === step.id)
  }

  // Get step type label
  const getStepTypeLabel = (stepOrder: number): string => {
    const stepTypes: Record<number, string> = {
      1: t("sequences.aiMode.stepTypes.coldIntro"),
      2: t("sequences.aiMode.stepTypes.valueFollowUp"),
      3: t("sequences.aiMode.stepTypes.problemSolution"),
      4: t("sequences.aiMode.stepTypes.softBump"),
      5: t("sequences.aiMode.stepTypes.meetingRequest"),
      6: t("sequences.aiMode.stepTypes.breakup"),
    }
    return stepTypes[stepOrder] || t("sequences.aiMode.stepTypes.followUp")
  }

  // Render email content with proper HTML
  const renderEmailBody = (
    body: string | undefined | null,
    bodyHtml: string | undefined | null,
  ) => {
    if (bodyHtml) {
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: User-managed signature content is safe
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )
    }
    if (body) {
      return <div className="whitespace-pre-wrap text-sm">{body}</div>
    }
    return (
      <p className="text-sm text-muted-foreground italic">
        {t("sequences.aiMode.emailPreview.noContent")}
      </p>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <div className="p-6 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h3 className="font-bold text-2xl">
              {lead.companyName || t("sequences.aiMode.emailPreview.unknownCompany")}
            </h3>
            {lead.contactName && (
              <p className="text-base text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                {lead.contactName}
              </p>
            )}
            {lead.businessType && (
              <Badge variant="outline" className="mt-2 px-3 py-1">
                {lead.businessType}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Email Steps */}
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-5">
          {steps
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((step) => {
              const email = getEmailForStep(step)
              const hasEmail = !!email

              return (
                <Card
                  key={step.id}
                  className={
                    !hasEmail ? "opacity-60" : "shadow-lg hover:shadow-xl transition-shadow"
                  }
                >
                  <CardHeader className="pb-4 bg-gradient-to-r from-muted/40 to-muted/20">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <CardTitle className="text-lg flex items-center gap-2.5">
                          <Mail className="h-5 w-5 text-primary" />
                          <span className="font-bold">
                            {t("sequences.aiMode.emailPreview.stepTitle", {
                              number: step.stepOrder,
                            })}
                          </span>
                          <Badge variant="secondary" className="ml-1 px-2.5 py-0.5">
                            {getStepTypeLabel(step.stepOrder)}
                          </Badge>
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {step.delayDays > 0 && (
                            <span className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                              <Clock className="h-3.5 w-3.5" />
                              {t("sequences.aiMode.emailPreview.delayDays", {
                                days: step.delayDays,
                              })}
                            </span>
                          )}
                          {step.scheduledHour !== undefined && (
                            <span className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                              <Calendar className="h-3.5 w-3.5" />
                              {String(step.scheduledHour).padStart(2, "0")}:
                              {String(step.scheduledMinute || 0).padStart(2, "0")}
                            </span>
                          )}
                        </div>
                      </div>
                      {email && (
                        <Badge
                          variant={
                            email.status === "generated"
                              ? "default"
                              : email.status === "edited"
                                ? "secondary"
                                : email.status === "failed"
                                  ? "destructive"
                                  : "outline"
                          }
                          className={
                            email.status === "generated"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : email.status === "edited"
                                ? ""
                                : email.status === "failed"
                                  ? ""
                                  : ""
                          }
                        >
                          {email.status}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {email ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("sequences.aiMode.emailPreview.subject")}
                          </div>
                          <p className="font-semibold text-base bg-muted/40 p-3 rounded-md border">
                            {email.subject || t("sequences.aiMode.emailPreview.noSubject")}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {t("sequences.aiMode.emailPreview.body")}
                          </div>
                          <div className="p-4 bg-muted/40 rounded-md max-h-64 overflow-y-auto border">
                            {renderEmailBody(email.bodyText, email.bodyHtml)}
                          </div>
                        </div>
                        {email.generationError && (
                          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-md border border-destructive/30">
                            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-destructive font-medium">
                              {email.generationError}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-md border border-dashed">
                        <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">
                          {t("sequences.aiMode.emailPreview.notGenerated")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
        </div>
      </ScrollArea>
    </div>
  )
}
