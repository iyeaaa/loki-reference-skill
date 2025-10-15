import { Edit, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
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
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch steps only if we have a sequenceId (edit mode)
  const { data: steps = [], isLoading } = useSequenceSteps(sequenceId || "", !!sequenceId)

  // Fetch sequence to get workspaceId
  const { data: sequence } = useSequence(sequenceId || "", !!sequenceId)

  const createStep = useCreateSequenceStep(sequenceId)
  const updateStep = useUpdateSequenceStep(sequenceId)
  const deleteStep = useDeleteSequenceStep(sequenceId)

  const handleCreateStep = (stepData: {
    stepOrder: number
    delayDays: number
    scheduledHour?: number
    scheduledMinute?: number
    timezone?: string
    emailSubject: string
    emailBodyText?: string
  }) => {
    const createData: SequenceStepCreateInput = {
      stepOrder: stepData.stepOrder,
      delayDays: stepData.delayDays,
      scheduledHour: stepData.scheduledHour,
      scheduledMinute: stepData.scheduledMinute,
      timezone: stepData.timezone,
      emailSubject: stepData.emailSubject,
      emailBodyText: stepData.emailBodyText || "",
    }
    createStep.mutate(createData, {
      onSuccess: () => {
        setIsCreating(false)
      },
    })
  }

  const handleUpdateStep = (stepData: {
    stepOrder: number
    delayDays: number
    scheduledHour?: number
    scheduledMinute?: number
    timezone?: string
    emailSubject: string
    emailBodyText?: string
  }) => {
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
      { stepId: editingStep.id, data: updateData },
      {
        onSuccess: () => {
          setEditingStep(null)
        },
      },
    )
  }

  const handleDeleteStep = (stepId: string) => {
    if (!confirm("이 스텝을 삭제하시겠습니까?")) return
    deleteStep.mutate({ stepId })
  }

  // Calculate next step order
  const nextStepOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.stepOrder)) + 1 : 1

  if (!isEdit && !sequenceId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시퀀스 스텝</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            시퀀스를 생성한 후 스텝을 추가할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">시퀀스 스텝</CardTitle>
          {sequenceId && (
            <Button onClick={() => setIsCreating(true)} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              스텝 추가
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
          ) : steps.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">아직 생성된 스텝이 없습니다.</p>
              {sequenceId && (
                <Button onClick={() => setIsCreating(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1" />첫 스텝 추가
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
                            스텝 {step.stepOrder}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {step.delayDays === 0 ? "즉시 발송" : `${step.delayDays}일 후 발송`}
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
            <DialogTitle>새 스텝 추가</DialogTitle>
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
            <DialogTitle>스텝 수정</DialogTitle>
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
