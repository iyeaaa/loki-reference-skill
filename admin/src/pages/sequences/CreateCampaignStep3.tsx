import { Check, Clock, Mail, Users } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useCustomerGroup } from "@/lib/api/hooks/customer-groups"
import {
  useCreateSequenceStep,
  useUpdateSequence,
  useUpdateSequenceStep,
} from "@/lib/api/hooks/sequences"
import { useWorkspaces } from "@/lib/api/hooks/workspaces"

type EmailStep = {
  id?: string // Step ID if it exists in DB
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  emailBodyHtml?: string // 서명이 포함된 HTML 본문
  files?: File[]
}

type CreateCampaignStep3Props = {
  sequenceId: string | null
  data: {
    workspaceId: string
    customerGroupId: string
    selectedLeadIds: string[]
    name: string
    description: string
    steps: EmailStep[]
    memo: string
  }
  onChange: (data: { name: string; description: string; memo: string }) => void
}

export function CreateCampaignStep3({ sequenceId, data, onChange }: CreateCampaignStep3Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [memo, setMemo] = useState(data.memo)

  // Debug: Log sequenceId
  useEffect(() => {
    console.log("📋 CreateCampaignStep3 - sequenceId:", sequenceId)
  }, [sequenceId])

  const { data: workspacesData } = useWorkspaces()
  const { data: customerGroup } = useCustomerGroup(
    data.customerGroupId,
    Boolean(data.customerGroupId),
  )

  const updateSequence = useUpdateSequence()
  const createSequenceStep = useCreateSequenceStep()
  const updateSequenceStep = useUpdateSequenceStep()

  const workspace = workspacesData?.workspaces.find((w) => w.id === data.workspaceId)
  const recipientCount =
    data.selectedLeadIds.length > 0 ? data.selectedLeadIds.length : customerGroup?.leadCount || 0

  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  useEffect(() => {
    onChange({ name: data.name, description: data.description, memo })
  }, [memo])

  const handleSaveDraft = async () => {
    if (!sequenceId) {
      toast.error(t("sequences.step3.noSequenceId"))
      return
    }

    const trimmedName = data.name.trim()
    if (!trimmedName || trimmedName === t("sequences.createPage.newCampaign")) {
      toast.error(t("sequences.step3.enterCampaignName"))
      return
    }

    // Prepare update data
    const updateData: {
      name: string
      description?: string
      status: "draft"
      customerGroupId?: string
      selectedLeadIds?: string[]
      memo?: string
    } = {
      name: trimmedName,
      status: "draft",
    }

    if (data.description?.trim()) {
      updateData.description = data.description.trim()
    }

    if (data.customerGroupId) {
      updateData.customerGroupId = data.customerGroupId
      // Always save selectedLeadIds when customerGroupId is set
      updateData.selectedLeadIds = data.selectedLeadIds
    }

    // Check if memo is provided and not empty
    if (memo.trim()) {
      updateData.memo = memo.trim()
    } else if (memo.length > 0) {
      // User tried to save empty memo (only whitespace)
      toast.error(t("sequences.step3.memoEmpty"))
      return
    }

    updateSequence.mutate(
      {
        sequenceId,
        data: updateData,
      },
      {
        onSuccess: async () => {
          // Create or update steps
          if (data.steps.length > 0) {
            try {
              for (const step of data.steps) {
                if (step.id) {
                  // Update existing step
                  await updateSequenceStep.mutateAsync({
                    sequenceId,
                    stepId: step.id,
                    data: {
                      stepOrder: step.stepOrder,
                      delayDays: step.delayDays,
                      scheduledHour: step.scheduledHour,
                      scheduledMinute: step.scheduledMinute,
                      emailSubject: step.emailSubject,
                      emailBodyText: step.emailBodyText,
                      emailBodyHtml: step.emailBodyHtml, // 서명이 포함된 HTML 포함
                    },
                    files: step.files,
                  })
                } else {
                  // Create new step
                  await createSequenceStep.mutateAsync({
                    data: {
                      sequenceId,
                      stepOrder: step.stepOrder,
                      delayDays: step.delayDays,
                      scheduledHour: step.scheduledHour,
                      scheduledMinute: step.scheduledMinute,
                      emailSubject: step.emailSubject,
                      emailBodyText: step.emailBodyText,
                      emailBodyHtml: step.emailBodyHtml, // 서명이 포함된 HTML 포함
                    },
                    files: step.files,
                  })
                }
              }
              toast.success(t("sequences.step3.draftSaved"))
            } catch (error) {
              toast.error(
                t("sequences.step3.stepSaveError", {
                  error:
                    error instanceof Error
                      ? error.message
                      : t("sequences.step3.saveError", { error: "Unknown" }),
                }),
              )
            }
          } else {
            toast.success(t("sequences.step3.draftSaved"))
          }
          navigate("/sequences")
        },
        onError: (error) => {
          toast.error(t("sequences.step3.saveError", { error: error.message }))
        },
      },
    )
  }

  const handleSaveReady = async () => {
    if (!sequenceId) {
      toast.error(t("sequences.step3.noSequenceId"))
      return
    }

    const trimmedName = data.name.trim()
    if (!trimmedName || trimmedName === t("sequences.createPage.newCampaign")) {
      toast.error(t("sequences.step3.enterCampaignName"))
      return
    }

    // Prepare update data
    const updateData: {
      name: string
      description?: string
      status: "ready"
      customerGroupId?: string
      selectedLeadIds?: string[]
      memo?: string
    } = {
      name: trimmedName,
      status: "ready",
    }

    if (data.description?.trim()) {
      updateData.description = data.description.trim()
    }

    if (data.customerGroupId) {
      updateData.customerGroupId = data.customerGroupId
      // Always save selectedLeadIds when customerGroupId is set
      updateData.selectedLeadIds = data.selectedLeadIds
    }

    // Check if memo is provided and not empty
    if (memo.trim()) {
      updateData.memo = memo.trim()
    } else if (memo.length > 0) {
      // User tried to save empty memo (only whitespace)
      toast.error(t("sequences.step3.memoEmpty"))
      return
    }

    updateSequence.mutate(
      {
        sequenceId,
        data: updateData,
      },
      {
        onSuccess: async () => {
          // Create or update steps
          if (data.steps.length > 0) {
            try {
              for (const step of data.steps) {
                if (step.id) {
                  // Update existing step
                  await updateSequenceStep.mutateAsync({
                    sequenceId,
                    stepId: step.id,
                    data: {
                      stepOrder: step.stepOrder,
                      delayDays: step.delayDays,
                      scheduledHour: step.scheduledHour,
                      scheduledMinute: step.scheduledMinute,
                      emailSubject: step.emailSubject,
                      emailBodyText: step.emailBodyText,
                      emailBodyHtml: step.emailBodyHtml, // 서명이 포함된 HTML 포함
                    },
                    files: step.files,
                  })
                } else {
                  // Create new step
                  await createSequenceStep.mutateAsync({
                    data: {
                      sequenceId,
                      stepOrder: step.stepOrder,
                      delayDays: step.delayDays,
                      scheduledHour: step.scheduledHour,
                      scheduledMinute: step.scheduledMinute,
                      emailSubject: step.emailSubject,
                      emailBodyText: step.emailBodyText,
                      emailBodyHtml: step.emailBodyHtml, // 서명이 포함된 HTML 포함
                    },
                    files: step.files,
                  })
                }
              }
              toast.success(t("sequences.step3.readySaved"))
            } catch (error) {
              toast.error(
                t("sequences.step3.stepSaveError", {
                  error:
                    error instanceof Error
                      ? error.message
                      : t("sequences.step3.saveError", { error: "Unknown" }),
                }),
              )
            }
          } else {
            toast.success(t("sequences.step3.readySaved"))
          }
          navigate("/sequences")
        },
        onError: (error) => {
          toast.error(t("sequences.step3.saveError", { error: error.message }))
        },
      },
    )
  }

  // Show loading state if sequence is not ready
  if (!sequenceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">{t("sequences.step3.preparingCampaign")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-full grid-cols-3 gap-6">
      {/* Panel 1: Recipients Summary */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 font-semibold text-lg">
          <Users className="h-5 w-5 text-primary" />
          {t("sequences.step3.sendTarget")}
        </h3>

        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{t("sequences.step3.workspace")}</span>
            <Check className="h-4 w-4 text-green-600" />
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground">{t("sequences.step3.workspace")}</span>
              <span className="font-medium">{workspace?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground">{t("sequences.step3.customerGroup")}</span>
              <span className="font-medium">{customerGroup?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">{t("sequences.step3.recipientCount")}</span>
              <span className="font-medium text-lg text-primary">
                {recipientCount}
                {t("sequences.step3.people")}
              </span>
            </div>
          </div>

          {data.selectedLeadIds.length > 0 && (
            <div className="mt-3 rounded-md bg-blue-50 p-3 dark:bg-blue-950/20">
              <p className="text-blue-900 text-xs dark:text-blue-200">
                {t("sequences.step3.specificRecipients", { count: data.selectedLeadIds.length })}
              </p>
            </div>
          )}
        </div>

        {/* Campaign Info at bottom of first panel */}
        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="font-semibold text-sm">{t("sequences.step3.campaignInfo")}</h4>
          <div className="space-y-2">
            <div>
              <span className="text-muted-foreground text-xs">
                {t("sequences.step3.campaignName")}
              </span>
              <p className="mt-1 font-medium text-sm">{data.name || t("sequences.step3.noName")}</p>
            </div>
            {data.description && (
              <div>
                <span className="text-muted-foreground text-xs">
                  {t("sequences.step3.description")}
                </span>
                <p className="mt-1 text-sm">{data.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel 2: Email Scenario Summary */}
      <div className="space-y-4">
        <h3 className="flex items-center gap-2 font-semibold text-lg">
          <Mail className="h-5 w-5 text-primary" />
          {t("sequences.step3.emailScenario")}
        </h3>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="font-medium text-sm">
              {t("sequences.step3.totalSteps", { count: data.steps.length })}
            </span>
            <Check className="h-4 w-4 text-green-600" />
          </div>

          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-3 pr-4">
              {data.steps.map((step) => (
                <div className="rounded-lg border bg-background p-4" key={step.stepOrder}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-sm">
                      {step.stepOrder}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground text-xs">
                        <Clock className="h-3 w-3" />
                        {step.delayDays === 0
                          ? t("sequences.step3.sendImmediately")
                          : t("sequences.step3.daysLater", { days: step.delayDays })}
                        {" · "}
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </div>
                      <p className="mb-2 font-medium text-sm">{step.emailSubject}</p>
                      <p className="line-clamp-3 text-muted-foreground text-xs">
                        {step.emailBodyText}
                      </p>
                      {step.files && step.files.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-muted-foreground text-xs">
                          <Mail className="h-3 w-3" />
                          {t("sequences.step3.attachments", { count: step.files.length })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Panel 3: Memo & Actions */}
      <div className="flex flex-col space-y-4">
        <h3 className="font-semibold text-lg">{t("sequences.step3.memo")}</h3>

        <div className="flex flex-1 flex-col gap-4">
          <div className="flex-1">
            <Textarea
              className="h-full min-h-[200px] resize-none"
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t("sequences.step3.memoPlaceholder")}
              value={memo}
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
              <p className="space-y-2 text-blue-900 text-xs dark:text-blue-200">
                <span className="block">
                  <strong>{t("sequences.step3.draftNote")}</strong>{" "}
                  {t("sequences.step3.draftNoteDescription")}
                </span>
                <span className="block">
                  <strong>{t("sequences.step3.readyNote")}</strong>{" "}
                  {t("sequences.step3.readyNoteDescription")}
                </span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="h-11 w-full"
                disabled={updateSequence.isPending}
                onClick={handleSaveReady}
                size="lg"
              >
                {updateSequence.isPending
                  ? t("sequences.step3.saving")
                  : t("sequences.step3.ready")}
              </Button>
              <Button
                className="h-11 w-full"
                disabled={updateSequence.isPending}
                onClick={handleSaveDraft}
                size="lg"
                variant="outline"
              >
                {t("sequences.step3.saveDraft")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
