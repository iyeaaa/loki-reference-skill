import { Clock, Edit, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  // 인라인 편집 상태
  const [inlineEditingStepId, setInlineEditingStepId] = useState<string | null>(null)
  const [inlineEditValues, setInlineEditValues] = useState<{
    delayDays: number
    scheduledHour: number
    scheduledMinute: number
  }>({ delayDays: 0, scheduledHour: 9, scheduledMinute: 0 })

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

  // 인라인 편집 시작
  const handleStartInlineEdit = (step: SequenceStep) => {
    setInlineEditingStepId(step.id)
    setInlineEditValues({
      delayDays: step.delayDays,
      scheduledHour: step.scheduledHour ?? 9,
      scheduledMinute: step.scheduledMinute ?? 0,
    })
  }

  // 인라인 편집 취소
  const handleCancelInlineEdit = () => {
    setInlineEditingStepId(null)
    setInlineEditValues({ delayDays: 0, scheduledHour: 9, scheduledMinute: 0 })
  }

  // 인라인 편집 저장
  const handleSaveInlineEdit = (step: SequenceStep) => {
    if (!inlineEditingStepId) return

    const updateData: SequenceStepUpdateInput = {
      stepOrder: step.stepOrder,
      delayDays: inlineEditValues.delayDays,
      scheduledHour: inlineEditValues.scheduledHour,
      scheduledMinute: inlineEditValues.scheduledMinute,
      timezone: step.timezone ?? undefined,
      emailSubject: step.emailSubject,
      emailBodyText: step.emailBodyText || "",
    }

    updateStep.mutate(
      { stepId: step.id, data: updateData },
      {
        onSuccess: () => {
          handleCancelInlineEdit()
        },
      },
    )
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
                .map((step) => {
                  const isInlineEditing = inlineEditingStepId === step.id
                  const isFullEditing = editingStep?.id === step.id

                  return (
                    <div
                      key={step.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      {/* 전체 편집 모드 */}
                      {isFullEditing ? (
                        <div className="max-h-[80vh] overflow-y-auto">
                          <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 pb-2">
                            <h3 className="font-medium">
                              {t("sequences.stepsList.dialog.editTitle")}
                            </h3>
                            <Button variant="ghost" size="sm" onClick={() => setEditingStep(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <SequenceStepForm
                            step={step}
                            stepOrder={step.stepOrder}
                            workspaceId={sequence?.workspaceId}
                            customerGroupId={sequence?.customerGroupId || undefined}
                            onSave={handleUpdateStep}
                            onCancel={() => setEditingStep(null)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {t("sequences.stepsList.stepNumber", { order: step.stepOrder })}
                              </Badge>

                              {/* 인라인 편집 모드 */}
                              {isInlineEditing ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs">
                                      {t("sequences.stepsList.inlineEdit.delayDays", "대기일")}
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={inlineEditValues.delayDays}
                                      onChange={(e) =>
                                        setInlineEditValues({
                                          ...inlineEditValues,
                                          delayDays: parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                      className="h-7 w-16 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      {t("sequences.stepsList.inlineEdit.days", "일")}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <Input
                                      type="number"
                                      min="0"
                                      max="23"
                                      value={inlineEditValues.scheduledHour}
                                      onChange={(e) =>
                                        setInlineEditValues({
                                          ...inlineEditValues,
                                          scheduledHour: parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                      className="h-7 w-12 text-xs"
                                    />
                                    <span className="text-xs">:</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      max="59"
                                      value={inlineEditValues.scheduledMinute}
                                      onChange={(e) =>
                                        setInlineEditValues({
                                          ...inlineEditValues,
                                          scheduledMinute: parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                      className="h-7 w-12 text-xs"
                                    />
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleSaveInlineEdit(step)}
                                    className="h-7 px-2 text-xs"
                                  >
                                    {t("sequences.stepsList.inlineEdit.save", "저장")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelInlineEdit}
                                    className="h-7 px-2 text-xs"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStartInlineEdit(step)
                                  }}
                                  title={t(
                                    "sequences.stepsList.inlineEdit.clickToEdit",
                                    "클릭하여 날짜/시간 수정",
                                  )}
                                >
                                  {step.delayDays === 0
                                    ? t("sequences.stepsList.sendImmediately")
                                    : t("sequences.stepsList.sendAfterDays", {
                                        days: step.delayDays,
                                      })}
                                  {" • "}
                                  {`${step.scheduledHour?.toString().padStart(2, "0") ?? "09"}:${step.scheduledMinute?.toString().padStart(2, "0") ?? "00"}`}
                                </Badge>
                              )}
                            </div>
                            <h4
                              className="font-medium text-sm mb-1 truncate"
                              title={step.emailSubject}
                            >
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
                              disabled={isInlineEditing}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStep(step.id)}
                              className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={isInlineEditing}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Step - 인라인 폼 */}
      {isCreating && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t("sequences.stepsList.dialog.createTitle")}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[80vh] overflow-y-auto">
            <SequenceStepForm
              stepOrder={nextStepOrder}
              workspaceId={sequence?.workspaceId}
              customerGroupId={sequence?.customerGroupId || undefined}
              onSave={handleCreateStep}
              onCancel={() => setIsCreating(false)}
            />
          </CardContent>
        </Card>
      )}
    </>
  )
}
