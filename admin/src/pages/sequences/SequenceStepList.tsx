import { Check, Clock, Edit, Plus, Trash2, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
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

type SequenceStepsListProps = {
  sequenceId?: string
  isEdit?: boolean
  readOnly?: boolean // If true, only unsent steps can be edited
}

export function SequenceStepsList({
  sequenceId,
  isEdit = false,
  readOnly = false,
}: SequenceStepsListProps) {
  const { t } = useTranslation()
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [viewingStep, setViewingStep] = useState<SequenceStep | null>(null)

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
      scheduledHour?: number | null
      scheduledMinute?: number | null
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
      // Ensure scheduledHour and scheduledMinute are not null (API doesn't accept null)
      scheduledHour: stepData.scheduledHour ?? 9,
      scheduledMinute: stepData.scheduledMinute ?? 0,
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
      scheduledHour?: number | null
      scheduledMinute?: number | null
      timezone?: string
      emailSubject: string
      emailBodyText?: string
    },
    files?: File[],
  ) => {
    if (!editingStep) {
      return
    }
    const updateData: SequenceStepUpdateInput = {
      stepOrder: stepData.stepOrder,
      delayDays: stepData.delayDays,
      // Ensure scheduledHour and scheduledMinute are not null (API doesn't accept null)
      scheduledHour: stepData.scheduledHour ?? 9,
      scheduledMinute: stepData.scheduledMinute ?? 0,
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
    if (!confirm(t("sequences.stepsList.confirm.deleteStep"))) {
      return
    }
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
    if (!inlineEditingStepId) {
      return
    }

    const updateData: SequenceStepUpdateInput = {
      stepOrder: step.stepOrder,
      delayDays: inlineEditValues.delayDays,
      // Ensure scheduledHour and scheduledMinute are not null (API doesn't accept null)
      scheduledHour: inlineEditValues.scheduledHour ?? 9,
      scheduledMinute: inlineEditValues.scheduledMinute ?? 0,
      timezone: step.timezone ?? "Asia/Seoul",
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

  if (!(isEdit || sequenceId)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("sequences.stepsList.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground text-sm">
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
          {sequenceId && !readOnly && (
            <Button
              disabled={!hasCustomerGroup}
              onClick={() => setIsCreating(true)}
              size="sm"
              variant="outline"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("sequences.stepsList.addStep")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!(isLoadingSequence || hasCustomerGroup) && (
            <div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
              <p className="mb-2 font-semibold text-amber-900 text-sm dark:text-amber-200">
                {t("sequences.stepsList.warning.setCustomerGroupFirst")}
              </p>
              <p className="mb-3 text-amber-800 text-xs dark:text-amber-300">
                {t("sequences.stepsList.warning.customerGroupRequired")}
              </p>
            </div>
          )}
          {isLoading ? (
            <p className="py-4 text-center text-muted-foreground text-sm">
              {t("sequences.stepsList.loading")}
            </p>
          ) : steps.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-muted-foreground text-sm">
                {t("sequences.stepsList.noSteps")}
              </p>
              {sequenceId && !readOnly && (
                <Button disabled={!hasCustomerGroup} onClick={() => setIsCreating(true)} size="sm">
                  <Plus className="mr-1 h-4 w-4" />
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
                  // Step is editable if:
                  // 1. readOnly is false (draft/ready mode), OR
                  // 2. readOnly is true BUT this step has not been sent yet (executionCount === 0)
                  const isStepEditable = !readOnly || (step.executionCount ?? 0) === 0
                  const hasSentEmails = (step.executionCount ?? 0) > 0

                  return (
                    // biome-ignore lint/a11y/useSemanticElements: Complex card with nested interactive elements
                    <div
                      className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                      key={step.id}
                      onClick={() => {
                        if (!(isFullEditing || isInlineEditing)) {
                          setViewingStep(step)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          if (!(isFullEditing || isInlineEditing)) {
                            setViewingStep(step)
                          }
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      {/* 전체 편집 모드 */}
                      {isFullEditing ? (
                        <div className="max-h-[80vh] overflow-y-auto">
                          <div className="sticky top-0 z-10 mb-4 flex items-center justify-between bg-background pb-2">
                            <h3 className="font-medium">
                              {t("sequences.stepsList.dialog.editTitle")}
                            </h3>
                            <Button onClick={() => setEditingStep(null)} size="sm" variant="ghost">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <SequenceStepForm
                            customerGroupId={sequence?.customerGroupId || undefined}
                            onCancel={() => setEditingStep(null)}
                            onSave={handleUpdateStep}
                            step={step}
                            stepOrder={step.stepOrder}
                            workspaceId={sequence?.workspaceId}
                          />
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <Badge className="text-xs" variant="outline">
                                {t("sequences.stepsList.stepNumber", { order: step.stepOrder })}
                              </Badge>

                              {/* 인라인 편집 모드 */}
                              {isInlineEditing ? (
                                // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation for event bubbling
                                <div
                                  className="flex flex-wrap items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs">
                                      {t("sequences.stepsList.inlineEdit.delayDays", "대기일")}
                                    </Label>
                                    <Input
                                      className="h-7 w-16 text-xs"
                                      min="0"
                                      onChange={(e) =>
                                        setInlineEditValues({
                                          ...inlineEditValues,
                                          delayDays: Number.parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                      type="number"
                                      value={inlineEditValues.delayDays}
                                    />
                                    <span className="text-muted-foreground text-xs">
                                      {t("sequences.stepsList.inlineEdit.days", "일")}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <Input
                                      className="h-7 w-12 text-xs"
                                      max="23"
                                      min="0"
                                      onChange={(e) =>
                                        setInlineEditValues({
                                          ...inlineEditValues,
                                          scheduledHour: Number.parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                      type="number"
                                      value={inlineEditValues.scheduledHour}
                                    />
                                    <span className="text-xs">:</span>
                                    <Input
                                      className="h-7 w-12 text-xs"
                                      max="59"
                                      min="0"
                                      onChange={(e) =>
                                        setInlineEditValues({
                                          ...inlineEditValues,
                                          scheduledMinute: Number.parseInt(e.target.value, 10) || 0,
                                        })
                                      }
                                      type="number"
                                      value={inlineEditValues.scheduledMinute}
                                    />
                                  </div>

                                  <Button
                                    className="h-7 px-2 text-xs"
                                    onClick={() => handleSaveInlineEdit(step)}
                                    size="sm"
                                    variant="default"
                                  >
                                    {t("sequences.stepsList.inlineEdit.save", "저장")}
                                  </Button>
                                  <Button
                                    className="h-7 px-2 text-xs"
                                    onClick={handleCancelInlineEdit}
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge
                                  className={`text-xs ${isStepEditable ? "cursor-pointer hover:bg-secondary/80" : ""} transition-colors`}
                                  onClick={(e) => {
                                    if (!isStepEditable) {
                                      return
                                    }
                                    e.stopPropagation()
                                    handleStartInlineEdit(step)
                                  }}
                                  title={
                                    isStepEditable
                                      ? t(
                                          "sequences.stepsList.inlineEdit.clickToEdit",
                                          "클릭하여 날짜/시간 수정",
                                        )
                                      : hasSentEmails
                                        ? t(
                                            "sequences.stepsList.inlineEdit.alreadySent",
                                            "이미 발송된 스텝은 수정할 수 없습니다",
                                          )
                                        : undefined
                                  }
                                  variant="secondary"
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
                              className="mb-1 truncate font-medium text-sm"
                              title={step.emailSubject}
                            >
                              {step.emailSubject}
                            </h4>
                            {step.emailBodyText && (
                              <p className="line-clamp-2 text-muted-foreground text-xs">
                                {step.emailBodyText}
                              </p>
                            )}
                          </div>
                          {/* Show edit/delete buttons OR sent indicator */}
                          {isStepEditable ? (
                            // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation for event bubbling
                            <div
                              className="flex flex-shrink-0 gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                className="h-8 px-2"
                                disabled={isInlineEditing}
                                onClick={() => setEditingStep(step)}
                                size="sm"
                                variant="outline"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {!readOnly && (
                                <Button
                                  className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  disabled={isInlineEditing}
                                  onClick={() => handleDeleteStep(step.id)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          ) : hasSentEmails ? (
                            <Badge
                              className="flex-shrink-0 border-green-200 bg-green-50 text-green-600 text-xs"
                              variant="outline"
                            >
                              <Check className="mr-1 h-3 w-3" />
                              {t("sequences.stepsList.sent", "발송됨")} ({step.executionCount})
                            </Badge>
                          ) : null}
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
              <Button onClick={() => setIsCreating(false)} size="sm" variant="ghost">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[80vh] overflow-y-auto">
            <SequenceStepForm
              customerGroupId={sequence?.customerGroupId || undefined}
              onCancel={() => setIsCreating(false)}
              onSave={handleCreateStep}
              stepOrder={nextStepOrder}
              workspaceId={sequence?.workspaceId}
            />
          </CardContent>
        </Card>
      )}

      {/* 이메일 상세 보기 Dialog */}
      <Dialog onOpenChange={(open) => !open && setViewingStep(null)} open={!!viewingStep}>
        <DialogContent className="max-h-[80vh] max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge className="text-xs" variant="outline">
                {t("sequences.stepsList.stepNumber", { order: viewingStep?.stepOrder })}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {viewingStep?.delayDays === 0
                  ? t("sequences.stepsList.sendImmediately")
                  : t("sequences.stepsList.sendAfterDays", {
                      days: viewingStep?.delayDays,
                    })}
                {" • "}
                {`${viewingStep?.scheduledHour?.toString().padStart(2, "0") ?? "09"}:${viewingStep?.scheduledMinute?.toString().padStart(2, "0") ?? "00"}`}
              </span>
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* 제목 */}
              <div className="space-y-2">
                <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {t("sequences.stepsList.dialog.subject", "제목")}
                </Label>
                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="font-medium">{viewingStep?.emailSubject}</p>
                </div>
              </div>

              {/* 본문 */}
              <div className="space-y-2">
                <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                  {t("sequences.stepsList.dialog.body", "본문")}
                </Label>
                <div className="min-h-[200px] rounded-md border bg-muted/50 p-4">
                  {viewingStep?.emailBodyHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: Email content from trusted source
                      dangerouslySetInnerHTML={{ __html: viewingStep.emailBodyHtml }}
                    />
                  ) : viewingStep?.emailBodyText ? (
                    <p className="whitespace-pre-wrap text-sm">{viewingStep.emailBodyText}</p>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      {t("sequences.stepsList.dialog.noContent", "내용이 없습니다.")}
                    </p>
                  )}
                </div>
              </div>

              {/* 첨부파일 */}
              {viewingStep?.attachments && viewingStep.attachments.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    {t("sequences.stepsList.dialog.attachments", "첨부파일")}
                  </Label>
                  <div className="rounded-md border bg-muted/50 p-3">
                    <ul className="space-y-1">
                      {viewingStep.attachments.map((attachment, index) => (
                        <li className="flex items-center gap-2 text-sm" key={index}>
                          <span className="truncate">{attachment.filename}</span>
                          <span className="text-muted-foreground text-xs">
                            ({Math.round((attachment.size || 0) / 1024)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end border-t pt-4">
            <Button onClick={() => setViewingStep(null)} variant="outline">
              {t("sequences.stepsList.dialog.close", "닫기")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
