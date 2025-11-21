import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useEmailSignatures } from "@/lib/api/hooks/email-signatures"
import { useEmailTemplates } from "@/lib/api/hooks/email-templates"
import { leadsApi } from "@/lib/api/services/leads"
import { sequencesApi } from "@/lib/api/services/sequences"
import { cn } from "@/lib/utils"
import { analyzeLeadsForGroupName } from "@/lib/utils/lead-analyzer"
import { getVariables, MAX_STEPS } from "./constants"
import type { EmailStep } from "./types"

interface ManualModeContentProps {
  steps: EmailStep[]
  selectedStepIndex: number
  onSelectedStepChange: (index: number) => void
  currentStep: EmailStep
  onUpdateStep: (updates: Partial<EmailStep>) => void
  onAddStep: () => void
  onDeleteStep: (index: number) => void
  onSaveStep: () => void

  // Modals
  showAISheet: boolean
  onShowAISheetChange: (show: boolean) => void
  aiPrompt: string
  onAIPromptChange: (prompt: string) => void
  isGeneratingAI: boolean
  setIsGeneratingAI: (isGenerating: boolean) => void

  isSignatureModalOpen: boolean
  onSignatureModalOpenChange: (open: boolean) => void
  onSaveSignature: (signature: string) => void
  onCloseSignature: () => void

  // Schedule editing
  editingScheduleIndex: number | null
  onEditingScheduleIndexChange: (index: number | null) => void

  // Editor ref
  editorRef: React.RefObject<RichTextEditorRef | null>

  // Helpers
  isStepComplete: (step: EmailStep) => boolean
  getUserSignature: () => string
  insertVariable: (variable: string) => void
  handleAdvertisementToggle: (checked: boolean) => void

  // Config
  workspaceId: string
  customerGroupId: string
  userId?: string
  hasDraftSteps: boolean

  // For inline schedule editing
  setSteps: (steps: EmailStep[]) => void
}

