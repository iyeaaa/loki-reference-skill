import { AlertCircle, Clock, Edit, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SequenceStep } from "@/lib/api/types/sequence"
import { cn } from "@/lib/utils"
import { SequenceStepForm } from "./SequenceStepForm"

interface EmailStep {
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  isDraft?: boolean
  files?: File[]
}

interface CreateCampaignStep2Props {
  data: {
    workspaceId: string
    customerGroupId: string
    steps: EmailStep[]
  }
  onChange: (data: { steps: EmailStep[] }) => void
}

const MAX_STEPS = 4

export function CreateCampaignStep2({ data, onChange }: CreateCampaignStep2Props) {
  const [steps, setSteps] = useState<EmailStep[]>(data.steps)
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(
    steps.length > 0 ? 0 : null,
  )
  const [editingStep, setEditingStep] = useState<EmailStep | null>(null)
  const [showStepEditor, setShowStepEditor] = useState(false)

  // Auto-save with debounce
  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ steps })
    }, 500)

    return () => clearTimeout(timer)
  }, [steps])

  const handleAddStep = () => {
    if (steps.length >= MAX_STEPS) {
      return
    }

    const newStepOrder = steps.length + 1
    setSelectedStepIndex(steps.length)
    setEditingStep({
      stepOrder: newStepOrder,
      delayDays: newStepOrder === 1 ? 0 : 1,
      scheduledHour: 9,
      scheduledMinute: 0,
      emailSubject: "",
      emailBodyText: "",
      isDraft: true,
    })
    setShowStepEditor(true)
  }

  const handleEditStep = (index: number) => {
    setSelectedStepIndex(index)
    setEditingStep({ ...steps[index] })
    setShowStepEditor(true)
  }

  const handleSaveStep = (
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
    if (selectedStepIndex === null) return

    console.log("📎 CreateCampaignStep2 - Saving files to local state:", files?.length || 0)

    const savedStep: EmailStep = {
      stepOrder: stepData.stepOrder,
      delayDays: stepData.delayDays,
      scheduledHour: stepData.scheduledHour ?? 9,
      scheduledMinute: stepData.scheduledMinute ?? 0,
      emailSubject: stepData.emailSubject,
      emailBodyText: stepData.emailBodyText || "",
      isDraft: false,
      files: files, // 파일을 로컬 상태로 저장
    }

    const updatedSteps = [...steps]
    if (selectedStepIndex >= updatedSteps.length) {
      // New step
      updatedSteps.push(savedStep)
    } else {
      // Update existing step
      updatedSteps[selectedStepIndex] = savedStep
    }
    setSteps(updatedSteps)
    setEditingStep(null)
    setShowStepEditor(false)
    setSelectedStepIndex(null)
  }

  const handleCancelEdit = () => {
    // 새 스텝 추가 중 취소한 경우 selectedStepIndex가 steps 길이와 같으면 추가하지 않음
    if (selectedStepIndex !== null && selectedStepIndex >= steps.length) {
      setSelectedStepIndex(null)
    }
    setEditingStep(null)
    setShowStepEditor(false)
  }

  const handleDeleteStep = (index: number) => {
    if (!confirm("이 스텝을 삭제하시겠습니까?")) return

    const updatedSteps = steps.filter((_, i) => i !== index)
    // Re-order steps
    updatedSteps.forEach((step, i) => {
      step.stepOrder = i + 1
    })
    setSteps(updatedSteps)
    setSelectedStepIndex(null)
    setEditingStep(null)
  }

  const hasDraftSteps = steps.some((step) => step.isDraft)

  return (
    <div className="grid grid-cols-2 gap-6 h-[450px]">
      {/* Left Panel - Steps List */}
      <div className="space-y-4 border-r pr-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">이메일 스텝</h3>
          <Button size="sm" onClick={handleAddStep} disabled={steps.length >= MAX_STEPS}>
            <Plus className="h-4 w-4 mr-1" />
            스텝 추가
          </Button>
        </div>

        {steps.length >= MAX_STEPS && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3">
            <p className="text-xs text-amber-900 dark:text-amber-200">
              최대 {MAX_STEPS}개의 스텝까지 추가할 수 있습니다
            </p>
          </div>
        )}

        {hasDraftSteps && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-900 dark:text-blue-200">
              작성 중인 스텝이 있습니다. 모든 스텝을 저장한 후 다음 단계로 진행할 수 있습니다
            </p>
          </div>
        )}

        <ScrollArea className="h-[380px]">
          {steps.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-lg border-2 border-dashed">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">아직 스텝이 없습니다</p>
                <p className="text-xs text-muted-foreground">
                  "스텝 추가" 버튼을 눌러 첫 번째 이메일을 만들어보세요
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => (
                // biome-ignore lint/a11y/noStaticElementInteractions: why not..?
                <div
                  key={index}
                  className={cn(
                    "rounded-lg border p-4 cursor-pointer transition-colors",
                    selectedStepIndex === index
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => !showStepEditor && setSelectedStepIndex(index)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">Step {step.stepOrder}</span>
                        {step.isDraft && (
                          <Badge
                            variant="secondary"
                            className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          >
                            작성 중
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        {step.delayDays === 0 ? "즉시 발송" : `${step.delayDays}일 후`}
                        {" · "}
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </div>
                      {step.emailSubject && (
                        <p className="text-sm font-medium truncate">{step.emailSubject}</p>
                      )}
                      {!step.emailSubject && (
                        <p className="text-sm text-muted-foreground italic">제목 없음</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditStep(index)
                        }}
                        disabled={showStepEditor}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteStep(index)
                        }}
                        disabled={showStepEditor}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Email Preview or Editor */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {showStepEditor && editingStep
            ? editingStep.emailSubject
              ? "스텝 수정"
              : "새 스텝 추가"
            : "이메일 미리보기"}
        </h3>

        {showStepEditor && editingStep ? (
          <ScrollArea className="h-[420px]">
            <div className="pr-4">
              <SequenceStepForm
                step={
                  editingStep.emailSubject
                    ? ({
                        id: `temp-${editingStep.stepOrder}`,
                        stepOrder: editingStep.stepOrder,
                        delayDays: editingStep.delayDays,
                        scheduledHour: editingStep.scheduledHour,
                        scheduledMinute: editingStep.scheduledMinute,
                        emailSubject: editingStep.emailSubject,
                        emailBodyText: editingStep.emailBodyText,
                      } as SequenceStep)
                    : undefined
                }
                stepOrder={editingStep.stepOrder}
                workspaceId={data.workspaceId}
                customerGroupId={data.customerGroupId}
                onSave={handleSaveStep}
                onCancel={handleCancelEdit}
              />
            </div>
          </ScrollArea>
        ) : selectedStepIndex === null || selectedStepIndex >= steps.length ? (
          <div className="flex h-[420px] items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-sm text-muted-foreground">
              {selectedStepIndex !== null && selectedStepIndex >= steps.length
                ? "새 스텝을 작성하고 있습니다"
                : "좌측에서 스텝을 선택하거나 추가하세요"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30">
              <p className="text-sm text-muted-foreground mb-2">
                스텝을 수정하려면 편집 버튼을 클릭하세요
              </p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">발송 스케줄</Label>
                  <p className="text-sm mt-1">
                    {steps[selectedStepIndex].delayDays === 0
                      ? "즉시 발송"
                      : `${steps[selectedStepIndex].delayDays}일 후`}
                    {" · "}
                    {String(steps[selectedStepIndex].scheduledHour).padStart(2, "0")}:
                    {String(steps[selectedStepIndex].scheduledMinute).padStart(2, "0")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">이메일 제목</Label>
                  <p className="text-sm mt-1 font-medium">
                    {steps[selectedStepIndex].emailSubject || "(제목 없음)"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">이메일 본문</Label>
                  <ScrollArea className="h-[280px] mt-1 rounded-md border p-3 bg-background">
                    <p className="text-sm whitespace-pre-wrap">
                      {steps[selectedStepIndex].emailBodyText || "(본문 없음)"}
                    </p>
                  </ScrollArea>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
