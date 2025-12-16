import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLeads } from "@/lib/api/hooks/leads"
import { useSequence, useSequenceSteps } from "@/lib/api/hooks/sequences"
import { useWorkflowEmails } from "@/lib/api/hooks/workflow-emails"
import type { Lead } from "@/lib/api/types/lead"
import type { WorkflowGeneratedEmail } from "@/lib/api/types/workflow-email"
import { EmailPreviewPanel } from "./EmailPreviewPanel"
import { LeadListSidebar } from "./LeadListSidebar"

type AIModeGeneratedContentProps = {
  sequenceId: string
  onBack?: () => void
}

export function AIModeGeneratedContent({ sequenceId, onBack }: AIModeGeneratedContentProps) {
  const { t } = useTranslation()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  // Fetch all necessary data
  const { data: sequence, isLoading: isLoadingSequence } = useSequence(sequenceId)
  const { data: steps, isLoading: isLoadingSteps } = useSequenceSteps(sequenceId)
  const { data: workflowEmails, isLoading: isLoadingEmails } = useWorkflowEmails(sequenceId)

  // Extract lead IDs from sequence.selectedLeadIds (JSON string)
  const leadIds: string[] = sequence?.selectedLeadIds ? JSON.parse(sequence.selectedLeadIds) : []

  // Fetch leads by customer group
  const customerGroupId = sequence?.customerGroupId

  // Fetch all leads in the customer group
  const { data: leadsData, isLoading: isLoadingLeads } = useLeads(
    customerGroupId
      ? {
          page: 1,
          limit: 1000,
          customerGroupId,
        }
      : undefined,
  )

  // Filter leads to only include those in selectedLeadIds
  const allLeadsInGroup = leadsData?.leads || []
  const leads =
    leadIds.length > 0
      ? allLeadsInGroup.filter((lead: Lead) => leadIds.includes(lead.id))
      : allLeadsInGroup

  const isLoading = isLoadingSequence || isLoadingSteps || isLoadingEmails || isLoadingLeads

  // Auto-select first lead when data loads
  useEffect(() => {
    if (leads.length > 0 && !selectedLeadId) {
      setSelectedLeadId(leads[0].id)
    }
  }, [leads, selectedLeadId])

  // Get emails for selected lead
  const selectedLeadEmails =
    workflowEmails?.filter((email: WorkflowGeneratedEmail) => email.leadId === selectedLeadId) || []

  if (isLoading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="space-y-3 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t("sequences.aiMode.loadingGeneratedContent")}</p>
        </div>
      </div>
    )
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="space-y-3 text-center">
          <p className="text-muted-foreground">{t("sequences.aiMode.noLeadsFound")}</p>
          {onBack && (
            <button className="text-primary hover:underline" onClick={onBack} type="button">
              {t("sequences.aiMode.backToGeneration")}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Calculate summary statistics
  const completedEmails =
    workflowEmails?.filter(
      (e: WorkflowGeneratedEmail) => e.status === "generated" || e.status === "edited",
    ).length || 0
  const failedEmails =
    workflowEmails?.filter((e: WorkflowGeneratedEmail) => e.status === "failed").length || 0
  const generatingEmails =
    workflowEmails?.filter((e: WorkflowGeneratedEmail) => e.status === "generating").length || 0

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Summary Statistics Header */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4 dark:border-blue-800 dark:from-blue-950/30 dark:to-blue-900/20">
          <div className="font-medium text-blue-700 text-sm dark:text-blue-300">Total Leads</div>
          <div className="mt-1 font-bold text-2xl text-blue-900 dark:text-blue-100">
            {leads.length}
          </div>
        </div>
        <div className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-4 dark:border-green-800 dark:from-green-950/30 dark:to-green-900/20">
          <div className="font-medium text-green-700 text-sm dark:text-green-300">Completed</div>
          <div className="mt-1 font-bold text-2xl text-green-900 dark:text-green-100">
            {completedEmails}
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 p-4 dark:border-amber-800 dark:from-amber-950/30 dark:to-amber-900/20">
          <div className="font-medium text-amber-700 text-sm dark:text-amber-300">Generating</div>
          <div className="mt-1 font-bold text-2xl text-amber-900 dark:text-amber-100">
            {generatingEmails}
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-4 dark:border-red-800 dark:from-red-950/30 dark:to-red-900/20">
          <div className="font-medium text-red-700 text-sm dark:text-red-300">Failed</div>
          <div className="mt-1 font-bold text-2xl text-red-900 dark:text-red-100">
            {failedEmails}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border">
        {/* Left Sidebar - Lead List */}
        <div className="w-80 overflow-y-auto border-r">
          <LeadListSidebar
            leads={leads}
            onSelectLead={setSelectedLeadId}
            selectedLeadId={selectedLeadId}
            sequenceId={sequenceId}
            workflowEmails={workflowEmails || []}
          />
        </div>

        {/* Right Panel - Email Previews */}
        <div className="flex-1 overflow-y-auto">
          {selectedLeadId &&
            (() => {
              const selectedLead = leads.find((l: Lead) => l.id === selectedLeadId)
              return selectedLead ? (
                <EmailPreviewPanel
                  emails={selectedLeadEmails}
                  lead={selectedLead}
                  steps={steps || []}
                />
              ) : null
            })()}
        </div>
      </div>
    </div>
  )
}
