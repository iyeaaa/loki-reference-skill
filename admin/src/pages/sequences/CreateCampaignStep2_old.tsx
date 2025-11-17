import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  Info,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { SignatureEditorModal } from "@/components/SignatureEditorModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RichTextEditor, type RichTextEditorRef } from "@/components/ui/rich-text-editor"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { TimePicker } from "@/components/ui/time-picker"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useDefaultEmailSignature } from "@/lib/api/hooks/email-signatures"
import {
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useUpdateSequenceStep,
} from "@/lib/api/hooks/sequences"
import { useAuth } from "@/lib/auth-provider"
import { cn } from "@/lib/utils"
import { generateSignatureHtml } from "@/lib/utils/email-signature"

interface EmailStep {
  id?: string // Step ID if it exists in DB
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  isDraft?: boolean
  files?: File[]
  isAdvertisement?: boolean
  emailSignature?: string // 서명을 별도로 저장
}

interface CreateCampaignStep2Props {
  sequenceId?: string | null
  data: {
    workspaceId: string
    customerGroupId: string
    steps: EmailStep[]
  }
  onChange: (data: { steps: EmailStep[] }) => void
}

const MAX_STEPS = 4

// Helper function to get current hour rounded up (ceil)
const getCeiledHour = () => {
  const now = new Date()
  const currentHour = now.getHours()
  const currentMinute = now.getMinutes()
  // If there are minutes, round up to next hour
  return currentMinute > 0 ? Math.min(currentHour + 1, 23) : currentHour
}

// Variables that can be inserted
const VARIABLES = [
  { label: "회사명", value: "{{회사명}}" },
  { label: "담당자명", value: "{{담당자명}}" },
  { label: "이메일", value: "{{이메일}}" },
  { label: "웹사이트", value: "{{웹사이트}}" },
  { label: "전화번호", value: "{{전화번호}}" },
  { label: "주소", value: "{{주소}}" },
]

