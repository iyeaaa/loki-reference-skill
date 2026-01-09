// import { ChevronDown, ChevronUp, Mail, Sparkles } from "lucide-react" // Commented out - AI mode selection disabled
import { useEffect, /* useId, */ useRef, useState } from "react" // useId commented out - AI mode disabled
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
// Commented out - AI mode selection disabled
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Label } from "@/components/ui/label"
// import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { RichTextEditorRef } from "@/components/ui/rich-text-editor"
// import { useEmailAccounts } from "@/lib/api/hooks/email-accounts"
import { useDefaultEmailSignature } from "@/lib/api/hooks/email-signatures"
import {
  useCreateSequenceStep,
  useDeleteSequenceStep,
  // useGenerateAISequence, // Commented out - AI mode disabled
  useSequenceSteps,
  useUpdateSequenceStep,
} from "@/lib/api/hooks/sequences"
import { useAuth } from "@/lib/auth-provider"
import { generateSignatureHtml } from "@/lib/utils/email-signature"
// import { AIModeContent } from "./components/AIModeContent" // Commented out - AI mode disabled
import { getCeiledHour, MAX_STEPS } from "./components/constants"
import { ManualModeContent } from "./components/ManualModeContent"
import type { EmailStep } from "./components/types"

type CreateCampaignStep2Props = {
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
  // Callback when AI generation is complete - used to auto-advance to next step
  onGenerationComplete?: () => void
}

