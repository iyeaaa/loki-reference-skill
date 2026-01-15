import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  Clock,
  FileSignature,
  Info,
  Paperclip,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

type ManualModeContentProps = {
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
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [applyTemplateToAllSteps, setApplyTemplateToAllSteps] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [selectedAITemplateId, setSelectedAITemplateId] = useState<string>("none") // Template for AI generation
  const [variableInsertTarget, setVariableInsertTarget] = useState<"subject" | "body">("body")
  const subjectInputRef = useRef<HTMLInputElement>(null)

  // Get all signatures for workspace (워크스페이스별 서명 조회)
  const isValidWorkspace = !!(workspaceId && workspaceId !== "all")
  const { data: signatures } = useEmailSignatures(
    {
      workspaceId,
      includeInactive: false,
    },
    isValidWorkspace,
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

  const insertIntoSubject = (text: string) => {
    const input = subjectInputRef.current
    const current = currentStep?.emailSubject || ""

    if (!input) {
      onUpdateStep({ emailSubject: `${current}${text}` })
      return
    }

    const start = input.selectionStart ?? current.length
    const end = input.selectionEnd ?? current.length
    const next = current.slice(0, start) + text + current.slice(end)
    onUpdateStep({ emailSubject: next })

    setTimeout(() => {
      try {
        input.focus()
        const pos = start + text.length
        input.setSelectionRange(pos, pos)
      } catch {
        // ignore
      }
    }, 0)
  }

  const handleInsertVariable = (value: string) => {
    if (variableInsertTarget === "subject") {
      insertIntoSubject(value)
      return
    }
    insertVariable(value)
  }

  // currentStep이 변경될 때 서명이 없으면 기본 서명 자동 설정
  useEffect(() => {
    if (!currentStep) {
      return
    }

    const defaultSignature = getUserSignature()
    const defaultSigInList = signatures?.find((sig) => sig.isDefault)

    // 서명이 없고 기본 서명이 있으면 자동으로 설정
    if (!currentStep.emailSignature && defaultSignature) {
      console.log("[DEBUG] Auto-setting default signature for currentStep:", {
        stepOrder: currentStep.stepOrder,
        hasDefaultSignature: !!defaultSignature,
        defaultSigId: defaultSigInList?.id || "default",
      })

      // markdownToHtml을 사용하여 emailBodyHtml 생성
      import("@/lib/utils/markdown").then(({ markdownToHtml }) => {
        const currentBodyText = currentStep.emailBodyText || ""
        const bodyHtmlFromMarkdown = markdownToHtml(currentBodyText)
        const emailBodyHtml = `${bodyHtmlFromMarkdown}\n\n${defaultSignature}`

        onUpdateStep({
          emailSignature: defaultSignature,
          emailSignatureId: defaultSigInList?.id || "default",
          includeSignature: true,
          emailBodyHtml,
        })
      })
    }
  }, [currentStep, signatures, getUserSignature, onUpdateStep])

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

  const signatureHtmlForPreview = (() => {
    const currentValue = getCurrentSignatureValue()
    if (currentValue === "none") {
      return null
    }
    if (currentValue === "default") {
      return getUserSignature()
    }
    const selectedSig = signatures?.find((sig) => sig.id === currentValue)
    return selectedSig?.signatureHtml || getUserSignature()
  })()

  // Handle signature selection
  const handleSignatureChange = async (signatureId: string) => {
    console.log("[DEBUG] handleSignatureChange called:", {
      signatureId,
      currentStep,
      hasCurrentStep: !!currentStep,
      currentStepEmailSignature: currentStep?.emailSignature,
      currentStepEmailSignatureId: currentStep?.emailSignatureId,
    })

    // markdownToHtml을 사용하여 emailBodyHtml 생성
    const { markdownToHtml } = await import("@/lib/utils/markdown")
    const currentBodyText = currentStep?.emailBodyText || ""
    const bodyHtmlFromMarkdown = markdownToHtml(currentBodyText)

    if (signatureId === "none") {
      // 서명 제거
      const updateData = {
        emailSignature: "",
        emailSignatureId: "",
        includeSignature: false,
        emailBodyHtml: bodyHtmlFromMarkdown, // 서명 없는 HTML
      }
      console.log("[DEBUG] Removing signature, calling onUpdateStep with:", updateData)
      onUpdateStep(updateData)
    } else if (signatureId === "default") {
      const signatureHtml = getUserSignature()
      // 기본 서명 ID 찾기
      const defaultSigInList = signatures?.find((sig) => sig.isDefault)
      // emailBodyHtml에 서명 추가
      const emailBodyHtml = `${bodyHtmlFromMarkdown}\n\n${signatureHtml}`
      const updateData = {
        emailSignature: signatureHtml,
        emailSignatureId: defaultSigInList?.id || "default",
        includeSignature: true,
        emailBodyHtml, // 서명이 포함된 HTML
      }
      console.log("[DEBUG] Setting default signature, calling onUpdateStep with:", {
        ...updateData,
        signatureHtmlPreview: signatureHtml.substring(0, 100),
        emailBodyHtmlLength: emailBodyHtml.length,
      })
      onUpdateStep(updateData)
    } else {
      const selectedSignature = signatures?.find((sig) => sig.id === signatureId)
      if (selectedSignature) {
        // emailBodyHtml에 서명 추가
        const emailBodyHtml = `${bodyHtmlFromMarkdown}\n\n${selectedSignature.signatureHtml}`
        const updateData = {
          emailSignature: selectedSignature.signatureHtml,
          emailSignatureId: signatureId,
          includeSignature: true,
          emailBodyHtml, // 서명이 포함된 HTML
        }
        console.log("[DEBUG] Setting selected signature, calling onUpdateStep with:", {
          ...updateData,
          signatureHtmlPreview: selectedSignature.signatureHtml.substring(0, 100),
          emailBodyHtmlLength: emailBodyHtml.length,
        })
        onUpdateStep(updateData)
      } else {
        console.warn("[DEBUG] Signature not found:", signatureId)
      }
    }

    // 업데이트 후 확인
    setTimeout(() => {
      console.log("[DEBUG] After handleSignatureChange, currentStep:", {
        emailSignature: currentStep?.emailSignature,
        emailSignatureId: currentStep?.emailSignatureId,
        includeSignature: currentStep?.includeSignature,
        emailBodyHtml: currentStep?.emailBodyHtml,
      })
    }, 100)
  }

  // Handle template selection
  const handleTemplateSelect = (templateId: string, options?: { applyToAllSteps?: boolean }) => {
    setSelectedTemplateId(templateId)
    const template = templatesData?.emailTemplates.find((t) => t.id === templateId)
    if (template) {
      const applyToAll = options?.applyToAllSteps ?? false

      if (applyToAll) {
        const nextSteps = steps.map((step) => ({
          ...step,
          emailSubject: template.subject,
          emailBodyText: template.bodyText || "",
          // 템플릿 적용 후에는 저장 필요 상태로 간주
          isDraft: true,
        }))
        setSteps(nextSteps)
        toast.success("템플릿이 모든 스텝에 적용되었습니다")
        return
      }

      onUpdateStep({
        emailSubject: template.subject,
        emailBodyText: template.bodyText || "",
        isDraft: true,
      })
      toast.success("템플릿이 현재 스텝에 적용되었습니다")
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
      !(aiGroupInfo.trim() || aiGoal.trim() || aiStrategy.trim()) &&
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
        workspaceId,
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
        customerGroupId,
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
    <div className="flex h-full min-h-0 flex-1 gap-6 overflow-hidden">
      {/* Left Panel - Steps List */}
      <div className="flex min-h-0 w-[420px] flex-shrink-0 flex-col gap-4 overflow-hidden border-r pr-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{t("sequences.manualMode.emailSteps")}</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    type="button"
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
                  className="h-8"
                  disabled={steps.length >= MAX_STEPS}
                  onClick={onAddStep}
                  size="sm"
                >
                  <Plus className="mr-1 h-4 w-4" />
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
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-amber-900 text-xs dark:text-amber-200">
              {t("sequences.manualMode.draftStepsWarning")}
            </p>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 pr-2">
            {steps.map((step, index) => (
              // biome-ignore lint/a11y/useSemanticElements: Cannot use button element because it contains nested interactive elements (buttons)
              <div
                className={cn(
                  "w-full cursor-pointer rounded-lg border p-3 text-left transition-all",
                  selectedStepIndex === index
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "hover:bg-muted/50",
                )}
                key={`step-${step.stepOrder}-${index}`}
                onClick={() => onSelectedStepChange(index)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelectedStepChange(index)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                {/* Schedule info above step - Inline editable */}
                <div className="mb-2 border-b pb-2">
                  {editingScheduleIndex === index ? (
                    // 인라인 편집 모드
                    // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation is needed to prevent parent click
                    <div
                      className="space-y-2 rounded bg-muted/50 p-2"
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
                                  className={cn(
                                    "h-7 w-full justify-start text-left font-normal text-xs",
                                    !step.delayDays && "text-muted-foreground",
                                  )}
                                  variant="outline"
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
                              <PopoverContent align="start" className="w-auto p-0">
                                <Calendar
                                  disabled={(date) =>
                                    date < new Date(new Date().setHours(0, 0, 0, 0))
                                  }
                                  initialFocus
                                  mode="single"
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
                                  selected={
                                    new Date(Date.now() + step.delayDays * 24 * 60 * 60 * 1000)
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("sequences.manualMode.sendTime")}</Label>
                            <TimePicker
                              onChange={(time) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].scheduledHour = time.hour
                                updatedSteps[index].scheduledMinute = time.minute
                                setSteps(updatedSteps)
                              }}
                              value={{
                                hour: step.scheduledHour ?? 9,
                                minute: step.scheduledMinute ?? 0,
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        // Remaining steps: Relative date (days later)
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="w-16 text-xs">
                              {t("sequences.manualMode.waitDays")}
                            </Label>
                            <Input
                              className="h-7 w-16 text-xs"
                              min="1"
                              onChange={(e) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].delayDays =
                                  Number.parseInt(e.target.value, 10) || 1
                                setSteps(updatedSteps)
                              }}
                              type="number"
                              value={step.delayDays}
                            />
                            <span className="text-xs">{t("sequences.manualMode.daysLater")}</span>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">{t("sequences.manualMode.sendTime")}</Label>
                            <TimePicker
                              onChange={(time) => {
                                const updatedSteps = [...steps]
                                updatedSteps[index].scheduledHour = time.hour
                                updatedSteps[index].scheduledMinute = time.minute
                                setSteps(updatedSteps)
                              }}
                              value={{
                                hour: step.scheduledHour ?? 9,
                                minute: step.scheduledMinute ?? 0,
                              }}
                            />
                          </div>
                        </>
                      )}
                      <div className="flex justify-end gap-1">
                        <Button
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditingScheduleIndexChange(null)
                            toast.success(t("sequences.manualMode.scheduleSaved"))
                          }}
                          size="sm"
                          variant="default"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          {t("sequences.manualMode.save")}
                        </Button>
                        <Button
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditingScheduleIndexChange(null)
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 보기 모드
                    <Button
                      className="group h-auto w-full justify-start gap-2 p-1 text-muted-foreground text-xs hover:text-foreground"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation()
                        onEditingScheduleIndexChange(index)
                      }}
                      variant="ghost"
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
                      <Clock className="ml-1 h-3 w-3" />
                      <span>
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </span>
                      <span className="ml-auto text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        {t("sequences.manualMode.edit")}
                      </span>
                    </Button>
                  )}
                </div>

                {/* Step content */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {t("sequences.manualMode.step", { order: step.stepOrder })}
                      </span>
                      {isStepComplete(step) ? (
                        <Badge
                          className="bg-green-100 px-2 py-0 text-green-700 text-xs dark:bg-green-900/30 dark:text-green-300"
                          variant="default"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          {t("sequences.manualMode.completed")}
                        </Badge>
                      ) : (
                        <Badge
                          className="bg-amber-100 px-2 py-0 text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-300"
                          variant="secondary"
                        >
                          {t("sequences.manualMode.drafting")}
                        </Badge>
                      )}
                    </div>
                    {step.emailSubject ? (
                      <p className="line-clamp-2 break-words font-medium text-sm">
                        {step.emailSubject}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm italic">
                        {t("sequences.manualMode.noSubject")}
                      </p>
                    )}
                  </div>

                  {index > 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="h-7 w-7 flex-shrink-0 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              onDeleteStep(index)
                            }}
                            size="sm"
                            variant="ghost"
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

      {/* Right Panel - Email Editor (65%) */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-shrink-0 items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">스텝 {currentStep?.stepOrder} 편집</h3>
            <p className="text-muted-foreground text-sm">이메일 내용을 작성하세요</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog onOpenChange={setIsTemplateDialogOpen} open={isTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-8" size="sm" type="button" variant="outline">
                  템플릿 적용
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>템플릿 적용</DialogTitle>
                  <DialogDescription>선택한 템플릿이 제목과 본문에 적용됩니다.</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                    <Label className="cursor-pointer text-sm" htmlFor="apply-template-all-steps">
                      모든 스텝에 일괄 적용
                    </Label>
                    <Checkbox
                      checked={applyTemplateToAllSteps}
                      id="apply-template-all-steps"
                      onCheckedChange={(checked) => setApplyTemplateToAllSteps(checked as boolean)}
                    />
                  </div>
                  <Label>템플릿 선택</Label>
                  <Select
                    onValueChange={(v) => {
                      setSelectedTemplateId(v)
                      handleTemplateSelect(v, { applyToAllSteps: applyTemplateToAllSteps })
                      setIsTemplateDialogOpen(false)
                    }}
                    value={selectedTemplateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="템플릿 선택 (선택사항)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[360px]">
                      {templatesData?.emailTemplates && templatesData.emailTemplates.length > 0 ? (
                        templatesData.emailTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{template.name}</span>
                              {template.description && (
                                <span className="text-muted-foreground text-xs">
                                  {template.description}
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem disabled value="no-templates">
                          등록된 템플릿이 없습니다
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    💡 템플릿을 선택하면 제목/본문이 자동으로 입력됩니다
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            {/* Signature Dialog */}
            <Dialog onOpenChange={setIsSignatureDialogOpen} open={isSignatureDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-8" size="sm" type="button" variant="outline">
                  <FileSignature className="mr-2 h-4 w-4" />
                  서명
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>서명 설정</DialogTitle>
                  <DialogDescription>
                    이메일 본문 하단에 추가될 서명을 선택하세요.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={currentStep?.includeSignature !== false}
                      id="include-signature-dialog"
                      onCheckedChange={(checked) =>
                        onUpdateStep({ includeSignature: checked as boolean })
                      }
                    />
                    <Label
                      className="cursor-pointer font-normal text-sm"
                      htmlFor="include-signature-dialog"
                    >
                      이메일에 서명 추가
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>서명 선택</Label>
                    <Select
                      onValueChange={handleSignatureChange}
                      value={getCurrentSignatureValue()}
                    >
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
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="none">서명 없음</SelectItem>
                        <SelectItem value="default">기본 서명</SelectItem>
                        {signatures?.map((signature) => {
                          const displayText = `${signature.name}${signature.workspaceName ? ` (${signature.workspaceName}${signature.userName ? ` • ${signature.userName}` : ""})` : ""}`
                          return (
                            <SelectItem
                              key={signature.id}
                              textValue={displayText}
                              value={signature.id}
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{signature.name}</span>
                                  {signature.isDefault && (
                                    <Badge className="text-xs" variant="secondary">
                                      기본
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                  {signature.workspaceName && (
                                    <span>{signature.workspaceName}</span>
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
                  </div>

                  {/* Signature Preview */}
                  {signatureHtmlForPreview && (
                    <div className="space-y-2">
                      <Label>미리보기</Label>
                      <div className="max-h-[200px] overflow-auto rounded-md border bg-muted/10 p-3">
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-xs"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: User-managed signature content is safe
                          dangerouslySetInnerHTML={{ __html: signatureHtmlForPreview }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Button className="h-8" onClick={handleOpenAISheet} size="sm" variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              AI 생성
            </Button>
            <Button className="h-8" onClick={onSaveStep} size="sm">
              <Check className="mr-2 h-4 w-4" />
              저장
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 pr-4">
            {/* Email Subject (always visible) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>이메일 제목 *</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={currentStep?.isAdvertisement}
                    id={`advertisement-${selectedStepIndex}`}
                    onCheckedChange={(checked) => handleAdvertisementToggle(checked as boolean)}
                  />
                  <Label
                    className="cursor-pointer font-normal text-sm"
                    htmlFor={`advertisement-${selectedStepIndex}`}
                  >
                    (광고) 표시
                  </Label>
                </div>
              </div>
              <Input
                onChange={(e) => onUpdateStep({ emailSubject: e.target.value })}
                onFocus={() => setVariableInsertTarget("subject")}
                placeholder="예: 안녕하세요, {{회사명}} 담당자님"
                ref={subjectInputRef}
                value={currentStep?.emailSubject || ""}
              />
            </div>

            {/* Email Body */}
            <div className="flex flex-col gap-2">
              <Label>이메일 본문 *</Label>
              <div className="min-h-[220px]" onFocusCapture={() => setVariableInsertTarget("body")}>
                <RichTextEditor
                  height={220}
                  onChange={(value) => onUpdateStep({ emailBodyText: value })}
                  placeholder="이메일 내용을 입력하세요..."
                  ref={editorRef}
                  value={currentStep?.emailBodyText || ""}
                />
              </div>
            </div>

            {/* Variables & Attachments - 2 column layout */}
            <div className="grid grid-cols-2 gap-3">
              {/* Variables */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {t("sequences.manualMode.variableInsert")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    (
                    {variableInsertTarget === "subject"
                      ? t("sequences.manualMode.variableTarget.subject")
                      : t("sequences.manualMode.variableTarget.body")}
                    )
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {getVariables(t).map((variable) => (
                    <Button
                      className="h-6 px-2 text-xs"
                      key={variable.value}
                      onClick={() => handleInsertVariable(variable.value)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {variable.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    {t("sequences.manualMode.attachments")}
                  </span>
                  {currentStep?.files && currentStep.files.length > 0 && (
                    <Badge className="h-5 px-1.5 text-xs" variant="secondary">
                      {currentStep.files.length}
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    className="hidden"
                    id={`file-input-${selectedStepIndex}`}
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      onUpdateStep({ files })
                    }}
                    type="file"
                  />
                  <label
                    className="flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-2 text-muted-foreground text-xs transition-colors hover:border-primary hover:text-foreground"
                    htmlFor={`file-input-${selectedStepIndex}`}
                  >
                    파일 선택
                  </label>
                  {currentStep?.files && currentStep.files.length > 0 && (
                    <div className="max-h-[60px] space-y-1 overflow-auto">
                      {currentStep.files.map((file, idx) => (
                        <div
                          className="flex items-center justify-between rounded bg-background p-1.5 text-xs"
                          key={`file-${file.name}-${idx}`}
                        >
                          <span className="truncate">{file.name}</span>
                          <Button
                            className="h-4 w-4 flex-shrink-0 p-0"
                            onClick={() => {
                              const newFiles = currentStep.files?.filter((_, i) => i !== idx)
                              onUpdateStep({ files: newFiles })
                            }}
                            size="sm"
                            variant="ghost"
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
          </div>
        </ScrollArea>
      </div>

      {/* AI Generation Sheet */}
      <Sheet onOpenChange={onShowAISheetChange} open={showAISheet}>
        <SheetContent className="flex w-[600px] flex-col sm:max-w-[600px]" side="right">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI 이메일 생성
            </SheetTitle>
            <SheetDescription>
              AI가 자동으로 이메일을 작성해드립니다. 원하는 내용을 설명해주세요.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="mt-6 flex-1 pr-4">
            <div className="space-y-4">
              {/* Template Selection for AI */}
              <div className="space-y-2">
                <Label>템플릿 참고 (선택)</Label>
                <Select onValueChange={setSelectedAITemplateId} value={selectedAITemplateId}>
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
                              <span className="text-muted-foreground text-xs">
                                {template.description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem disabled value="no-templates">
                        등록된 템플릿이 없습니다
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  💡 템플릿을 선택하면 AI가 해당 템플릿의 스타일과 구조를 참고하여 이메일을
                  생성합니다
                </p>

                {/* Template Preview */}
                {selectedAITemplateId && selectedAITemplateId !== "none" && (
                  <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="flex items-center gap-2 font-medium text-sm">
                        <Info className="h-4 w-4 text-primary" />
                        선택한 템플릿 미리보기
                      </h4>
                      <Button
                        className="h-6 px-2 text-xs"
                        onClick={() => setSelectedAITemplateId("none")}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {(() => {
                      const selectedTemplate = templatesData?.emailTemplates.find(
                        (t) => t.id === selectedAITemplateId,
                      )
                      if (!selectedTemplate) {
                        return null
                      }

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
                          <div className="space-y-2 border-t pt-2">
                            <div>
                              <span className="font-medium text-muted-foreground">제목:</span>
                              <div className="mt-1 rounded border bg-background p-2 text-xs">
                                {selectedTemplate.subject}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">본문:</span>
                              <div className="mt-1 max-h-[200px] overflow-y-auto rounded border bg-background p-2 text-xs">
                                {selectedTemplate.bodyHtml ? (
                                  <div
                                    className="prose prose-sm dark:prose-invert max-w-none"
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
                          <p className="border-t pt-2 text-muted-foreground text-xs">
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
              <div className="space-y-2 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
                <h4 className="flex items-center gap-2 font-medium text-sm">
                  <Info className="h-4 w-4 text-blue-600" />
                  타겟 고객 그룹 정보 (자동 감지)
                </h4>
                <Input
                  className="bg-white dark:bg-background"
                  onChange={(e) => setAiGroupInfo(e.target.value)}
                  placeholder="타겟 고객 정보를 입력하세요"
                  value={aiGroupInfo}
                />
                <p className="text-muted-foreground text-xs">
                  고객 리드 데이터를 기반으로 자동 감지됩니다. 필요시 수정 가능합니다.
                </p>
              </div>

              {/* Target Country */}
              <div className="space-y-2">
                <Label>타겟 국가</Label>
                <Input
                  onChange={(e) => setAiCountry(e.target.value)}
                  placeholder="예: Korea, Japan, China"
                  value={aiCountry}
                />
              </div>

              {/* Follow-up Goal */}
              <div className="space-y-2">
                <Label>팔로업 목표</Label>
                <Input
                  onChange={(e) => setAiGoal(e.target.value)}
                  placeholder="예: 미팅 성사, 데모 요청, 자료 다운로드 유도"
                  value={aiGoal}
                />
                <p className="text-muted-foreground text-xs">
                  이 이메일을 통해 달성하고자 하는 목표를 입력하세요
                </p>
              </div>

              {/* Template Strategy (Tone & Manner) */}
              <div className="space-y-2">
                <Label>템플릿 전략 (톤앤매너)</Label>
                <Input
                  onChange={(e) => setAiStrategy(e.target.value)}
                  placeholder="예: 전문적이고 친근한 톤, 간결하고 명확한 메시지"
                  value={aiStrategy}
                />
                <p className="text-muted-foreground text-xs">
                  이메일의 톤, 스타일, 길이 등을 지정하세요
                </p>
              </div>

              {/* AI Prompt (Optional Additional Instructions) */}
              <div className="space-y-2">
                <Label>추가 지시사항 (선택)</Label>
                <Textarea
                  onChange={(e) => onAIPromptChange(e.target.value)}
                  placeholder="예: 최근 출시한 신제품에 대한 소개를 포함하고, 기존 고객 성공 사례를 언급해주세요..."
                  rows={4}
                  value={aiPrompt}
                />
                <p className="text-muted-foreground text-xs">
                  추가로 포함하고 싶은 내용이나 특별한 지시사항을 입력하세요
                </p>
              </div>

              <div className="space-y-2 rounded-lg bg-muted p-4">
                <h4 className="font-medium text-sm">💡 작성 가이드</h4>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground text-xs">
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

          <div className="mt-auto flex gap-2 border-t pt-4">
            <Button className="flex-1" disabled={isGeneratingAI} onClick={handleGenerateAI}>
              {isGeneratingAI ? (
                "생성 중..."
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  생성하기
                </>
              )}
            </Button>
            <Button onClick={() => onShowAISheetChange(false)} variant="outline">
              취소
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
