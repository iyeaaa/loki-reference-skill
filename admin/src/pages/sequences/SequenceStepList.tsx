import { Edit, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useSequence,
  useSequenceSteps,
  useUpdateSequenceStep,
} from "@/lib/api/hooks/sequences"
import type {
  SequenceStep,
  SequenceStepCreateInput,
  SequenceStepUpdateInput,
} from "@/lib/api/types/sequence"
import { SequenceStepForm } from "./SequenceStepForm"

interface SequenceStepsListProps {
  sequenceId?: string
  isEdit?: boolean
}

export function SequenceStepsList({ sequenceId, isEdit = false }: SequenceStepsListProps) {
  const { t } = useTranslation()
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch steps only if we have a sequenceId (edit mode)
  const { data: steps = [], isLoading } = useSequenceSteps(sequenceId || "", !!sequenceId)

  // Fetch sequence to get workspaceId
  const { data: sequence, isLoading: isLoadingSequence } = useSequence(
    sequenceId || "",
    !!sequenceId,
  )

  const createStep = useCreateSequenceStep(sequenceId)
  const updateStep = useUpdateSequenceStep(sequenceId)
  const deleteStep = useDeleteSequenceStep(sequenceId)

  const handleCreateStep = (
    stepData: {
      stepOrder: number
      delayDays: number
      scheduledHour?: number
      scheduledMinute?: number
      timezone?: string
      emailSubject: string
      emailBodyText?: string
    },
    files?: File[],
  ) => {
    // 디버깅: 파일 확인
    console.log("📎 SequenceStepList - Received files:", files)
    console.log("📎 SequenceStepList - Files count:", files?.length || 0)

    const createData: SequenceStepCreateInput = {
      stepOrder: stepData.stepOrder,
      delayDays: stepData.delayDays,
      scheduledHour: stepData.scheduledHour,
      scheduledMinute: stepData.scheduledMinute,
      timezone: stepData.timezone,
      emailSubject: stepData.emailSubject,
      emailBodyText: stepData.emailBodyText || "",
    }
    createStep.mutate(
      { data: createData, files },
      {
        onSuccess: () => {
          setIsCreating(false)
        },
      },
    )
  }

  const handleUpdateStep = (
    stepData: {
      stepOrder: number
      delayDays: number
      scheduledHour?: number
      scheduledMinute?: number
      timezone?: string
      emailSubject: string
      emailBodyText?: string
    },
    files?: File[],
  ) => {
    if (!editingStep) return
    const updateData: SequenceStepUpdateInput = {
      stepOrder: stepData.stepOrder,
      delayDays: stepData.delayDays,
      scheduledHour: stepData.scheduledHour,
      scheduledMinute: stepData.scheduledMinute,
      timezone: stepData.timezone,
      emailSubject: stepData.emailSubject,
      emailBodyText: stepData.emailBodyText || "",
    }
    updateStep.mutate(
      { stepId: editingStep.id, data: updateData, files },
      {
        onSuccess: () => {
          setEditingStep(null)
        },
      },
    )
  }

  const handleDeleteStep = (stepId: string) => {
    if (!confirm(t("sequences.stepsList.confirm.deleteStep"))) return
    deleteStep.mutate({ stepId })
  }

  // Calculate next step order
  const nextStepOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.stepOrder)) + 1 : 1

  if (!isEdit && !sequenceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sequences.stepsList.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("sequences.stepsList.createSequenceFirst")}
          </p>
        </CardContent>
      </Card>
    )
  }

  // 고객그룹이 없는지 확인
  const hasCustomerGroup = !!sequence?.customerGroupId

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">{t("sequences.stepsList.title")}</CardTitle>
          {sequenceId && (
            <Button
              onClick={() => setIsCreating(true)}
              size="sm"
              variant="outline"
              disabled={!hasCustomerGroup}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("sequences.stepsList.addStep")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!isLoadingSequence && !hasCustomerGroup && (
            <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 mb-4">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
                {t("sequences.stepsList.warning.setCustomerGroupFirst")}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                {t("sequences.stepsList.warning.customerGroupRequired")}
              </p>
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("sequences.stepsList.loading")}
            </p>
          ) : steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                {t("sequences.stepsList.noSteps")}
              </p>
              {sequenceId && (
                <Button onClick={() => setIsCreating(true)} size="sm" disabled={!hasCustomerGroup}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("sequences.stepsList.addFirstStep")}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {steps
                .sort((a, b) => a.stepOrder - b.stepOrder)
                .map((step) => (
                  <div
                    key={step.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {t("sequences.stepsList.stepNumber", { order: step.stepOrder })}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {step.delayDays === 0
                              ? t("sequences.stepsList.sendImmediately")
                              : t("sequences.stepsList.sendAfterDays", { days: step.delayDays })}
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm mb-1 truncate" title={step.emailSubject}>
                          {step.emailSubject}
                        </h4>
                        {step.emailBodyText && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {step.emailBodyText}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingStep(step)}
                          className="h-8 px-2"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteStep(step.id)}
                          className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Step Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("sequences.stepsList.dialog.createTitle")}</DialogTitle>
          </DialogHeader>
          <SequenceStepForm
            stepOrder={nextStepOrder}
            workspaceId={sequence?.workspaceId}
            customerGroupId={sequence?.customerGroupId || undefined}
            onSave={handleCreateStep}
            onCancel={() => setIsCreating(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Step Dialog */}
      <Dialog open={!!editingStep} onOpenChange={() => setEditingStep(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("sequences.stepsList.dialog.editTitle")}</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <SequenceStepForm
              step={editingStep}
              stepOrder={editingStep.stepOrder}
              workspaceId={sequence?.workspaceId}
              customerGroupId={sequence?.customerGroupId || undefined}
              onSave={handleUpdateStep}
              onCancel={() => setEditingStep(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
