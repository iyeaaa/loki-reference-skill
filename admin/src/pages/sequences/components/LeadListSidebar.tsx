import { AlertCircle, Building2, CheckCircle, Clock, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import type { Lead } from "@/lib/api/types/lead"
import type { WorkflowGeneratedEmail } from "@/lib/api/types/workflow-email"
import { cn } from "@/lib/utils"

interface LeadListSidebarProps {
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
    if (leadEmails.length === 0) return "pending"

    const statuses = leadEmails.map((e) => e.status)
    if (statuses.some((s) => s === "generating")) return "generating"
    if (statuses.some((s) => s === "failed")) return "failed"
    if (statuses.every((s) => s === "generated" || s === "edited")) return "completed"
    return "partial"
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "generating":
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
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
            variant="default"
            className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          >
            {t("sequences.aiMode.status.completed")}
          </Badge>
        )
      case "generating":
        return (
          <Badge variant="default" className="text-xs">
            {t("sequences.aiMode.status.generating")}
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs">
            {t("sequences.aiMode.status.failed")}
          </Badge>
        )
      case "partial":
        return (
          <Badge
            variant="secondary"
            className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          >
            {t("sequences.aiMode.status.partial")}
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-xs">
            {t("sequences.aiMode.status.pending")}
          </Badge>
        )
    }
  }

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-6 border-b bg-background/50">
        <h3 className="font-semibold text-xl">{t("sequences.aiMode.leadList.title")}</h3>
        <p className="text-sm text-muted-foreground mt-2">
          {t("sequences.aiMode.leadList.subtitle", { count: leads.length })}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {leads.map((lead) => {
          const status = getLeadGenerationStatus(lead.id)
          const emailCount = workflowEmails.filter((e) => e.leadId === lead.id).length

          return (
            <button
              type="button"
              key={lead.id}
              onClick={() => onSelectLead(lead.id)}
              className={cn(
                "w-full px-5 py-4 text-left hover:bg-background/80 transition-all duration-200 border-b hover:shadow-sm",
                selectedLeadId === lead.id &&
                  "bg-background shadow-md border-l-4 border-l-primary scale-[1.02]",
              )}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-primary/70 flex-shrink-0" />
                      <span className="font-semibold text-sm truncate">
                        {lead.companyName || t("sequences.aiMode.leadList.unknownCompany")}
                      </span>
                    </div>
                    {lead.contactName && (
                      <div className="flex items-center gap-2.5 mt-1.5 ml-6">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          {lead.contactName}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 mt-0.5">{getStatusIcon(status)}</div>
                </div>

                <div className="flex items-center justify-between gap-2 ml-6">
                  <span className="text-xs text-muted-foreground font-medium">
                    {t("sequences.aiMode.leadList.emailsGenerated", {
                      count: emailCount,
                      total: 6,
                    })}
                  </span>
                  {getStatusBadge(status)}
                </div>

                {lead.businessType && (
                  <div className="text-xs text-muted-foreground/80 truncate ml-6 bg-muted/50 px-2 py-1 rounded w-fit">
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
