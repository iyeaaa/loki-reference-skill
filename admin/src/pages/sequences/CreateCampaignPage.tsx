import { ArrowLeft, Check, Save } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
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
    name: "새 캠페인",
    description: "",
    steps: [] as Array<{
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

  // Load existing sequence if editing
  const { data: existingSequence } = useSequence(editingSequenceId || "", !!editingSequenceId)
  const { data: existingSteps } = useSequenceSteps(editingSequenceId || "", !!editingSequenceId)

  const steps = [
    { number: 1, title: "고객 선택", description: "수신자 선택" },
    { number: 2, title: "시나리오 생성", description: "이메일 작성" },
    { number: 3, title: "검토 및 저장", description: "최종 확인" },
  ]

  // Load existing draft if editing
  useEffect(() => {
    if (!editingSequenceId || !existingSequence) return

    setCampaignData({
      workspaceId: existingSequence.workspaceId,
      customerGroupId: existingSequence.customerGroupId || "",
      selectedLeadIds: existingSequence.selectedLeadIds
        ? JSON.parse(existingSequence.selectedLeadIds)
        : [],
      name: existingSequence.name,
      description: existingSequence.description || "",
      steps:
        existingSteps?.map((step) => ({
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          scheduledHour: step.scheduledHour || 9,
          scheduledMinute: step.scheduledMinute || 0,
          emailSubject: step.emailSubject,
          emailBodyText: step.emailBodyText || "",
          isDraft: false,
        })) || [],
      memo: "",
    })
    setIsInitialized(true)
  }, [editingSequenceId, existingSequence, existingSteps])

  // Initialize: Create draft sequence in DB on mount (only if not editing)
  // biome-ignore lint/correctness/useExhaustiveDependencies: navigate is stable function
  useEffect(() => {
    if (editingSequenceId) return // Skip if editing existing
    if (isInitialized || sequenceId || isCreatingRef.current) return

    const workspaceId =
      selectedWorkspace && selectedWorkspace.id !== "all" ? selectedWorkspace.id : ""

    if (!workspaceId) {
      toast.error("워크스페이스를 선택해주세요")
      navigate("/sequences")
      return
    }

    // Prevent duplicate creation
    isCreatingRef.current = true

    // Create initial draft sequence using API directly
    sequencesApi
      .create({
        workspaceId,
        name: "새 캠페인",
        description: "",
        status: "draft",
      })
      .then((sequence) => {
        console.log("✅ 초안 캠페인 생성 완료:", sequence.id)
        setSequenceId(sequence.id)
        setCampaignData((prev) => ({
          ...prev,
          workspaceId,
        }))
        setIsInitialized(true)
        toast.success("초안 캠페인이 생성되었습니다")
      })
      .catch((error) => {
        toast.error(`캠페인 생성 실패: ${error.message || error}`)
        isCreatingRef.current = false
        navigate("/sequences")
      })
  }, [editingSequenceId, isInitialized, sequenceId, selectedWorkspace])

  // Auto-save to DB with debounce
  useEffect(() => {
    if (!sequenceId) return

    const timer = setTimeout(() => {
      if (!sequenceId || isSaving) return

      setIsSaving(true)
      updateSequence
        .mutateAsync({
          sequenceId,
          data: {
            name: campaignData.name,
            description: campaignData.description || undefined,
            customerGroupId: campaignData.customerGroupId || undefined,
            selectedLeadIds:
              campaignData.selectedLeadIds.length > 0 ? campaignData.selectedLeadIds : undefined,
          },
        })
        .then(() => {
          setLastSaved(new Date())
        })
        .catch((error) => {
          console.error("Auto-save failed:", error)
        })
        .finally(() => {
          setIsSaving(false)
        })
    }, 2000) // 2초 디바운스

    return () => clearTimeout(timer)
  }, [campaignData, sequenceId, isSaving, updateSequence])

  const handleManualSave = async () => {
    if (!sequenceId) {
      toast.error("캠페인이 생성되지 않았습니다")
      return
    }

    setIsSaving(true)
    try {
      await updateSequence.mutateAsync({
        sequenceId,
        data: {
          name: campaignData.name,
          description: campaignData.description || undefined,
          customerGroupId: campaignData.customerGroupId || undefined,
          selectedLeadIds:
            campaignData.selectedLeadIds.length > 0 ? campaignData.selectedLeadIds : undefined,
        },
      })
      setLastSaved(new Date())
      toast.success("저장되었습니다")
    } catch {
      toast.error("저장 실패")
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
        toast.error("고객그룹을 선택해주세요")
        return
      }
    }

    if (currentStep === 2) {
      // Validate Step 2
      if (campaignData.steps.length === 0) {
        toast.error("최소 1개 이상의 이메일 스텝을 추가해주세요")
        return
      }
      const hasDraftSteps = campaignData.steps.some((step) => step.isDraft)
      if (hasDraftSteps) {
        toast.error("작성 중인 스텝이 있습니다. 모든 스텝을 저장해주세요")
        return
      }
      // Check if sequence is created
      if (!sequenceId) {
        toast.error("캠페인이 생성되지 않았습니다. 잠시 후 다시 시도해주세요")
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Campaign Info */}
      <div className="border-b bg-background px-6 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              돌아가기
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {lastSaved && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Save className="h-3 w-3" />
                <span>
                  {isSaving
                    ? "저장 중..."
                    : `${lastSaved.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 저장됨`}
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
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>

        {/* Campaign Name & Description */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={campaignNameId}>캠페인 이름 *</Label>
            <Input
              id={campaignNameId}
              value={campaignData.name}
              onChange={(e) => setCampaignData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="예: 신규 고객 온보딩 캠페인"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={campaignDescriptionId}>캠페인 설명</Label>
            <Textarea
              id={campaignDescriptionId}
              value={campaignData.description}
              onChange={(e) =>
                setCampaignData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="캠페인에 대한 간단한 설명..."
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
              data={{
                workspaceId: campaignData.workspaceId,
                customerGroupId: campaignData.customerGroupId,
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
              이전
            </Button>
            <Button onClick={handleNextStep} disabled={!sequenceId}>
              {!sequenceId ? "초기화 중..." : "다음"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
