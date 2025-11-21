import { Mail, Sparkles } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { RichTextEditorRef } from "@/components/ui/rich-text-editor"
// import { useEmailAccounts } from "@/lib/api/hooks/email-accounts"
import { useDefaultEmailSignature } from "@/lib/api/hooks/email-signatures"
import {
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useGenerateAISequence,
  useUpdateSequenceStep,
} from "@/lib/api/hooks/sequences"
import { useAuth } from "@/lib/auth-provider"
import { generateSignatureHtml } from "@/lib/utils/email-signature"
import { AIModeContent } from "./components/AIModeContent"
import { getCeiledHour, MAX_STEPS } from "./components/constants"
import { ManualModeContent } from "./components/ManualModeContent"
import type { EmailStep } from "./components/types"

interface CreateCampaignStep2Props {
  sequenceId?: string | null
  data: {
    workspaceId: string
    customerGroupId: string
    creationMode: "ai" | "manual"
    selectedEmailAccountId: string
    steps: EmailStep[]
  }
  onChange: (data: {
    creationMode?: "ai" | "manual"
    selectedEmailAccountId?: string
    steps?: EmailStep[]
  }) => void
}

export function CreateCampaignStep2({ sequenceId, data, onChange }: CreateCampaignStep2Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createSequenceStep = useCreateSequenceStep()
  const updateSequenceStep = useUpdateSequenceStep()
  const deleteSequenceStep = useDeleteSequenceStep()
  const generateAIMutation = useGenerateAISequence()

  // AI mode state
  const [creationMode, setCreationMode] = useState<"ai" | "manual">(data.creationMode)
  // const [selectedEmailAccountId, setSelectedEmailAccountId] = useState(data.selectedEmailAccountId)
  const [isGenerating, setIsGenerating] = useState(false)

  // AI mode signature state
  const [aiIncludeSignature, setAiIncludeSignature] = useState(false)
  const [aiSignature, setAiSignature] = useState<string>("")

  // // Get email accounts for AI mode
  // const { data: emailAccountsData } = useEmailAccounts({ page: 1, limit: 100 })
  // const emailAccounts = emailAccountsData?.emailAccounts || []

  // Generate unique IDs for form elements
  const modeAiId = useId()
  const modeManualId = useId()

  // Get default signature from database
  const { data: defaultSignature } = useDefaultEmailSignature(!!user?.id)
  // console.log("defaultSignature", defaultSignature)

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
        includeSignature: step.includeSignature !== undefined ? step.includeSignature : true, // 기본값: true
      }))
      setSteps(updatedSteps)

      // AI mode signature도 초기화
      if (!aiSignature) {
        setAiSignature(signature)
      }
    }
  }, [defaultSignature])

  // Auto-save with debounce
  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange({ steps })
    }, 500)

    return () => clearTimeout(timer)
  }, [steps])

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
      toast.error(t("sequences.step2.maxStepsError", { max: MAX_STEPS }))
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
      toast.error(t("sequences.step2.cannotDeleteFirstStep"))
      return
    }

    if (!confirm(t("sequences.step2.confirmDeleteStep"))) return

    const stepToDelete = steps[index]

    // Delete from DB if it has an ID
    if (sequenceId && stepToDelete.id) {
      try {
        await deleteSequenceStep.mutateAsync({
          sequenceId,
          stepId: stepToDelete.id,
        })
      } catch (error) {
        toast.error(
          t("sequences.step2.stepDeleteError", {
            error: error instanceof Error ? error.message : t("sequences.step2.unknownError"),
          }),
        )
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
      toast.error(t("sequences.step2.enterSubject"))
      return
    }
    if (!currentStep.emailBodyText.trim()) {
      toast.error(t("sequences.step2.enterBody"))
      return
    }

    // Save to local state first
    updateCurrentStep({ isDraft: false })

    // Save to DB if sequenceId exists
    if (sequenceId) {
      try {
        // 서명이 선택되어 있고 포함 여부가 true이면 본문에 서명 추가
        let emailBodyText = currentStep.emailBodyText
        if (currentStep.emailSignature && currentStep.includeSignature !== false) {
          // 서명 HTML을 본문 끝에 추가
          emailBodyText = `${currentStep.emailBodyText}\n\n${currentStep.emailSignature}`
        }

        const stepData = {
          stepOrder: currentStep.stepOrder,
          delayDays: currentStep.delayDays,
          scheduledHour: currentStep.scheduledHour,
          scheduledMinute: currentStep.scheduledMinute,
          emailSubject: currentStep.emailSubject,
          emailBodyText, // 서명이 본문에 포함됨
          generationSource: creationMode === "ai" ? ("ai" as const) : ("manual" as const),
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
        toast.success(t("sequences.step2.stepSaved"))
      } catch (error) {
        toast.error(
          t("sequences.step2.stepSaveError", {
            error: error instanceof Error ? error.message : t("sequences.step2.unknownError"),
          }),
        )
      }
    } else {
      toast.success(t("sequences.step2.stepSavedLocal"))
    }
  }

  const isStepComplete = (step: EmailStep): boolean => {
    return !step.isDraft && !!step.emailSubject?.trim() && !!step.emailBodyText?.trim()
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

  const hasDraftSteps = steps.some((step) => step.isDraft)

  // // Sync local state with parent when creationMode or selectedEmailAccountId changes
  // // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  // useEffect(() => {
  //   onChange({ creationMode, selectedEmailAccountId })
  // }, [creationMode, selectedEmailAccountId])

  // Handle AI generation
  const handleGenerateAIMode = async () => {
    if (!sequenceId) {
      toast.error(t("sequences.step2.sequenceIdRequired"))
      return
    }

    // Email account is now optional - not required for draft generation
    // if (!selectedEmailAccountId) {
    //   toast.error(t("sequences.step2.selectEmailAccount"))
    //   return
    // }

    setIsGenerating(true)

    try {
      // Build request body conditionally - only include userEmailAccountId if it has a value
      const requestBody: { sequenceId: string; userEmailAccountId?: string } = { sequenceId }
      // if (selectedEmailAccountId) {
      //   requestBody.userEmailAccountId = selectedEmailAccountId
      // }

      const result = await generateAIMutation.mutateAsync(requestBody)

      toast.success(
        t("sequences.step2.aiGenerationComplete", {
          leads: result.data.totalLeads,
          drafts: result.data.totalDrafts,
          steps: result.data.stepsCreated,
        }),
      )
      // Trigger parent to refresh steps
      onChange({ steps: [] })
    } catch (error) {
      toast.error(
        t("sequences.step2.aiGenerationFailed", {
          error: error instanceof Error ? error.message : t("sequences.step2.unknownError"),
        }),
      )
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Mode Selection - AI/Manual Toggle */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t("sequences.step2.creationMode")}</h3>

        <RadioGroup
          value={creationMode}
          onValueChange={(value) => setCreationMode(value as "ai" | "manual")}
        >
          {/* AI Mode */}
          <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="ai" id={modeAiId} className="mt-1" />
            <Label htmlFor={modeAiId} className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="font-medium">{t("sequences.step2.aiMode.title")}</span>
                <Badge variant="secondary" className="text-xs">
                  {t("sequences.step2.aiMode.recommended")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("sequences.step2.aiMode.description")}
              </p>
            </Label>
          </div>

          {/* Manual Mode */}
          <div className="flex items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors">
            <RadioGroupItem value="manual" id={modeManualId} className="mt-1" />
            <Label htmlFor={modeManualId} className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-4 w-4" />
                <span className="font-medium">{t("sequences.step2.manualMode.title")}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("sequences.step2.manualMode.description")}
              </p>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* AI Mode Content */}
      {creationMode === "ai" && (
        <AIModeContent
          sequenceId={sequenceId}
          workspaceId={data.workspaceId}
          // selectedEmailAccountId={selectedEmailAccountId}
          // onEmailAccountChange={setSelectedEmailAccountId}
          // emailAccounts={emailAccounts
          //   .filter((a) => a.workspaceId === data.workspaceId)
          //   .map((a) => ({
          //     id: a.id,
          //     emailAddress: a.emailAddress,
          //     displayName: a.displayName,
          //     userEmail: a.userEmail,
          //   }))}
          isGenerating={isGenerating}
          onGenerateAI={handleGenerateAIMode}
          includeSignature={aiIncludeSignature}
          onIncludeSignatureChange={setAiIncludeSignature}
          signature={aiSignature}
          onSignatureChange={setAiSignature}
          getUserSignature={getUserSignature}
          userId={user?.id}
        />
      )}

      {/* Manual Mode Content */}
      {creationMode === "manual" && (
        <ManualModeContent
          steps={steps}
          selectedStepIndex={selectedStepIndex}
          onSelectedStepChange={setSelectedStepIndex}
          currentStep={currentStep}
          onUpdateStep={updateCurrentStep}
          onAddStep={handleAddStep}
          onDeleteStep={handleDeleteStep}
          onSaveStep={handleSaveCurrentStep}
          showAISheet={showAISheet}
          onShowAISheetChange={setShowAISheet}
          aiPrompt={aiPrompt}
          onAIPromptChange={setAiPrompt}
          isGeneratingAI={isGeneratingAI}
          setIsGeneratingAI={setIsGeneratingAI}
          isSignatureModalOpen={false}
          onSignatureModalOpenChange={() => {}}
          onSaveSignature={() => {}}
          onCloseSignature={() => {}}
          editingScheduleIndex={editingScheduleIndex}
          onEditingScheduleIndexChange={setEditingScheduleIndex}
          editorRef={editorRef}
          isStepComplete={isStepComplete}
          getUserSignature={getUserSignature}
          insertVariable={insertVariable}
          handleAdvertisementToggle={handleAdvertisementToggle}
          workspaceId={data.workspaceId}
          customerGroupId={data.customerGroupId}
          userId={user?.id}
          hasDraftSteps={hasDraftSteps}
          setSteps={setSteps}
        />
      )}
    </div>
  )
}
