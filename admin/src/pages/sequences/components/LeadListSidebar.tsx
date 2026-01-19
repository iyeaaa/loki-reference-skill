import { AlertCircle, Building2, CheckCircle, Clock, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import type { Lead } from "@/lib/api/types/lead"
import type { WorkflowGeneratedEmail } from "@/lib/api/types/workflow-email"
import { cn } from "@/lib/utils"

type LeadListSidebarProps = {
  sequenceId?: string // Optional - kept for future use
  leads: Lead[]
  selectedLeadId: string | null
  onSelectLead: (leadId: string) => void
  workflowEmails: WorkflowGeneratedEmail[]
}

export function LeadListSidebar({
  // sequenceId, // Currently unused
  leads,
  selectedLeadId,
  onSelectLead,
  workflowEmails,
}: LeadListSidebarProps) {
  const { t } = useTranslation()
  // console.log(leads)
  // Get generation status for a lead
  const getLeadGenerationStatus = (leadId: string) => {
    const leadEmails = workflowEmails.filter((email) => email.leadId === leadId)
    if (leadEmails.length === 0) {
      return "pending"
    }

    const statuses = leadEmails.map((e) => e.status)
    if (statuses.some((s) => s === "generating")) {
      return "generating"
    }
    if (statuses.some((s) => s === "failed")) {
      return "failed"
    }
    if (statuses.every((s) => s === "generated" || s === "edited")) {
      return "completed"
    }
    return "partial"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "generating":
        return <Clock className="h-4 w-4 animate-pulse text-blue-600" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge
            className="bg-green-100 text-green-800 text-xs dark:bg-green-900 dark:text-green-200"
            variant="default"
          >
            {t("sequences.aiMode.status.completed")}
          </Badge>
        )
      case "generating":
        return (
          <Badge className="text-xs" variant="default">
            {t("sequences.aiMode.status.generating")}
          </Badge>
        )
      case "failed":
        return (
          <Badge className="text-xs" variant="destructive">
            {t("sequences.aiMode.status.failed")}
          </Badge>
        )
      case "partial":
        return (
          <Badge
            className="bg-yellow-100 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            variant="secondary"
          >
            {t("sequences.aiMode.status.partial")}
          </Badge>
        )
      default:
        return (
          <Badge className="text-xs" variant="secondary">
            {t("sequences.aiMode.status.pending")}
          </Badge>
        )
    }
  }

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="border-b bg-background/50 p-6">
        <h3 className="font-semibold text-xl">{t("sequences.aiMode.leadList.title")}</h3>
        <p className="mt-2 text-muted-foreground text-sm">
          {t("sequences.aiMode.leadList.subtitle", { count: leads.length })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.map((lead) => {
          const status = getLeadGenerationStatus(lead.id)
          const emailCount = workflowEmails.filter((e) => e.leadId === lead.id).length

          return (
            <button
              className={cn(
                "w-full border-b px-5 py-4 text-left transition-all duration-200 hover:bg-background/80 hover:shadow-sm",
                selectedLeadId === lead.id &&
                  "scale-[1.02] border-l-4 border-l-primary bg-background shadow-md",
              )}
              key={lead.id}
              onClick={() => onSelectLead(lead.id)}
              type="button"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 flex-shrink-0 text-primary/70" />
                      <span className="truncate font-semibold text-sm">
                        {lead.companyName || t("sequences.aiMode.leadList.unknownCompany")}
                      </span>
                    </div>
                    {lead.contactName && (
                      <div className="mt-1.5 ml-6 flex items-center gap-2.5">
                        <User className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                        <span className="truncate text-muted-foreground text-xs">
                          {lead.contactName}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-0.5 flex-shrink-0">{getStatusIcon(status)}</div>
                </div>

                <div className="ml-6 flex items-center justify-between gap-2">
                  <span className="font-medium text-muted-foreground text-xs">
                    {t("sequences.aiMode.leadList.emailsGenerated", {
                      count: emailCount,
                      total: 6,
                    })}
                  </span>
                  {getStatusBadge(status)}
                </div>

                {lead.businessType && (
                  <div className="ml-6 w-fit truncate rounded bg-muted/50 px-2 py-1 text-muted-foreground/80 text-xs">
                    {lead.businessType}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
