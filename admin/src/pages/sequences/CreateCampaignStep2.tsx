import { AlertCircle, Clock, Edit, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface EmailStep {
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  isDraft?: boolean
}

interface CreateCampaignStep2Props {
  data: {
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

  // Auto-save with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ steps })
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, onChange])

  const handleAddStep = () => {
    if (steps.length >= MAX_STEPS) {
      return
    }

    const newStep: EmailStep = {
      stepOrder: steps.length + 1,
      delayDays: steps.length === 0 ? 0 : 1,
      scheduledHour: 9,
      scheduledMinute: 0,
      emailSubject: "",
      emailBodyText: "",
      isDraft: true,
    }

    const updatedSteps = [...steps, newStep]
    setSteps(updatedSteps)
    setSelectedStepIndex(updatedSteps.length - 1)
    setEditingStep(newStep)
  }

  const handleEditStep = (index: number) => {
    setSelectedStepIndex(index)
    setEditingStep({ ...steps[index] })
  }

  const handleSaveStep = () => {
    if (!editingStep || selectedStepIndex === null) return

    if (!editingStep.emailSubject.trim()) {
      alert("이메일 제목을 입력해주세요")
      return
    }

    if (!editingStep.emailBodyText.trim()) {
      alert("이메일 본문을 입력해주세요")
      return
    }

    const updatedSteps = [...steps]
    updatedSteps[selectedStepIndex] = { ...editingStep, isDraft: false }
    setSteps(updatedSteps)
    setEditingStep(null)
  }

  const handleCancelEdit = () => {
    setEditingStep(null)
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

  const handleUpdateEditingStep = (field: keyof EmailStep, value: string | number) => {
    if (!editingStep) return
    setEditingStep({ ...editingStep, [field]: value })
  }

  const hasDraftSteps = steps.some((step) => step.isDraft)

  return (
    <div className="grid grid-cols-2 gap-6 h-[600px]">
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

        <ScrollArea className="h-[480px]">
          {steps.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
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
                // biome-ignore lint/a11y/noStaticElementInteractions: why not?
                <div
                  key={index}
                  className={cn(
                    "rounded-lg border p-4 cursor-pointer transition-colors",
                    selectedStepIndex === index
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50",
                  )}
                  onClick={() => !editingStep && setSelectedStepIndex(index)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">Step {step.stepOrder}</span>
                        {step.isDraft && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            작성 중
                          </span>
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
                        disabled={!!editingStep}
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
                        disabled={!!editingStep}
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

      {/* Right Panel - Email Editor */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">이메일 에디터</h3>

        {selectedStepIndex === null ? (
          <div className="flex h-[520px] items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-sm text-muted-foreground">좌측에서 스텝을 선택하거나 추가하세요</p>
          </div>
        ) : !editingStep ? (
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
                  <p className="text-sm mt-1 whitespace-pre-wrap">
                    {steps[selectedStepIndex].emailBodyText || "(본문 없음)"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[520px]">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>발송 지연 (일)</Label>
                <Input
                  type="number"
                  min={selectedStepIndex === 0 ? 0 : 1}
                  value={editingStep.delayDays}
                  onChange={(e) =>
                    handleUpdateEditingStep("delayDays", Number.parseInt(e.target.value, 10) || 0)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {editingStep.delayDays === 0
                    ? "즉시 발송됩니다"
                    : `이전 이메일로부터 ${editingStep.delayDays}일 후 발송됩니다`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>발송 시간</Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={editingStep.scheduledHour}
                    onChange={(e) =>
                      handleUpdateEditingStep(
                        "scheduledHour",
                        Number.parseInt(e.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>분</Label>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={editingStep.scheduledMinute}
                    onChange={(e) =>
                      handleUpdateEditingStep(
                        "scheduledMinute",
                        Number.parseInt(e.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>이메일 제목 *</Label>
                <Input
                  value={editingStep.emailSubject}
                  onChange={(e) => handleUpdateEditingStep("emailSubject", e.target.value)}
                  placeholder="예: K-Beauty Partnership Opportunity with {{company_name}}"
                />
              </div>

              <div className="space-y-2">
                <Label>이메일 본문 *</Label>
                <Textarea
                  value={editingStep.emailBodyText}
                  onChange={(e) => handleUpdateEditingStep("emailBodyText", e.target.value)}
                  placeholder="이메일 본문을 입력하세요..."
                  rows={12}
                />
                <p className="text-xs text-muted-foreground">
                  변수 사용 가능: {"{"}
                  {"{"} company_name {"}}"}
                  {"}"}, {"{"}
                  {"{"}
                  website_url {"}"}
                  {"}"} 등
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleCancelEdit}>
                  취소
                </Button>
                <Button onClick={handleSaveStep}>저장</Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
