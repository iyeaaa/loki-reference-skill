import { ArrowLeft, Check, Save } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSequence, useSequenceSteps, useUpdateSequence } from "@/lib/api/hooks/sequences"
import { sequencesApi } from "@/lib/api/services/sequences"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { CreateCampaignStep1 } from "./CreateCampaignStep1"
import { CreateCampaignStep2 } from "./CreateCampaignStep2"
import { CreateCampaignStep3 } from "./CreateCampaignStep3"

export default function CreateCampaignPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editingSequenceId = searchParams.get("id")
  const { selectedWorkspace } = useWorkspace()
  const updateSequence = useUpdateSequence()
  const campaignNameId = useId()
  const campaignDescriptionId = useId()
  const [currentStep, setCurrentStep] = useState(1)
  const [sequenceId, setSequenceId] = useState<string | null>(editingSequenceId)
  const [campaignData, setCampaignData] = useState({
    workspaceId: "",
    customerGroupId: "",
    selectedLeadIds: [] as string[],
    name: t("sequences.createPage.newCampaign"),
    description: "",
    creationMode: "manual" as "ai" | "manual",
    selectedEmailAccountId: "",
    steps: [] as Array<{
      id?: string // Step ID if it exists in DB
      stepOrder: number
      delayDays: number
      scheduledHour: number
      scheduledMinute: number
      emailSubject: string
      emailBodyText: string
      isDraft?: boolean
      files?: File[]
    }>,
    memo: "",
  })

  const [isInitialized, setIsInitialized] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isCreatingRef = useRef(false)
  const sequenceIdRef = useRef<string | null>(editingSequenceId)
  const lastSavedDataRef = useRef<{
    name: string
    description: string
    customerGroupId: string
    selectedLeadIds: string // JSON stringified array for comparison
  } | null>(null)

  // Load existing sequence if editing
  const { data: existingSequence, isLoading: isLoadingSequence } = useSequence(
    editingSequenceId || "",
    !!editingSequenceId,
  )
  const { data: existingSteps } = useSequenceSteps(editingSequenceId || "", !!editingSequenceId)

  const steps = [
    {
      number: 1,
      title: t("sequences.createPage.step1Title"),
      description: t("sequences.createPage.step1Desc"),
    },
    {
      number: 2,
      title: t("sequences.createPage.step2Title"),
      description: t("sequences.createPage.step2Desc"),
    },
    {
      number: 3,
      title: t("sequences.createPage.step3Title"),
      description: t("sequences.createPage.step3Desc"),
    },
  ]

  // Load existing draft if editing
  useEffect(() => {
    if (!editingSequenceId || !existingSequence) return

    console.log("📂 Loading existing sequence:", existingSequence)
    console.log("📂 Customer Group ID from sequence:", existingSequence.customerGroupId)
    console.log("📂 Existing steps:", existingSteps)

    const loadedData = {
      workspaceId: existingSequence.workspaceId,
      customerGroupId: existingSequence.customerGroupId || "",
      selectedLeadIds: existingSequence.selectedLeadIds
        ? JSON.parse(existingSequence.selectedLeadIds)
        : [],
      name: existingSequence.name,
      description: existingSequence.description || "",
      creationMode: "manual" as "ai" | "manual",
      selectedEmailAccountId: "",
      steps:
        existingSteps?.map((step) => ({
          id: step.id, // Include step ID for updates
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          scheduledHour: step.scheduledHour || 9,
          scheduledMinute: step.scheduledMinute || 0,
          emailSubject: step.emailSubject || "",
          emailBodyText: step.emailBodyText || "",
          isDraft: false,
        })) || [],
      memo: existingSequence.memo || "",
    }

    // console.log("✅ Loaded campaign data:", loadedData)
    // console.log("👥 Customer Group ID:", loadedData.customerGroupId)
    // console.log("👥 Selected Lead IDs:", loadedData.selectedLeadIds)

    setCampaignData(loadedData)
    setIsInitialized(true)
    // Initialize last saved data ref when loading existing campaign
    lastSavedDataRef.current = {
      name: existingSequence.name,
      description: existingSequence.description || "",
      customerGroupId: existingSequence.customerGroupId || "",
      selectedLeadIds: JSON.stringify(
        (existingSequence.selectedLeadIds
          ? JSON.parse(existingSequence.selectedLeadIds)
          : []
        ).sort(),
      ),
    }
  }, [editingSequenceId, existingSequence, existingSteps])

  // Update ref when sequenceId changes
  useEffect(() => {
    sequenceIdRef.current = sequenceId
  }, [sequenceId])

  // Initialize: Create draft sequence in DB on mount (only if not editing)
  // biome-ignore lint/correctness/useExhaustiveDependencies: navigate, t are stable functions
  useEffect(() => {
    // Skip if editing existing or already initialized
    if (editingSequenceId) return
    if (isInitialized) return
    // ref를 사용하여 최신 sequenceId 확인 (클로저 문제 방지)
    if (sequenceIdRef.current) return // sequenceId가 이미 있으면 절대 새로 생성하지 않음
    if (isCreatingRef.current) return

    const workspaceId =
      selectedWorkspace && selectedWorkspace.id !== "all" ? selectedWorkspace.id : ""

    if (!workspaceId) {
      toast.error(t("sequences.createPage.selectWorkspace"))
      navigate("/sequences")
      return
    }

    // Prevent duplicate creation
    isCreatingRef.current = true

    // Create initial draft sequence using API directly
    sequencesApi
      .create({
        workspaceId,
        name: t("sequences.createPage.newCampaign"),
        description: "",
        status: "draft",
      })
      .then((sequence) => {
        // console.log("✅ 초안 캠페인 생성 완료:", sequence.id)
        setSequenceId(sequence.id)
        sequenceIdRef.current = sequence.id
        const defaultName = t("sequences.createPage.newCampaign")
        setCampaignData((prev) => ({
          ...prev,
          workspaceId,
          name: defaultName,
        }))
        setIsInitialized(true)
        // Initialize last saved data ref for new campaign
        lastSavedDataRef.current = {
          name: defaultName,
          description: "",
          customerGroupId: "",
          selectedLeadIds: JSON.stringify([]),
        }
        toast.success(t("sequences.createPage.draftCreated"))
      })
      .catch((error) => {
        toast.error(t("sequences.createPage.creationFailed", { error: error.message || error }))
        isCreatingRef.current = false
        navigate("/sequences")
      })
    // sequenceId를 의존성에서 제거: sequenceId가 변경되어도 초기화 로직은 재실행되지 않아야 함
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSequenceId, isInitialized, selectedWorkspace])

  // Auto-save to DB with debounce (only when changes detected)
  useEffect(() => {
    if (!sequenceId) return

    const timer = setTimeout(() => {
      if (!sequenceId || isSaving) return

      // Skip auto-save if campaign name is empty or default
      const trimmedName = campaignData.name.trim()
      if (!trimmedName || trimmedName === t("sequences.createPage.newCampaign")) {
        return
      }

      // Prepare current data for comparison
      const currentData = {
        name: trimmedName,
        description: campaignData.description?.trim() || "",
        customerGroupId: campaignData.customerGroupId || "",
        selectedLeadIds: JSON.stringify([...campaignData.selectedLeadIds].sort()),
      }

      // Compare with last saved data
      const lastSaved = lastSavedDataRef.current
      if (lastSaved) {
        const hasChanges =
          lastSaved.name !== currentData.name ||
          lastSaved.description !== currentData.description ||
          lastSaved.customerGroupId !== currentData.customerGroupId ||
          lastSaved.selectedLeadIds !== currentData.selectedLeadIds

        // No changes detected, skip save
        if (!hasChanges) {
          return
        }
      }

      setIsSaving(true)

      // Prepare data - always save arrays even if empty
      const updateData: {
        name: string
        description?: string
        customerGroupId?: string
        selectedLeadIds?: string[]
      } = {
        name: trimmedName,
      }

      // Only include fields that have values
      if (campaignData.description?.trim()) {
        updateData.description = campaignData.description.trim()
      }

      if (campaignData.customerGroupId) {
        updateData.customerGroupId = campaignData.customerGroupId
      }

      // Always save selectedLeadIds if customerGroupId is set
      if (campaignData.customerGroupId) {
        updateData.selectedLeadIds = campaignData.selectedLeadIds
      }

      // console.log("💾 Auto-saving campaign data:", updateData)

      updateSequence
        .mutateAsync({
          sequenceId,
          data: updateData,
        })
        .then(() => {
          // Update last saved data ref
          lastSavedDataRef.current = {
            name: trimmedName,
            description: campaignData.description?.trim() || "",
            customerGroupId: campaignData.customerGroupId || "",
            selectedLeadIds: JSON.stringify([...campaignData.selectedLeadIds].sort()),
          }
          setLastSaved(new Date())
          // console.log("✅ Auto-save successful")
        })
        .catch((error) => {
          console.error("❌ Auto-save failed:", error)
        })
        .finally(() => {
          setIsSaving(false)
        })
    }, 3000) // 3초 디바운스 (변경 후 3초 대기)

    return () => clearTimeout(timer)
  }, [campaignData, sequenceId, isSaving, updateSequence, t])

  const handleManualSave = async () => {
    if (!sequenceId) {
      toast.error(t("sequences.createPage.notCreated"))
      return
    }

    // Validate: Campaign name should not be empty or default
    const trimmedName = campaignData.name.trim()
    if (!trimmedName || trimmedName === t("sequences.createPage.newCampaign")) {
      toast.error(t("sequences.step3.enterCampaignName"))
      return
    }

    setIsSaving(true)
    try {
      // Prepare data - always save arrays even if empty
      const updateData: {
        name: string
        description?: string
        customerGroupId?: string
        selectedLeadIds?: string[]
      } = {
        name: trimmedName,
      }

      // Only include fields that have values
      if (campaignData.description?.trim()) {
        updateData.description = campaignData.description.trim()
      }

      if (campaignData.customerGroupId) {
        updateData.customerGroupId = campaignData.customerGroupId
      }

      // Always save selectedLeadIds if customerGroupId is set
      if (campaignData.customerGroupId) {
        updateData.selectedLeadIds = campaignData.selectedLeadIds
      }

      await updateSequence.mutateAsync({
        sequenceId,
        data: updateData,
      })
      // Update last saved data ref after manual save
      lastSavedDataRef.current = {
        name: trimmedName,
        description: campaignData.description?.trim() || "",
        customerGroupId: campaignData.customerGroupId || "",
        selectedLeadIds: JSON.stringify([...campaignData.selectedLeadIds].sort()),
      }
      setLastSaved(new Date())
      toast.success(t("sequences.createPage.saved"))
    } catch {
      toast.error(t("sequences.createPage.saveFailed"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleBack = () => {
    navigate("/sequences")
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      // Validate Step 1
      if (!campaignData.customerGroupId) {
        toast.error(t("sequences.createPage.selectCustomerGroup"))
        return
      }
    }

    if (currentStep === 2) {
      // Validate Step 2
      // Skip step count validation for AI mode (AI generates steps automatically)
      if (campaignData.creationMode === "manual") {
        if (campaignData.steps.length === 0) {
          toast.error(t("sequences.createPage.addAtLeastOneStep"))
          return
        }
        const hasDraftSteps = campaignData.steps.some((step) => step.isDraft)
        if (hasDraftSteps) {
          toast.error(t("sequences.createPage.saveDraftSteps"))
          return
        }
      }
      // Check if sequence is created
      if (!sequenceId) {
        toast.error(t("sequences.createPage.notCreatedTryAgain"))
        return
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  // Show loading state while fetching existing sequence
  if (editingSequenceId && isLoadingSequence) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">{t("sequences.createPage.loading")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Campaign Info */}
      <div className="border-b bg-background px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("sequences.createPage.back")}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span>
                  {isSaving
                    ? t("sequences.createPage.savingStatus")
                    : `${lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} ${t("sequences.createPage.savedAt")}`}
                </span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSave}
              disabled={isSaving || !sequenceId}
              className="h-8"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? t("sequences.createPage.savingStatus") : t("sequences.createPage.save")}
            </Button>
          </div>
        </div>

        {/* Campaign Name & Description */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={campaignNameId}>{t("sequences.createPage.campaignNameLabel")}</Label>
            <Input
              id={campaignNameId}
              value={campaignData.name}
              onChange={(e) => setCampaignData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("sequences.createPage.campaignNamePlaceholder")}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={campaignDescriptionId}>
              {t("sequences.createPage.campaignDescLabel")}
            </Label>
            <Textarea
              id={campaignDescriptionId}
              value={campaignData.description}
              onChange={(e) =>
                setCampaignData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder={t("sequences.createPage.campaignDescPlaceholder")}
              className="h-9 resize-none"
              rows={1}
            />
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="border-b bg-muted/30 px-6 py-3">
        <div className="flex items-center justify-center gap-4">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 font-semibold transition-colors text-sm",
                    currentStep === step.number
                      ? "border-primary bg-primary text-primary-foreground"
                      : currentStep > step.number
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30 bg-background text-muted-foreground",
                  )}
                >
                  {currentStep > step.number ? <Check className="h-4 w-4" /> : step.number}
                </div>
                <div className="text-left">
                  <div
                    className={cn(
                      "text-sm font-medium",
                      currentStep === step.number ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-4 h-0.5 w-16 transition-colors",
                    currentStep > step.number ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content Area - Full Height without Scroll */}
      <div className="flex-1 overflow-hidden">
        {currentStep === 1 && (
          <div className="h-full p-6">
            <CreateCampaignStep1
              data={{
                workspaceId: campaignData.workspaceId,
                customerGroupId: campaignData.customerGroupId,
                selectedLeadIds: campaignData.selectedLeadIds,
              }}
              onChange={(data) => setCampaignData((prev) => ({ ...prev, ...data }))}
            />
          </div>
        )}
        {currentStep === 2 && (
          <div className="h-full p-6">
            <CreateCampaignStep2
              sequenceId={sequenceId}
              data={{
                workspaceId: campaignData.workspaceId,
                customerGroupId: campaignData.customerGroupId,
                creationMode: campaignData.creationMode,
                selectedEmailAccountId: campaignData.selectedEmailAccountId,
                steps: campaignData.steps,
              }}
              onChange={(data) => setCampaignData((prev) => ({ ...prev, ...data }))}
            />
          </div>
        )}
        {currentStep === 3 && (
          <div className="h-full p-6 overflow-auto">
            <CreateCampaignStep3
              sequenceId={sequenceId}
              data={campaignData}
              onChange={(data) => setCampaignData((prev) => ({ ...prev, ...data }))}
            />
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      {currentStep < 3 && (
        <div className="border-t bg-background px-6 py-4">
          <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrevStep} disabled={currentStep === 1}>
              {t("sequences.createPage.previous")}
            </Button>
            <Button onClick={handleNextStep} disabled={!sequenceId}>
              {!sequenceId
                ? t("sequences.createPage.initializing")
                : t("sequences.createPage.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