export function CreateCampaignStep2({
  sequenceId,
  data,
  onChange,
  // onGenerationComplete, // Commented out - AI mode disabled
}: CreateCampaignStep2Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const createSequenceStep = useCreateSequenceStep()
  const updateSequenceStep = useUpdateSequenceStep()
  const deleteSequenceStep = useDeleteSequenceStep()
  // const generateAIMutation = useGenerateAISequence() // Commented out - AI mode disabled

  // 서버에서 스텝 데이터 직접 가져오기 (부모 컴포넌트에 의존하지 않음)
  const { data: serverStepsData } = useSequenceSteps(sequenceId || "", !!sequenceId)

  // AI mode state - commented out as we're using manual mode only
  // const [creationMode, setCreationMode] = useState<"ai" | "manual">(data.creationMode)
  const creationMode = "manual" as const // Force manual mode only
  // const [selectedEmailAccountId, setSelectedEmailAccountId] = useState(data.selectedEmailAccountId)
  // const [isGenerating, setIsGenerating] = useState(false)

  // AI mode signature state - commented out as we're using manual mode only
  // const [aiIncludeSignature, setAiIncludeSignature] = useState(false)
  // const [aiSignature, setAiSignature] = useState<string>("")

  // // Get email accounts for AI mode
  // const { data: emailAccountsData } = useEmailAccounts({ page: 1, limit: 100 })
  // const emailAccounts = emailAccountsData?.emailAccounts || []

  // Generate unique IDs for form elements - commented out as we're using manual mode only
  // const modeAiId = useId()
  // const modeManualId = useId()
  // const [showModeDetails, setShowModeDetails] = useState(false)

  // Get default signature from database (워크스페이스별)
  const isValidWorkspace = !!(data.workspaceId && data.workspaceId !== "all")
  const { data: defaultSignature } = useDefaultEmailSignature(
    data.workspaceId,
    isValidWorkspace && !!user?.id,
  )

  // Get user signature
  const getUserSignature = () => {
    // DB에서 가져온 기본 서명이 있으면 사용
    if (defaultSignature) {
      return defaultSignature.signatureHtml
    }
    // 없으면 하드코딩된 기본 서명 사용 (폴백)
    if (user) {
      const name = user.username || "사용자"
      // const title = user.department_name || "직원"
      const title = user.userRole || "직원"
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

  // 초기 로딩 완료 여부 (초기 로딩 후에는 서버 데이터 refetch 무시)
  const isInitialLoadDoneRef = useRef(false)

  // 인라인 스케줄 편집 상태
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null)

  // Current editing step
  const currentStep = steps[selectedStepIndex]

  // 서버에서 직접 가져온 스텝 데이터 - 초기 로딩 시에만 반영
  // 저장/삭제 후 refetch된 데이터는 무시하고 로컬 상태만 관리
  useEffect(() => {
    // 이미 초기 로딩이 완료되었으면 서버 데이터 변경 무시
    if (isInitialLoadDoneRef.current) {
      console.log("📥 Ignoring server data refetch (initial load already done)")
      return
    }

    if (!serverStepsData || serverStepsData.length === 0) {
      return
    }

    console.log("📥 Initial load - Setting steps from server:", serverStepsData)

    // 서버 스텝을 EmailStep 형식으로 변환
    const serverSteps: EmailStep[] = serverStepsData.map((step) => ({
      id: step.id,
      stepOrder: step.stepOrder,
      delayDays: step.delayDays,
      scheduledHour: step.scheduledHour || 9,
      scheduledMinute: step.scheduledMinute || 0,
      emailSubject: step.emailSubject || "",
      emailBodyText: step.emailBodyText || "",
      emailBodyHtml: step.emailBodyHtml || "",
      isDraft: false,
    }))

    setSteps(serverSteps)
    isInitialLoadDoneRef.current = true
  }, [serverStepsData])

  // Update steps when data.steps changes (초기 로딩 시에만 사용)
  useEffect(() => {
    // 이미 초기 로딩이 완료되었으면 무시
    if (isInitialLoadDoneRef.current) {
      return
    }

    // 서버 데이터가 있으면 위의 useEffect에서 처리하므로 스킵
    if (serverStepsData && serverStepsData.length > 0) {
      return
    }

    if (data.steps.length === 0) {
      return
    }

    const prevStepsStr = JSON.stringify(
      prevDataStepsRef.current.map((s) => ({ id: s.id, subject: s.emailSubject })),
    )
    const newStepsStr = JSON.stringify(
      data.steps.map((s) => ({ id: s.id, subject: s.emailSubject })),
    )

    if (prevStepsStr !== newStepsStr) {
      console.log("📥 Step2 - Initial data.steps load:", data.steps)
      setSteps(data.steps)
      prevDataStepsRef.current = data.steps
      isInitialLoadDoneRef.current = true
    }
  }, [data.steps, serverStepsData])

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

      // AI mode signature도 초기화 - commented out as we're using manual mode only
      // if (!aiSignature) {
      //   setAiSignature(signature)
      // }
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
    console.log("[DEBUG] updateCurrentStep called with:", {
      updates,
      currentStepBefore: steps[selectedStepIndex],
      selectedStepIndex,
      hasEmailSignature: !!updates.emailSignature,
      emailSignatureId: updates.emailSignatureId,
      emailBodyHtml: updates.emailBodyHtml,
    })

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

    console.log("[DEBUG] updateCurrentStep after update:", {
      updatedStep: updatedSteps[selectedStepIndex],
      emailSignature: updatedSteps[selectedStepIndex].emailSignature,
      emailSignatureId: updatedSteps[selectedStepIndex].emailSignatureId,
      includeSignature: updatedSteps[selectedStepIndex].includeSignature,
      emailBodyHtml: updatedSteps[selectedStepIndex].emailBodyHtml,
    })

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

  // 스텝별 발송기간 기본값 설정 (공통 함수)
  // 1번째 스텝: 0일 (즉시), 2번째 스텝: 3일 후, 3번째 스텝: 7일 후, 4번째 스텝: 10일 후
  const getDefaultDelayDays = (stepIndex: number): number => {
    switch (stepIndex) {
      case 0: // 1번째 스텝
        return 0
      case 1: // 2번째 스텝
        return 3
      case 2: // 3번째 스텝
        return 7
      case 3: // 4번째 스텝
        return 10
      default: // 5번째 이후
        return 14
    }
  }

  const handleAddStep = () => {
    if (steps.length >= MAX_STEPS) {
      toast.error(t("sequences.step2.maxStepsError", { max: MAX_STEPS }))
      return
    }

    const newStep: EmailStep = {
      stepOrder: steps.length + 1,
      delayDays: getDefaultDelayDays(steps.length),
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

    if (!confirm(t("sequences.step2.confirmDeleteStep"))) {
      return
    }

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

    // Re-order steps and update server for affected steps
    // 삭제된 스텝 이후의 모든 스텝의 stepOrder와 delayDays를 재조정
    const stepsToUpdate: Array<{ step: EmailStep; newStepOrder: number; newDelayDays: number }> = []

    for (let i = 0; i < updatedSteps.length; i++) {
      const newStepOrder = i + 1
      const newDelayDays = getDefaultDelayDays(i) // 새로운 위치에 맞는 기본 발송 일정
      const step = updatedSteps[i]

      if (step.stepOrder !== newStepOrder) {
        stepsToUpdate.push({ step, newStepOrder, newDelayDays })
        step.stepOrder = newStepOrder
        step.delayDays = newDelayDays // 발송 일정도 함께 업데이트
        console.log(`📅 Step ${newStepOrder}: delayDays updated to ${newDelayDays}`)
      }
    }

    // 먼저 로컬 상태 업데이트 (UI 반응성)
    setSteps(updatedSteps)

    // 서버에 저장된 스텝들의 stepOrder와 delayDays 업데이트
    if (sequenceId && stepsToUpdate.length > 0) {
      try {
        for (const { step, newStepOrder, newDelayDays } of stepsToUpdate) {
          if (step.id) {
            console.log(
              `📝 Updating step ${step.id}: order=${newStepOrder}, delayDays=${newDelayDays}`,
            )
            await updateSequenceStep.mutateAsync({
              sequenceId,
              stepId: step.id,
              data: {
                stepOrder: newStepOrder,
                delayDays: newDelayDays, // 발송 일정도 서버에 업데이트
                scheduledHour: step.scheduledHour,
                scheduledMinute: step.scheduledMinute,
                emailSubject: step.emailSubject,
                emailBodyText: step.emailBodyText,
                emailBodyHtml: step.emailBodyHtml,
              },
            })
          }
        }
        console.log("✅ All step orders and schedules updated successfully")
      } catch (error) {
        console.error("Failed to update step orders:", error)
        // 에러가 발생해도 로컬 상태는 이미 업데이트됨
      }
    }

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

    // Save to DB if sequenceId exists
    if (sequenceId) {
      try {
        // 서명이 없으면 기본 서명 가져오기 (DB 저장 전에 서명 설정)
        let emailSignature = currentStep.emailSignature
        let emailSignatureId = currentStep.emailSignatureId
        let includeSignature = currentStep.includeSignature !== false // 기본값: true

        // 서명이 없고 기본 서명이 있으면 자동으로 설정
        if (!emailSignature) {
          const defaultSignatureHtml = getUserSignature()
          if (defaultSignatureHtml) {
            emailSignature = defaultSignatureHtml
            // 기본 서명 ID 설정
            emailSignatureId = defaultSignature?.id || "default"
            includeSignature = true

            console.log("[DEBUG] Auto-setting default signature before save:", {
              emailSignature: emailSignature.substring(0, 100),
              emailSignatureId,
              includeSignature,
              defaultSignatureId: defaultSignature?.id,
            })

            // 로컬 상태 업데이트 (서명 설정)
            updateCurrentStep({
              emailSignature,
              emailSignatureId,
              includeSignature,
            })
          }
        }

        // 서명이 없으면 빈 문자열로 설정 (서명 없이 저장)
        if (!emailSignature) {
          emailSignature = ""
        }

        // 항상 최신 emailBodyText를 HTML로 변환하고 서명 추가
        // emailBodyHtml은 항상 재생성하여 최신 상태 유지
        const { markdownToHtml } = await import("@/lib/utils/markdown")
        const bodyHtmlFromMarkdown = markdownToHtml(currentStep.emailBodyText)

        const emailBodyText = currentStep.emailBodyText
        // 서명이 있고 포함 여부가 true이면 추가
        const emailBodyHtml =
          emailSignature && includeSignature
            ? `${bodyHtmlFromMarkdown}\n\n${emailSignature}`
            : bodyHtmlFromMarkdown

        console.log("[DEBUG] After processing:", {
          emailBodyText,
          emailBodyHtml,
        })

        const stepData = {
          stepOrder: currentStep.stepOrder,
          delayDays: currentStep.delayDays,
          scheduledHour: currentStep.scheduledHour,
          scheduledMinute: currentStep.scheduledMinute,
          emailSubject: currentStep.emailSubject,
          emailBodyText,
          emailBodyHtml, // 서명이 포함된 HTML
          generationSource: "manual" as const, // Always manual mode
        }

        console.log("[DEBUG] stepData:", {
          ...stepData,
          emailBodyHtmlLength: stepData.emailBodyHtml?.length || 0,
          emailBodyHtmlPreview: stepData.emailBodyHtml?.substring(0, 200),
        })

        if (currentStep.id) {
          // Update existing step
          console.log("bbbbbbbbbbbbbb")
          console.log("[DEBUG] updateSequenceStep object:", {
            mutateAsync: typeof updateSequenceStep.mutateAsync,
            hasMutateAsync: !!updateSequenceStep.mutateAsync,
            stepData: {
              ...stepData,
              emailBodyHtmlLength: stepData.emailBodyHtml?.length || 0,
            },
          })

          const updatedStep = await updateSequenceStep.mutateAsync({
            sequenceId,
            stepId: currentStep.id,
            data: stepData,
            files: currentStep.files,
          })

          console.log("[DEBUG] updateSequenceStep.mutateAsync completed:", updatedStep)

          // DB 저장 성공 후 isDraft: false로 설정 및 서명 정보 업데이트 (함수형 업데이트로 최신 상태 보장)
          setSteps((prevSteps) => {
            const newSteps = [...prevSteps]
            newSteps[selectedStepIndex] = {
              ...newSteps[selectedStepIndex],
              id: updatedStep?.id || newSteps[selectedStepIndex].id,
              isDraft: false,
              emailSignature,
              emailSignatureId,
              includeSignature,
              emailBodyHtml,
            }
            return newSteps
          })
        } else {
          console.log("aaaaaaaaaaaaa")
          const createdStep = await createSequenceStep.mutateAsync({
            data: {
              sequenceId,
              ...stepData,
            },
            files: currentStep.files,
          })

          // DB 저장 성공 후 isDraft: false로 설정 및 ID 업데이트 (함수형 업데이트로 최신 상태 보장)
          setSteps((prevSteps) => {
            const newSteps = [...prevSteps]
            newSteps[selectedStepIndex] = {
              ...newSteps[selectedStepIndex],
              id: createdStep?.id || newSteps[selectedStepIndex].id,
              isDraft: false,
              emailSignature,
              emailSignatureId,
              includeSignature,
              emailBodyHtml,
            }
            return newSteps
          })
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

  const isStepComplete = (step: EmailStep): boolean =>
    !step.isDraft && !!step.emailSubject?.trim() && !!step.emailBodyText?.trim()

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

  // Handle AI generation - commented out as we're using manual mode only
  // const handleGenerateAIMode = async () => {
  //   if (!sequenceId) {
  //     toast.error(t("sequences.step2.sequenceIdRequired"))
  //     return
  //   }

  //   // Email account is now optional - not required for draft generation
  //   // if (!selectedEmailAccountId) {
  //   //   toast.error(t("sequences.step2.selectEmailAccount"))
  //   //   return
  //   // }

  //   setIsGenerating(true)

  //   try {
  //     // Build request body conditionally - only include userEmailAccountId if it has a value
  //     const requestBody: { sequenceId: string; userEmailAccountId?: string } = { sequenceId }
  //     // if (selectedEmailAccountId) {
  //     //   requestBody.userEmailAccountId = selectedEmailAccountId
  //     // }

  //     const result = await generateAIMutation.mutateAsync(requestBody)

  //     toast.success(
  //       t("sequences.step2.aiGenerationComplete", {
  //         leads: result.data.totalLeads,
  //         drafts: result.data.totalDrafts,
  //         steps: result.data.stepsCreated,
  //       }),
  //     )
  //     // Trigger parent to refresh steps
  //     onChange({ steps: [] })
  //   } catch (error) {
  //     toast.error(
  //       t("sequences.step2.aiGenerationFailed", {
  //         error: error instanceof Error ? error.message : t("sequences.step2.unknownError"),
  //       }),
  //     )
  //   } finally {
  //     setIsGenerating(false)
  //   }
  // }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* Mode Selection - Commented out as we're using manual mode only */}
      {/* <div className="flex flex-shrink-0 flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{t("sequences.step2.creationMode")}</h3>
            <Button
              aria-label="toggle mode details"
              className="h-7 px-2"
              onClick={() => setShowModeDetails((prev) => !prev)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {showModeDetails ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>

          <RadioGroup
            className="grid grid-cols-2 gap-2"
            onValueChange={(value) => {
              const nextMode = value as "ai" | "manual"
              setCreationMode(nextMode)
              onChange({ creationMode: nextMode })
            }}
            value={creationMode}
          >
            {/* Manual Mode */}
      {/* <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 transition-colors hover:bg-muted/30">
              <RadioGroupItem id={modeManualId} value="manual" />
              <Label className="flex cursor-pointer items-center gap-2" htmlFor={modeManualId}>
                <Mail className="h-4 w-4" />
                <span className="font-medium text-sm">{t("sequences.step2.manualMode.title")}</span>
              </Label>
            </div> */}

      {/* AI Mode (Beta) */}
      {/* <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 transition-colors hover:bg-muted/30">
              <RadioGroupItem id={modeAiId} value="ai" />
              <Label className="flex cursor-pointer items-center gap-2" htmlFor={modeAiId}>
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="font-medium text-sm">{t("sequences.step2.aiMode.title")}</span>
                <Badge className="h-5 px-2 text-[10px]" variant="secondary">
                  BETA
                </Badge>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {showModeDetails && (
          <div className="grid gap-2 text-muted-foreground text-xs">
            <div>
              <span className="font-medium text-foreground">
                {t("sequences.step2.aiMode.title")}
              </span>
              <span className="ml-2">{t("sequences.step2.aiMode.description")}</span>
            </div>
            <div>
              <span className="font-medium text-foreground">
                {t("sequences.step2.manualMode.title")}
              </span>
              <span className="ml-2">{t("sequences.step2.manualMode.description")}</span>
            </div>
          </div>
        )}
      </div> */}

      <div className="min-h-0 flex-1 overflow-hidden">
        {/* AI Mode Content - Commented out as we're using manual mode only */}
        {/* {creationMode === "ai" && (
          <div className="h-full min-h-0 overflow-auto">
            <AIModeContent
              getUserSignature={getUserSignature}
              includeSignature={aiIncludeSignature}
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
              onGenerationComplete={onGenerationComplete}
              onIncludeSignatureChange={setAiIncludeSignature}
              onSignatureChange={setAiSignature}
              sequenceId={sequenceId}
              signature={aiSignature}
              userId={user?.id}
              workspaceId={data.workspaceId}
            />
          </div>
        )} */}

        {/* Manual Mode Content - Always shown */}
        {creationMode === "manual" && (
          <ManualModeContent
            aiPrompt={aiPrompt}
            currentStep={currentStep}
            customerGroupId={data.customerGroupId}
            editingScheduleIndex={editingScheduleIndex}
            editorRef={editorRef}
            getUserSignature={getUserSignature}
            handleAdvertisementToggle={handleAdvertisementToggle}
            hasDraftSteps={hasDraftSteps}
            insertVariable={insertVariable}
            isGeneratingAI={isGeneratingAI}
            isSignatureModalOpen={false}
            isStepComplete={isStepComplete}
            onAddStep={handleAddStep}
            onAIPromptChange={setAiPrompt}
            onCloseSignature={() => {}}
            onDeleteStep={handleDeleteStep}
            onEditingScheduleIndexChange={setEditingScheduleIndex}
            onSaveSignature={() => {}}
            onSaveStep={handleSaveCurrentStep}
            onSelectedStepChange={setSelectedStepIndex}
            onShowAISheetChange={setShowAISheet}
            onSignatureModalOpenChange={() => {}}
            onUpdateStep={updateCurrentStep}
            selectedStepIndex={selectedStepIndex}
            setIsGeneratingAI={setIsGeneratingAI}
            setSteps={setSteps}
            showAISheet={showAISheet}
            steps={steps}
            userId={user?.id}
            workspaceId={data.workspaceId}
          />
        )}
      </div>
    </div>
  )
}
