import {
  AlertCircle,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Mail,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { SignatureEditorModal } from "@/components/SignatureEditorModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
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
  const [showVariables, setShowVariables] = useState(false)
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)

  // Current editing step
  const currentStep = steps[selectedStepIndex]

  // Update steps when data.steps changes (e.g., when loading existing campaign)
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally use specific properties to avoid infinite loops
  useEffect(() => {
    console.log("📥 Step2 - Received steps from parent:", data.steps)
    if (data.steps.length > 0) {
      const currentStepsStr = JSON.stringify(
        steps.map((s) => ({ id: s.id, subject: s.emailSubject })),
      )
      const newStepsStr = JSON.stringify(
        data.steps.map((s) => ({ id: s.id, subject: s.emailSubject })),
      )
      if (currentStepsStr !== newStepsStr) {
        console.log("🔄 Step2 - Updating steps from data prop")
        setSteps(data.steps)
      }
    }
  }, [data.steps, steps])

  // DB에서 서명이 로드되면 초기 서명 설정 (새 스텝 생성 시에만)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Only run when signature loads, not when steps change
  useEffect(() => {
    if (steps.length > 0 && !steps[0].emailBodyText && defaultSignature && steps[0].isDraft) {
      const signature = defaultSignature.signatureHtml
      const updatedSteps = [...steps]
      updatedSteps[0] = {
        ...updatedSteps[0],
        emailBodyText: `\n\n${signature}`,
      }
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
        const stepData = {
          stepOrder: currentStep.stepOrder,
          delayDays: currentStep.delayDays,
          scheduledHour: currentStep.scheduledHour,
          scheduledMinute: currentStep.scheduledMinute,
          emailSubject: currentStep.emailSubject,
          emailBodyText: currentStep.emailBodyText,
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
    // Insert at cursor position or at end
    updateCurrentStep({
      emailBodyText: currentStep.emailBodyText + variable,
    })
    setShowVariables(false)
  }

  const handleSaveSignature = (signature: string) => {
    // 기존 본문에서 서명 부분을 제거하고 새 서명 추가
    let bodyWithoutSignature = currentStep.emailBodyText || ""

    // 기존 서명 패턴 제거 (여러 가능한 구분자)
    const signatureSeparators = [
      /\n\n--\n[\s\S]*$/,
      /\n\n---\n[\s\S]*$/,
      /<div dir="ltr">[\s\S]*<\/div>\s*$/,
    ]

    for (const separator of signatureSeparators) {
      bodyWithoutSignature = bodyWithoutSignature.replace(separator, "")
    }

    updateCurrentStep({
      emailBodyText: `${bodyWithoutSignature.trim()}\n\n${signature}`,
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
                {/* Schedule info above step - Now editable */}
                <div className="mb-2 pb-2 border-b">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start gap-2 h-auto p-1 text-xs text-muted-foreground hover:text-foreground group"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                      >
                        <Calendar className="h-3 w-3" />
                        <span>{step.delayDays === 0 ? "즉시 발송" : `${step.delayDays}일 후`}</span>
                        <Clock className="h-3 w-3 ml-1" />
                        <span>
                          {String(step.scheduledHour).padStart(2, "0")}:
                          {String(step.scheduledMinute).padStart(2, "0")}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          수정
                        </span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>스텝 {step.stepOrder} 스케줄 설정</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>발송 대기 일수</Label>
                          <Input
                            type="number"
                            min="0"
                            value={step.delayDays}
                            onChange={(e) => {
                              const updatedSteps = [...steps]
                              updatedSteps[index].delayDays = parseInt(e.target.value, 10) || 0
                              setSteps(updatedSteps)
                            }}
                            disabled={index === 0}
                          />
                          {index === 0 && (
                            <p className="text-xs text-muted-foreground">
                              첫 번째 스텝은 즉시 발송됩니다
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>발송 시간</Label>
                          <div className="flex gap-2 items-center">
                            <Input
                              type="number"
                              min="0"
                              max="23"
                              value={step.scheduledHour}
                              onChange={(e) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].scheduledHour =
                                  parseInt(e.target.value, 10) || 0
                                setSteps(updatedSteps)
                              }}
                              className="w-20"
                            />
                            <span>:</span>
                            <Input
                              type="number"
                              min="0"
                              max="59"
                              step="5"
                              value={step.scheduledMinute}
                              onChange={(e) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].scheduledMinute =
                                  parseInt(e.target.value, 10) || 0
                                setSteps(updatedSteps)
                              }}
                              className="w-20"
                            />
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
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
              <div className="flex items-center justify-between">
                <Label>변수 삽입</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVariables(!showVariables)}
                  className="h-7"
                >
                  {showVariables ? (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      접기
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3 w-3 mr-1" />
                      펼치기
                    </>
                  )}
                </Button>
              </div>
              {showVariables && (
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
              )}
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
                value={currentStep?.emailBodyText || ""}
                onChange={(value) => updateCurrentStep({ emailBodyText: value })}
                placeholder={`이메일 내용을 입력하세요...\n\n--\n${getUserSignature()}`}
                height="300px"
              />
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
        defaultSignature={getUserSignature()}
        onSave={handleSaveSignature}
        workspaceId={data.workspaceId}
        userId={user?.id}
      />
    </div>
  )
}