export function CreateCampaignStep2({ sequenceId, data, onChange }: CreateCampaignStep2Props) {
  const { user } = useAuth()
  const createSequenceStep = useCreateSequenceStep()
  const updateSequenceStep = useUpdateSequenceStep()
  const deleteSequenceStep = useDeleteSequenceStep()

  // Get default signature from database
  const { data: defaultSignature } = useDefaultEmailSignature(
    {
      workspaceId: data.workspaceId || "",
      userId: user?.id || "",
    },
    !!data.workspaceId && !!user?.id,
  )

  // Get user signature
  const getUserSignature = () => {
    // DB에서 가져온 기본 서명이 있으면 사용
    if (defaultSignature) {
      return defaultSignature.signatureHtml
    }
    // 없으면 하드코딩된 기본 서명 사용 (폴백)
    if (user) {
      const name = user.name || user.username || "사용자"
      const title = user.department_name || "직원"
      return generateSignatureHtml({ name, title })
    }
    return generateSignatureHtml()
  }

  const [steps, setSteps] = useState<EmailStep[]>(() => {
    // Initialize with Step 1 if no steps exist
    if (data.steps.length === 0) {
      return [
        {
          stepOrder: 1,
          delayDays: 0,
          scheduledHour: getCeiledHour(),
          scheduledMinute: 0,
          emailSubject: "",
          emailBodyText: "",
          isDraft: true,
        },
      ]
    }
    return data.steps
  })

  const [selectedStepIndex, setSelectedStepIndex] = useState<number>(0)
  const [showAISheet, setShowAISheet] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const prevDataStepsRef = useRef(data.steps)
  const editorRef = useRef<RichTextEditorRef>(null)

  // 인라인 스케줄 편집 상태
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null)

  // Current editing step
  const currentStep = steps[selectedStepIndex]

  // Update steps when data.steps changes (e.g., when loading existing campaign)
  useEffect(() => {
    if (data.steps.length === 0) return

    const prevStepsStr = JSON.stringify(
      prevDataStepsRef.current.map((s) => ({ id: s.id, subject: s.emailSubject })),
    )
    const newStepsStr = JSON.stringify(
      data.steps.map((s) => ({ id: s.id, subject: s.emailSubject })),
    )

    if (prevStepsStr !== newStepsStr) {
      console.log("📥 Step2 - Data steps changed, updating:", data.steps)
      setSteps(data.steps)
      prevDataStepsRef.current = data.steps
    }
  }, [data.steps])

  // DB에서 서명이 로드되면 모든 스텝에 서명 설정
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run when signature loads, not when steps change
  useEffect(() => {
    if (defaultSignature) {
      const signature = defaultSignature.signatureHtml
      const updatedSteps = steps.map((step) => ({
        ...step,
        emailSignature: step.emailSignature || signature,
      }))
      setSteps(updatedSteps)
    }
  }, [defaultSignature])

  // Auto-save with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ steps })
    }, 500)

    return () => clearTimeout(timer)
  }, [steps, onChange])

  const updateCurrentStep = (updates: Partial<EmailStep>) => {
    const updatedSteps = [...steps]

    // 제목이 변경되는 경우 "(광고) " 상태를 자동으로 감지
    if (updates.emailSubject !== undefined) {
      const hasAdvertisement = updates.emailSubject.startsWith("(광고) ")
      updates.isAdvertisement = hasAdvertisement
    }

    updatedSteps[selectedStepIndex] = {
      ...updatedSteps[selectedStepIndex],
      ...updates,
    }
    setSteps(updatedSteps)
  }

  const handleAdvertisementToggle = (checked: boolean) => {
    const currentSubject = currentStep.emailSubject
    let newSubject = currentSubject

    if (checked) {
      // 체크: "(광고) " 추가 (이미 있으면 추가하지 않음)
      if (!currentSubject.startsWith("(광고) ")) {
        newSubject = `(광고) ${currentSubject}`
      }
    } else {
      // 체크 해제: "(광고) " 제거
      newSubject = currentSubject.replace(/^\(광고\)\s*/, "")
    }

    updateCurrentStep({
      emailSubject: newSubject,
      isAdvertisement: checked,
    })
  }

  const handleAddStep = () => {
    if (steps.length >= MAX_STEPS) {
      toast.error(`최대 ${MAX_STEPS}개의 스텝까지 추가할 수 있습니다`)
      return
    }

    const newStep: EmailStep = {
      stepOrder: steps.length + 1,
      delayDays: 1, // Default 1 day after previous step
      scheduledHour: getCeiledHour(),
      scheduledMinute: 0,
      emailSubject: "",
      emailBodyText: "",
      isDraft: true,
    }

    setSteps([...steps, newStep])
    setSelectedStepIndex(steps.length)
  }

  const handleDeleteStep = async (index: number) => {
    // Cannot delete step 1
    if (index === 0) {
      toast.error("첫 번째 스텝은 삭제할 수 없습니다")
      return
    }

    if (!confirm("이 스텝을 삭제하시겠습니까?")) return

    const stepToDelete = steps[index]

    // Delete from DB if it has an ID
    if (sequenceId && stepToDelete.id) {
      try {
        await deleteSequenceStep.mutateAsync({
          sequenceId,
          stepId: stepToDelete.id,
        })
      } catch (error) {
        toast.error(`스텝 삭제 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
        return
      }
    }

    const updatedSteps = steps.filter((_, i) => i !== index)
    // Re-order steps
    updatedSteps.forEach((step, i) => {
      step.stepOrder = i + 1
    })
    setSteps(updatedSteps)

    // Adjust selected index
    if (selectedStepIndex >= updatedSteps.length) {
      setSelectedStepIndex(updatedSteps.length - 1)
    }
  }

  const handleSaveCurrentStep = async () => {
    if (!currentStep.emailSubject.trim()) {
      toast.error("이메일 제목을 입력해주세요")
      return
    }
    if (!currentStep.emailBodyText.trim()) {
      toast.error("이메일 본문을 입력해주세요")
      return
    }

    // Save to local state first
    updateCurrentStep({ isDraft: false })

    // Save to DB if sequenceId exists
    if (sequenceId) {
      try {
        // 저장 시 서명을 본문에 결합
        let emailBodyWithSignature = currentStep.emailBodyText
        if (currentStep.emailSignature) {
          emailBodyWithSignature = `${currentStep.emailBodyText}\n\n${currentStep.emailSignature}`
        }

        const stepData = {
          stepOrder: currentStep.stepOrder,
          delayDays: currentStep.delayDays,
          scheduledHour: currentStep.scheduledHour,
          scheduledMinute: currentStep.scheduledMinute,
          emailSubject: currentStep.emailSubject,
          emailBodyText: emailBodyWithSignature,
        }

        if (currentStep.id) {
          // Update existing step
          const updatedStep = await updateSequenceStep.mutateAsync({
            sequenceId,
            stepId: currentStep.id,
            data: stepData,
            files: currentStep.files,
          })
          // Update step ID in local state if it was just created
          if (updatedStep?.id && !currentStep.id) {
            const updatedSteps = [...steps]
            updatedSteps[selectedStepIndex] = {
              ...updatedSteps[selectedStepIndex],
              id: updatedStep.id,
            }
            setSteps(updatedSteps)
          }
        } else {
          // Create new step
          const createdStep = await createSequenceStep.mutateAsync({
            data: {
              sequenceId,
              ...stepData,
            },
            files: currentStep.files,
          })
          // Update step ID in local state
          if (createdStep?.id) {
            const updatedSteps = [...steps]
            updatedSteps[selectedStepIndex] = {
              ...updatedSteps[selectedStepIndex],
              id: createdStep.id,
            }
            setSteps(updatedSteps)
          }
        }
        toast.success("스텝이 저장되었습니다")
      } catch (error) {
        toast.error(`스텝 저장 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`)
      }
    } else {
      toast.success("스텝이 저장되었습니다 (DB 저장은 다음 단계에서 수행됩니다)")
    }
  }

  const isStepComplete = (step: EmailStep) => {
    return !step.isDraft && step.emailSubject.trim() && step.emailBodyText.trim()
  }

  const insertVariable = (variable: string) => {
    // Insert at cursor position using editor ref
    if (editorRef.current) {
      editorRef.current.insertTextAtCursor(variable)
    } else {
      // Fallback: append to end
      updateCurrentStep({
        emailBodyText: currentStep.emailBodyText + variable,
      })
    }
  }

  const handleSaveSignature = (signature: string) => {
    updateCurrentStep({
      emailSignature: signature,
    })
    setIsSignatureModalOpen(false)
  }

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("AI 프롬프트를 입력해주세요")
      return
    }

    setIsGeneratingAI(true)
    try {
      // TODO: Call actual AI API - For now using mock data
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock AI generated content
      const aiSubject = `AI 생성: ${aiPrompt.substring(0, 30)}`
      const aiBody = `안녕하세요 {{담당자명}}님,\n\n${aiPrompt}에 대한 내용입니다.\n\n{{회사명}}에 관심을 가져주셔서 감사합니다.\n\n감사합니다.`

      // Update current step with AI generated content
      updateCurrentStep({
        emailSubject: aiSubject,
        emailBodyText: aiBody,
      })

      toast.success("AI 이메일이 생성되었습니다")
      setShowAISheet(false)
      setAiPrompt("")
    } catch {
      toast.error("AI 이메일 생성 실패")
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const hasDraftSteps = steps.some((step) => step.isDraft)

  return (
    <div className="h-full flex gap-6">
      {/* Left Panel - Steps List (30%) */}
      <div className="w-[30%] flex flex-col gap-4 border-r pr-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">이메일 스텝</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px]">
                  <p className="text-xs">
                    <strong>동작 방식:</strong> 각 이메일을 순차적으로 발송합니다. 답장이 오면
                    캠페인이 즉시 중지되고, 답장이 없으면 설정한 일수 후 다음 이메일을 발송합니다.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={handleAddStep}
                  disabled={steps.length >= MAX_STEPS}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  추가
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>새 이메일 스텝 추가 (최대 {MAX_STEPS}개)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {hasDraftSteps && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-900 dark:text-amber-200">
              작성 중인 스텝이 있습니다. 모든 스텝을 저장한 후 다음 단계로 진행하세요
            </p>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {steps.map((step, index) => (
              <button
                key={`step-${step.stepOrder}-${index}`}
                type="button"
                className={cn(
                  "w-full rounded-lg border p-3 cursor-pointer transition-all text-left",
                  selectedStepIndex === index
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "hover:bg-muted/50",
                )}
                onClick={() => setSelectedStepIndex(index)}
              >
                {/* Schedule info above step - Inline editable */}
                <div className="mb-2 pb-2 border-b">
                  {editingScheduleIndex === index ? (
                    // 인라인 편집 모드
                    // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation is needed to prevent parent click
                    <div
                      className="space-y-2 p-2 bg-muted/50 rounded"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {index === 0 ? (
                        // 첫 번째 스텝: 절대적 날짜 선택
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs">발송 날짜</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal h-7 text-xs",
                                    !step.delayDays && "text-muted-foreground",
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-3 w-3" />
                                  {step.delayDays === 0
                                    ? "오늘"
                                    : format(
                                        new Date(Date.now() + step.delayDays * 24 * 60 * 60 * 1000),
                                        "PPP",
                                        { locale: ko },
                                      )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={
                                    new Date(Date.now() + step.delayDays * 24 * 60 * 60 * 1000)
                                  }
                                  onSelect={(date) => {
                                    if (date) {
                                      const now = new Date()
                                      const diffTime = date.getTime() - now.getTime()
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                      const updatedSteps = [...steps]
                                      updatedSteps[index].delayDays = Math.max(0, diffDays)
                                      setSteps(updatedSteps)
                                    }
                                  }}
                                  disabled={(date) =>
                                    date < new Date(new Date().setHours(0, 0, 0, 0))
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">발송 시간</Label>
                            <TimePicker
                              value={{
                                hour: step.scheduledHour ?? 9,
                                minute: step.scheduledMinute ?? 0,
                              }}
                              onChange={(time) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].scheduledHour = time.hour
                                updatedSteps[index].scheduledMinute = time.minute
                                setSteps(updatedSteps)
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        // 나머지 스텝: 상대적 날짜 (며칠 후)
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-16">대기일</Label>
                            <Input
                              type="number"
                              min="1"
                              value={step.delayDays}
                              onChange={(e) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].delayDays = parseInt(e.target.value, 10) || 1
                                setSteps(updatedSteps)
                              }}
                              className="h-7 w-16 text-xs"
                            />
                            <span className="text-xs">일 후</span>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">발송 시간</Label>
                            <TimePicker
                              value={{
                                hour: step.scheduledHour ?? 9,
                                minute: step.scheduledMinute ?? 0,
                              }}
                              onChange={(time) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].scheduledHour = time.hour
                                updatedSteps[index].scheduledMinute = time.minute
                                setSteps(updatedSteps)
                              }}
                            />
                          </div>
                        </>
                      )}
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingScheduleIndex(null)
                            toast.success("스케줄이 저장되었습니다")
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          저장
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingScheduleIndex(null)
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 보기 모드
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 h-auto p-1 text-xs text-muted-foreground hover:text-foreground group"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation()
                        setEditingScheduleIndex(index)
                      }}
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {index === 0 ? (
                        // 첫 번째 스텝: 절대적 날짜 표시
                        <span>
                          {step.delayDays === 0
                            ? "오늘"
                            : format(
                                new Date(Date.now() + step.delayDays * 24 * 60 * 60 * 1000),
                                "MM월 dd일",
                                { locale: ko },
                              )}
                        </span>
                      ) : (
                        // 나머지 스텝: 상대적 날짜 표시
                        <span>{step.delayDays === 0 ? "즉시 발송" : `${step.delayDays}일 후`}</span>
                      )}
                      <Clock className="h-3 w-3 ml-1" />
                      <span>
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        수정
                      </span>
                    </Button>
                  )}
                </div>

                {/* Step content */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">스텝 {step.stepOrder}</span>
                      {isStepComplete(step) ? (
                        <Badge
                          variant="default"
                          className="text-xs px-2 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          완료
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        >
                          작성중
                        </Badge>
                      )}
                    </div>
                    {step.emailSubject ? (
                      <p className="text-sm font-medium truncate">{step.emailSubject}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">제목 없음</p>
                    )}
                  </div>

                  {index > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteStep(index)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>스텝 삭제</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Email Editor (70%) */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">스텝 {currentStep?.stepOrder} 편집</h3>
            <p className="text-sm text-muted-foreground">이메일 내용을 작성하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAISheet(true)}
              className="h-9"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              AI 생성
            </Button>
            <Button onClick={handleSaveCurrentStep} size="sm" className="h-9">
              <Check className="h-4 w-4 mr-2" />
              저장
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {/* Email Subject */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>이메일 제목 *</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`advertisement-${selectedStepIndex}`}
                    checked={currentStep?.isAdvertisement || false}
                    onCheckedChange={(checked) => handleAdvertisementToggle(checked as boolean)}
                  />
                  <Label
                    htmlFor={`advertisement-${selectedStepIndex}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    (광고) 표시
                  </Label>
                </div>
              </div>
              <Input
                value={currentStep?.emailSubject || ""}
                onChange={(e) => updateCurrentStep({ emailSubject: e.target.value })}
                placeholder="예: 안녕하세요, {{회사명}} 담당자님"
              />
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label>변수 삽입</Label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                {VARIABLES.map((variable) => (
                  <Button
                    key={variable.value}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.value)}
                    className="h-7 text-xs"
                  >
                    {variable.label}
                  </Button>
                ))}
                <p className="w-full text-xs text-muted-foreground mt-2">
                  클릭하면 본문에 변수가 추가됩니다
                </p>
              </div>
            </div>

            {/* Email Body with RichTextEditor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>이메일 본문 *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSignatureModalOpen(true)}
                  className="h-7"
                >
                  <Mail className="h-3 w-3 mr-1" />
                  서명 편집
                </Button>
              </div>
              <RichTextEditor
                ref={editorRef}
                value={currentStep?.emailBodyText || ""}
                onChange={(value) => updateCurrentStep({ emailBodyText: value })}
                placeholder="이메일 내용을 입력하세요..."
                height="300px"
              />

              {/* 서명 프리뷰 */}
              {currentStep?.emailSignature && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-muted-foreground">
                      서명 미리보기
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSignatureModalOpen(true)}
                      className="h-6 text-xs"
                    >
                      편집
                    </Button>
                  </div>
                  <div
                    className="text-xs prose prose-sm max-w-none dark:prose-invert"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: User-managed signature content is safe
                    dangerouslySetInnerHTML={{ __html: currentStep.emailSignature }}
                  />
                  <p className="text-xs text-muted-foreground">
                    이 서명은 이메일 발송 시 본문 하단에 자동으로 추가됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>첨부 파일</Label>
              <div className="rounded-lg border-2 border-dashed p-4 text-center">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id={`file-input-${selectedStepIndex}`}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    updateCurrentStep({ files })
                  }}
                />
                <label
                  htmlFor={`file-input-${selectedStepIndex}`}
                  className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
                >
                  클릭하여 파일 선택
                </label>
                {currentStep?.files && currentStep.files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {currentStep.files.map((file, idx) => (
                      <div
                        key={`file-${file.name}-${idx}`}
                        className="flex items-center justify-between text-xs bg-muted p-2 rounded"
                      >
                        <span>{file.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => {
                            const newFiles = currentStep.files?.filter((_, i) => i !== idx)
                            updateCurrentStep({ files: newFiles })
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* AI Generation Sheet */}
      <Sheet open={showAISheet} onOpenChange={setShowAISheet}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 이메일 생성
            </SheetTitle>
            <SheetDescription>
              AI가 자동으로 이메일을 작성해드립니다. 원하는 내용을 설명해주세요.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>AI 프롬프트</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="예: 신규 고객을 위한 제품 소개 이메일을 작성해주세요. 친근하고 전문적인 톤으로..."
                rows={6}
              />
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">프롬프트 작성 팁</h4>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>이메일의 목적을 명확히 작성하세요</li>
                <li>원하는 톤과 스타일을 지정하세요 (예: 친근한, 공식적인)</li>
                <li>포함하고 싶은 핵심 내용을 나열하세요</li>
                <li>이메일 길이를 지정할 수 있습니다 (예: 짧게, 상세하게)</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleGenerateAI} disabled={isGeneratingAI} className="flex-1">
                {isGeneratingAI ? (
                  "생성 중..."
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    생성하기
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAISheet(false)}>
                취소
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Signature Editor Modal */}
      <SignatureEditorModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        defaultSignature={currentStep?.emailSignature || getUserSignature()}
        onSave={handleSaveSignature}
        workspaceId={data.workspaceId}
        userId={user?.id}
      />
    </div>
  )
}