export function ManualModeContent({
  steps,
  selectedStepIndex,
  onSelectedStepChange,
  currentStep,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
  onSaveStep,
  showAISheet,
  onShowAISheetChange,
  aiPrompt,
  onAIPromptChange,
  isGeneratingAI,
  setIsGeneratingAI,
  isSignatureModalOpen: _isSignatureModalOpen,
  onSignatureModalOpenChange: _onSignatureModalOpenChange,
  onSaveSignature: _onSaveSignature,
  onCloseSignature: _onCloseSignature,
  editingScheduleIndex,
  onEditingScheduleIndexChange,
  editorRef,
  isStepComplete,
  getUserSignature,
  insertVariable,
  handleAdvertisementToggle,
  workspaceId,
  customerGroupId,
  userId: _userId,
  hasDraftSteps,
  setSteps,
}: ManualModeContentProps) {
  const { t } = useTranslation()

  const [aiCountry, setAiCountry] = useState("Korea") // Detected/selected country for AI
  const [aiGroupInfo, setAiGroupInfo] = useState("") // Auto-detected group info
  const [aiGoal, setAiGoal] = useState("") // Follow-up goal
  const [aiStrategy, setAiStrategy] = useState("") // Tone and manner strategy
  const [showSignaturePreview, setShowSignaturePreview] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [selectedAITemplateId, setSelectedAITemplateId] = useState<string>("none") // Template for AI generation

  // Get all signatures (userId를 전달하여 기본 서명 표시 포함)
  const { data: signatures } = useEmailSignatures(
    {
      includeInactive: false,
      userId: _userId,
    },
    true,
  )

  // Get email templates for the current workspace
  const { data: templatesData } = useEmailTemplates({
    limit: 100,
    workspaceIds: workspaceId ? [workspaceId] : undefined,
  })

  // Reset selected template when step changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset template selection when step changes
  useEffect(() => {
    setSelectedTemplateId("")
  }, [selectedStepIndex])

  // Get current signature ID from step
  const getCurrentSignatureValue = () => {
    // 기본 서명 가져오기
    const defaultSignature = getUserSignature()

    // 서명이 없으면 기본 서명 선택 (기본 서명이 있는 경우)
    if (!currentStep?.emailSignature) {
      // 기본 서명이 서명 목록에 있으면 그 ID 반환, 없으면 "default" 반환
      const defaultSigInList = signatures?.find((sig) => sig.isDefault)
      if (defaultSigInList) {
        return defaultSigInList.id
      }
      return defaultSignature ? "default" : "none"
    }

    // Check if it matches any signature in the list
    const matchedSignature = signatures?.find(
      (sig) => sig.signatureHtml === currentStep.emailSignature,
    )

    if (matchedSignature) {
      return matchedSignature.id
    }

    // Check if it matches the default signature
    if (currentStep.emailSignature === defaultSignature) {
      // 기본 서명이 서명 목록에 있으면 그 ID 반환, 없으면 "default" 반환
      const defaultSigInList = signatures?.find((sig) => sig.isDefault)
      if (defaultSigInList) {
        return defaultSigInList.id
      }
      return "default"
    }

    // Custom signature (not in list)
    return "custom"
  }

  // Handle signature selection
  const handleSignatureChange = (signatureId: string) => {
    if (signatureId === "none") {
      // 서명 제거
      onUpdateStep({ emailSignature: "", emailSignatureId: "" })
    } else if (signatureId === "default") {
      const signatureHtml = getUserSignature()
      // 기본 서명 ID 찾기
      const defaultSigInList = signatures?.find((sig) => sig.isDefault)
      onUpdateStep({
        emailSignature: signatureHtml,
        emailSignatureId: defaultSigInList?.id || "default",
      })
    } else {
      const selectedSignature = signatures?.find((sig) => sig.id === signatureId)
      if (selectedSignature) {
        onUpdateStep({
          emailSignature: selectedSignature.signatureHtml,
          emailSignatureId: signatureId,
        })
      }
    }
  }

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId)
    const template = templatesData?.emailTemplates.find((t) => t.id === templateId)
    if (template) {
      onUpdateStep({
        emailSubject: template.subject,
        emailBodyText: template.bodyText || "",
      })
      toast.success("템플릿이 적용되었습니다")
    }
  }

  const handleGenerateAI = async () => {
    // Build structured prompt from all fields
    const promptParts = []

    // Group info (required)
    if (aiGroupInfo.trim()) {
      promptParts.push(`[타겟 고객]: ${aiGroupInfo.trim()}`)
    }

    // Goal (required)
    if (aiGoal.trim()) {
      promptParts.push(`[목표]: ${aiGoal.trim()}`)
    }

    // Strategy (required)
    if (aiStrategy.trim()) {
      promptParts.push(`[전략]: ${aiStrategy.trim()}`)
    }

    // Template reference (if selected)
    if (selectedAITemplateId && selectedAITemplateId !== "none") {
      const selectedTemplate = templatesData?.emailTemplates.find(
        (t) => t.id === selectedAITemplateId,
      )
      if (selectedTemplate) {
        // Extract text from HTML if needed
        const bodyText = selectedTemplate.bodyText || ""
        const bodyHtml = selectedTemplate.bodyHtml || ""
        const templateBody = bodyText || (bodyHtml ? bodyHtml.replace(/<[^>]*>/g, "").trim() : "")

        promptParts.push(
          `[참고 템플릿 - 반드시 이 템플릿의 구조와 스타일을 따라주세요]:\n템플릿명: ${selectedTemplate.name}\n${selectedTemplate.description ? `설명: ${selectedTemplate.description}\n` : ""}제목 예시: ${selectedTemplate.subject}\n본문 예시:\n${templateBody}\n\n**중요 지시사항:**\n1. 위 템플릿의 구조(인사말, 본문 흐름, 마무리 등)를 그대로 따라주세요\n2. 템플릿의 톤과 스타일(공식적/비공식적, 길이, 문체 등)을 유지해주세요\n3. 템플릿에서 사용된 변수 형식({{회사명}}, {{담당자명}} 등)을 동일하게 사용해주세요\n4. 템플릿의 전체적인 흐름과 문단 구성을 참고하여 작성해주세요`,
        )
      }
    }

    // Additional instructions (optional)
    if (aiPrompt.trim()) {
      promptParts.push(`[추가 지시사항]: ${aiPrompt.trim()}`)
    }

    const finalPrompt = promptParts.join("\n\n")

    // Validate: at least group info, goal, strategy, or template must be provided
    if (
      !aiGroupInfo.trim() &&
      !aiGoal.trim() &&
      !aiStrategy.trim() &&
      (!selectedAITemplateId || selectedAITemplateId === "none")
    ) {
      toast.error("최소한 그룹 정보, 목표, 전략, 또는 템플릿 중 하나를 입력/선택해주세요")
      return
    }

    // Validate prompt length (minimum 10 characters required by backend)
    if (finalPrompt.length < 10) {
      toast.error("입력 내용이 너무 짧습니다. 더 자세히 입력해주세요")
      return
    }

    setIsGeneratingAI(true)
    try {
      // Call actual AI API with selected country
      const result = await sequencesApi.generateTemplate({
        workspaceId: workspaceId,
        country: aiCountry,
        prompt: finalPrompt,
        temperature: 0.7,
      })

      // Update current step with AI generated content
      onUpdateStep({
        emailSubject: result.emailSubject,
        emailBodyText: result.emailBodyText,
      })

      toast.success(t("sequences.step2.aiEmailGenerated"))
      onShowAISheetChange(false)
      // Don't clear the fields so user can regenerate with modifications
    } catch (error) {
      console.error("AI generation error:", error)
      toast.error(
        `AI 이메일 생성 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
      )
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const handleOpenAISheet = async () => {
    onShowAISheetChange(true)
    setSelectedAITemplateId("none") // Reset template selection when opening AI sheet

    // Detect country and group info from customer group leads when opening the sheet
    try {
      const leadsResult = await leadsApi.list({
        customerGroupId: customerGroupId,
        page: 1,
        limit: 100, // Fetch up to 100 leads for analysis
      })

      if (leadsResult.leads.length > 0) {
        const analysis = analyzeLeadsForGroupName(leadsResult.leads)
        console.log("analysis", analysis)

        // Set country
        if (analysis.country && analysis.country !== "Unknown") {
          setAiCountry(analysis.country)
        }

        // Generate group info summary
        const groupInfoParts = []
        if (analysis.country && analysis.country !== "Unknown") {
          groupInfoParts.push(`국가: ${analysis.country}`)
        }
        if (analysis.scale && analysis.scale !== "Unknown") {
          groupInfoParts.push(`기업 규모: ${analysis.scale}`)
        }
        if (analysis.businessType && analysis.businessType !== "Unknown") {
          groupInfoParts.push(`비즈니스 타입: ${analysis.businessType}`)
        }
        if (analysis.businessSector && analysis.businessSector !== "Unknown") {
          groupInfoParts.push(`업종: ${analysis.businessSector}`)
        }

        const groupInfo = groupInfoParts.join(", ")
        setAiGroupInfo(groupInfo || "타겟 고객 정보를 입력하세요")

        // Set default goal based on step
        const stepNumber = currentStep?.stepOrder || 1
        if (stepNumber === 1) {
          setAiGoal("첫 접촉 및 관심 유도")
        } else if (stepNumber === 2) {
          setAiGoal("후속 팔로업 및 가치 제안")
        } else if (stepNumber === 3) {
          setAiGoal("미팅 제안 또는 행동 유도")
        } else {
          setAiGoal("최종 팔로업 및 클로징")
        }

        // Set default strategy
        setAiStrategy("전문적이고 친근한 톤, 간결하고 명확한 메시지")
      }
    } catch (error) {
      console.warn("Failed to detect country from leads:", error)
      // Set minimal defaults even on error
      setAiGroupInfo("타겟 고객 정보를 입력하세요")
      setAiGoal("팔로업 목표를 입력하세요")
      setAiStrategy("톤앤매너를 입력하세요")
    }
  }

  return (
    <div className="flex-1 flex gap-6 overflow-hidden">
      {/* Left Panel - Steps List (30%) */}
      <div className="w-[30%] flex flex-col gap-4 border-r pr-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{t("sequences.manualMode.emailSteps")}</h3>
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
                    <strong>{t("sequences.manualMode.howItWorks")}</strong>{" "}
                    {t("sequences.manualMode.howItWorksDesc")}
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
                  onClick={onAddStep}
                  disabled={steps.length >= MAX_STEPS}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("sequences.manualMode.add")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("sequences.manualMode.addNewStep", { max: MAX_STEPS })}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {hasDraftSteps && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-900 dark:text-amber-200">
              {t("sequences.manualMode.draftStepsWarning")}
            </p>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="space-y-2 pr-2">
            {steps.map((step, index) => (
              // biome-ignore lint/a11y/useSemanticElements: Cannot use button element because it contains nested interactive elements (buttons)
              <div
                key={`step-${step.stepOrder}-${index}`}
                role="button"
                tabIndex={0}
                className={cn(
                  "w-full rounded-lg border p-3 cursor-pointer transition-all text-left",
                  selectedStepIndex === index
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "hover:bg-muted/50",
                )}
                onClick={() => onSelectedStepChange(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelectedStepChange(index)
                  }
                }}
              >
                {/* Schedule info above step - Inline editable */}
                <div className="mb-2 pb-2 border-b">
                  {editingScheduleIndex === index ? (
                    // 인라인 편집 모드
                    // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation is needed to prevent parent click
                    <div
                      className="space-y-2 p-2 bg-muted/50 rounded"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation()
                        }
                      }}
                    >
                      {index === 0 ? (
                        // First step: Absolute date selection
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("sequences.manualMode.sendDate")}</Label>
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
                                    ? t("sequences.manualMode.today")
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
                            <Label className="text-xs">{t("sequences.manualMode.sendTime")}</Label>
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
                        // Remaining steps: Relative date (days later)
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs w-16">
                              {t("sequences.manualMode.waitDays")}
                            </Label>
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
                            <span className="text-xs">{t("sequences.manualMode.daysLater")}</span>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("sequences.manualMode.sendTime")}</Label>
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
                            onEditingScheduleIndexChange(null)
                            toast.success(t("sequences.manualMode.scheduleSaved"))
                          }}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {t("sequences.manualMode.save")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditingScheduleIndexChange(null)
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
                        onEditingScheduleIndexChange(index)
                      }}
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {index === 0 ? (
                        // First step: Absolute date display
                        <span>
                          {step.delayDays === 0
                            ? t("sequences.manualMode.today")
                            : format(
                                new Date(Date.now() + step.delayDays * 24 * 60 * 60 * 1000),
                                "MM월 dd일",
                                { locale: ko },
                              )}
                        </span>
                      ) : (
                        // Remaining steps: Relative date display
                        <span>
                          {step.delayDays === 0
                            ? t("sequences.step3.sendImmediately")
                            : t("sequences.step3.daysLater", { days: step.delayDays })}
                        </span>
                      )}
                      <Clock className="h-3 w-3 ml-1" />
                      <span>
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("sequences.manualMode.edit")}
                      </span>
                    </Button>
                  )}
                </div>

                {/* Step content */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">
                        {t("sequences.manualMode.step", { order: step.stepOrder })}
                      </span>
                      {isStepComplete(step) ? (
                        <Badge
                          variant="default"
                          className="text-xs px-2 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          {t("sequences.manualMode.completed")}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        >
                          {t("sequences.manualMode.drafting")}
                        </Badge>
                      )}
                    </div>
                    {step.emailSubject ? (
                      <p className="text-sm font-medium truncate">{step.emailSubject}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t("sequences.manualMode.noSubject")}
                      </p>
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
                              onDeleteStep(index)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("sequences.manualMode.deleteStep")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
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
            <Button variant="outline" size="sm" onClick={handleOpenAISheet} className="h-9">
              <Sparkles className="h-4 w-4 mr-2" />
              AI 생성
            </Button>
            <Button onClick={onSaveStep} size="sm" className="h-9">
              <Check className="h-4 w-4 mr-2" />
              저장
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label>템플릿에서 불러오기</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="템플릿 선택 (선택사항)" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {templatesData?.emailTemplates && templatesData.emailTemplates.length > 0 ? (
                    templatesData.emailTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{template.name}</span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-templates" disabled>
                      등록된 템플릿이 없습니다
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                💡 기존 템플릿을 선택하면 제목과 본문이 자동으로 입력됩니다
              </p>
            </div>

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
                onChange={(e) => onUpdateStep({ emailSubject: e.target.value })}
                placeholder="예: 안녕하세요, {{회사명}} 담당자님"
              />
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label>변수 삽입</Label>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border bg-muted/30">
                {getVariables(t).map((variable) => (
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
              <Label>이메일 본문 *</Label>
              <RichTextEditor
                ref={editorRef}
                value={currentStep?.emailBodyText || ""}
                onChange={(value) => onUpdateStep({ emailBodyText: value })}
                placeholder="이메일 내용을 입력하세요..."
                height="300px"
              />

              {/* 서명 선택 및 미리보기 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">서명 선택</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSignaturePreview(!showSignaturePreview)}
                    className="h-7 text-xs"
                  >
                    {showSignaturePreview ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        미리보기 숨기기
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        미리보기 보기
                      </>
                    )}
                  </Button>
                </div>
                {/* 서명 포함 여부 체크박스 */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`include-signature-${currentStep?.stepOrder || 0}`}
                    checked={currentStep?.includeSignature !== false} // 기본값: true
                    onCheckedChange={(checked) =>
                      onUpdateStep({ includeSignature: checked as boolean })
                    }
                  />
                  <Label
                    htmlFor={`include-signature-${currentStep?.stepOrder || 0}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    이메일에 서명 추가
                  </Label>
                </div>
                <Select value={getCurrentSignatureValue()} onValueChange={handleSignatureChange}>
                  <SelectTrigger className="relative h-auto min-h-9 py-1.5">
                    {(() => {
                      const value = getCurrentSignatureValue()
                      const selected = signatures?.find((sig) => sig.id === value)

                      if (value === "none") {
                        return <SelectValue placeholder="서명 없음" />
                      }
                      if (value === "default") {
                        return <SelectValue placeholder="기본 서명" />
                      }
                      if (value === "custom") {
                        return <SelectValue placeholder="사용자 정의 서명" />
                      }
                      if (selected) {
                        return <SelectValue className="sr-only" placeholder={selected.name} />
                      }
                      return <SelectValue placeholder="서명을 선택하세요" />
                    })()}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">서명 없음</SelectItem>
                    <SelectItem value="default">기본 서명</SelectItem>
                    {signatures?.map((signature) => {
                      const displayText = `${signature.name}${signature.workspaceName ? ` (${signature.workspaceName}${signature.userName ? ` • ${signature.userName}` : ""})` : ""}`
                      return (
                        <SelectItem key={signature.id} value={signature.id} textValue={displayText}>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{signature.name}</span>
                              {signature.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  기본
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {signature.workspaceName && (
                                <span className="flex items-center gap-1">
                                  <span>{signature.workspaceName}</span>
                                </span>
                              )}
                              {signature.userName && (
                                <>
                                  {signature.workspaceName && <span>•</span>}
                                  <span>{signature.userName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>

                {/* 서명 미리보기 (토글형) */}
                {showSignaturePreview &&
                  (() => {
                    // 표시할 서명 HTML 가져오기
                    const signatureToShow =
                      currentStep?.emailSignature ||
                      (() => {
                        const currentValue = getCurrentSignatureValue()
                        if (currentValue === "none") return null
                        if (currentValue === "default") return getUserSignature()
                        const selectedSig = signatures?.find((sig) => sig.id === currentValue)
                        return selectedSig?.signatureHtml || getUserSignature()
                      })()

                    return signatureToShow ? (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          서명 미리보기
                        </Label>
                        <div
                          className="text-xs prose prose-sm max-w-none dark:prose-invert"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: User-managed signature content is safe
                          dangerouslySetInnerHTML={{ __html: signatureToShow }}
                        />
                        <p className="text-xs text-muted-foreground">
                          이 서명은 이메일 발송 시 본문 하단에 자동으로 추가됩니다.
                        </p>
                      </div>
                    ) : null
                  })()}
              </div>
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
                    onUpdateStep({ files })
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
                            onUpdateStep({ files: newFiles })
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
      <Sheet open={showAISheet} onOpenChange={onShowAISheetChange}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 이메일 생성
            </SheetTitle>
            <SheetDescription>
              AI가 자동으로 이메일을 작성해드립니다. 원하는 내용을 설명해주세요.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 mt-6 pr-4">
            <div className="space-y-4">
              {/* Template Selection for AI */}
              <div className="space-y-2">
                <Label>템플릿 참고 (선택)</Label>
                <Select value={selectedAITemplateId} onValueChange={setSelectedAITemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="템플릿 선택 (선택사항)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="none">템플릿 없이 생성</SelectItem>
                    {templatesData?.emailTemplates && templatesData.emailTemplates.length > 0 ? (
                      templatesData.emailTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{template.name}</span>
                            {template.description && (
                              <span className="text-xs text-muted-foreground">
                                {template.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-templates" disabled>
                        등록된 템플릿이 없습니다
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  💡 템플릿을 선택하면 AI가 해당 템플릿의 스타일과 구조를 참고하여 이메일을
                  생성합니다
                </p>

                {/* Template Preview */}
                {selectedAITemplateId && selectedAITemplateId !== "none" && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        선택한 템플릿 미리보기
                      </h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedAITemplateId("none")}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {(() => {
                      const selectedTemplate = templatesData?.emailTemplates.find(
                        (t) => t.id === selectedAITemplateId,
                      )
                      if (!selectedTemplate) return null

                      return (
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium text-muted-foreground">템플릿명:</span>{" "}
                            <span className="font-semibold">{selectedTemplate.name}</span>
                          </div>
                          {selectedTemplate.description && (
                            <div>
                              <span className="font-medium text-muted-foreground">설명:</span>{" "}
                              <span>{selectedTemplate.description}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 space-y-2">
                            <div>
                              <span className="font-medium text-muted-foreground">제목:</span>
                              <div className="mt-1 p-2 bg-background rounded border text-xs">
                                {selectedTemplate.subject}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">본문:</span>
                              <div className="mt-1 p-2 bg-background rounded border text-xs max-h-[200px] overflow-y-auto">
                                {selectedTemplate.bodyHtml ? (
                                  <div
                                    className="prose prose-sm max-w-none dark:prose-invert"
                                    // biome-ignore lint/security/noDangerouslySetInnerHtml: Template preview is safe
                                    dangerouslySetInnerHTML={{ __html: selectedTemplate.bodyHtml }}
                                  />
                                ) : (
                                  <pre className="whitespace-pre-wrap font-sans">
                                    {selectedTemplate.bodyText || "(본문 없음)"}
                                  </pre>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground pt-2 border-t">
                            💡 AI가 위 템플릿의 구조, 톤, 스타일을 참고하여 새로운 이메일을
                            생성합니다
                          </p>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Auto-detected Group Info */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 space-y-2">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-600" />
                  타겟 고객 그룹 정보 (자동 감지)
                </h4>
                <Input
                  value={aiGroupInfo}
                  onChange={(e) => setAiGroupInfo(e.target.value)}
                  placeholder="타겟 고객 정보를 입력하세요"
                  className="bg-white dark:bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  고객 리드 데이터를 기반으로 자동 감지됩니다. 필요시 수정 가능합니다.
                </p>
              </div>

              {/* Target Country */}
              <div className="space-y-2">
                <Label>타겟 국가</Label>
                <Input
                  value={aiCountry}
                  onChange={(e) => setAiCountry(e.target.value)}
                  placeholder="예: Korea, Japan, China"
                />
              </div>

              {/* Follow-up Goal */}
              <div className="space-y-2">
                <Label>팔로업 목표</Label>
                <Input
                  value={aiGoal}
                  onChange={(e) => setAiGoal(e.target.value)}
                  placeholder="예: 미팅 성사, 데모 요청, 자료 다운로드 유도"
                />
                <p className="text-xs text-muted-foreground">
                  이 이메일을 통해 달성하고자 하는 목표를 입력하세요
                </p>
              </div>

              {/* Template Strategy (Tone & Manner) */}
              <div className="space-y-2">
                <Label>템플릿 전략 (톤앤매너)</Label>
                <Input
                  value={aiStrategy}
                  onChange={(e) => setAiStrategy(e.target.value)}
                  placeholder="예: 전문적이고 친근한 톤, 간결하고 명확한 메시지"
                />
                <p className="text-xs text-muted-foreground">
                  이메일의 톤, 스타일, 길이 등을 지정하세요
                </p>
              </div>

              {/* AI Prompt (Optional Additional Instructions) */}
              <div className="space-y-2">
                <Label>추가 지시사항 (선택)</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => onAIPromptChange(e.target.value)}
                  placeholder="예: 최근 출시한 신제품에 대한 소개를 포함하고, 기존 고객 성공 사례를 언급해주세요..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  추가로 포함하고 싶은 내용이나 특별한 지시사항을 입력하세요
                </p>
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <h4 className="font-medium text-sm">💡 작성 가이드</h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>
                    <strong>템플릿 참고</strong>: 기존 템플릿의 스타일과 구조를 참고하여 생성
                    (선택사항)
                  </li>
                  <li>
                    <strong>그룹 정보</strong>: 타겟 고객의 특성 (자동 감지, 수정 가능)
                  </li>
                  <li>
                    <strong>목표</strong>: 이메일을 통해 달성하고자 하는 구체적인 행동
                  </li>
                  <li>
                    <strong>전략</strong>: 톤, 메시지 스타일, 길이 등의 방향성
                  </li>
                  <li>
                    <strong>추가 지시사항</strong>: 포함할 특정 내용이나 예시
                  </li>
                </ul>
              </div>
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-4 border-t mt-auto">
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
            <Button variant="outline" onClick={() => onShowAISheetChange(false)}>
              취소
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
