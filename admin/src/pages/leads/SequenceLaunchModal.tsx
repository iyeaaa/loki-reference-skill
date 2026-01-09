import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Mail, Plus, Send, Sparkles, Trash2, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { SignatureEditorModal } from "@/components/SignatureEditorModal"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useCustomerGroupMembers } from "@/lib/api/hooks/customer-groups"
import { useActiveEmailAccountsByWorkspace } from "@/lib/api/hooks/email-accounts"
import { useDefaultEmailSignature } from "@/lib/api/hooks/email-signatures"
import {
  sequenceKeys,
  useActivateStepBasedSequence,
  useBulkEnrollWithScheduling,
  useCreateSequence,
  useCreateSequenceStep,
  useDeleteSequenceStep,
  useSequenceSteps,
  useSequencesByWorkspace,
  useUpdateSequenceStep,
} from "@/lib/api/hooks/sequences"
import { leadsApi } from "@/lib/api/services/leads"
import { sequencesApi } from "@/lib/api/services/sequences"
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { SequenceStep } from "@/lib/api/types/sequence"
import { useAuth } from "@/lib/auth-provider"
import { generateSignatureHtml } from "@/lib/utils/email-signature"
import { htmlToMarkdown, markdownToHtml } from "@/lib/utils/markdown"

type SequenceLaunchModalProps = {
  isOpen: boolean
  onClose: () => void
  customerGroup: CustomerGroup | null
  workspaceId: string
}

export function SequenceLaunchModal({
  isOpen,
  onClose,
  customerGroup,
  workspaceId,
}: SequenceLaunchModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [selectedSequenceId, setSelectedSequenceId] = useState("")
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState("")
  const [editedSteps, setEditedSteps] = useState<SequenceStep[]>([])
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])

  // AI 이메일 생성 관련 상태
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [targetCountry, setTargetCountry] = useState<string>("")
  const [isLoadingCountry, setIsLoadingCountry] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 서명 편집 모달 상태
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false)
  const [currentEditingStepForSignature, setCurrentEditingStepForSignature] = useState<
    string | null
  >(null)

  // useId for form accessibility
  const targetCountryId = useId()
  const promptId = useId()

  // Get default signature from database (워크스페이스별)
  const isValidWorkspace = !!(workspaceId && workspaceId !== "all")
  const { data: defaultSignature } = useDefaultEmailSignature(
    workspaceId,
    isValidWorkspace && !!user?.id,
  )

  // 고객 그룹의 모든 멤버 조회
  const { data: membersData } = useCustomerGroupMembers(
    customerGroup?.id || "",
    1,
    10_000,
    !!customerGroup?.id,
  )

  // EnrollLeadsDialog와 동일한 방식으로 leads 생성
  const members = membersData?.members || []
  const leads = members.map((member) => ({
    id: member.leadId,
  }))

  // 리드 상세 정보 조회 (체크박스 UI용)
  const { data: leadsData } = useQuery({
    queryKey: ["leads", "customer-group", customerGroup?.id],
    queryFn: () =>
      customerGroup?.id
        ? leadsApi.list({ customerGroupId: customerGroup.id, limit: 10_000 })
        : null,
    enabled: !!customerGroup?.id,
  })
  const leadsDetail = leadsData?.leads || []

  // 디버깅: leads 확인
  useEffect(() => {
    if (isOpen && customerGroup) {
      console.log("📋 고객 그룹 정보:", {
        groupId: customerGroup.id,
        groupName: customerGroup.name,
        membersCount: members.length,
        leadsCount: leads.length,
        leadIds: leads.map((lead) => lead.id),
      })
    }
  }, [isOpen, customerGroup, members, leads])

  // 고객 그룹의 리드에서 country 가져오기 (AI 생성용)
  useEffect(() => {
    if (customerGroup?.id && showAIGenerator) {
      setIsLoadingCountry(true)
      leadsApi
        .list({ customerGroupId: customerGroup.id, limit: 1000 })
        .then((response) => {
          // 모든 리드에서 country 수집 (중복 제거)
          const countries = new Set<string>()
          for (const lead of response.leads) {
            if (lead.country?.trim()) {
              countries.add(lead.country.trim())
            }
          }

          if (countries.size > 0) {
            // comma로 구분하여 저장
            setTargetCountry(Array.from(countries).join(","))
          } else {
            setTargetCountry("")
            toast(t("sequences.launchModal.toast.noCountryInfo"), {
              icon: "⚠️",
            })
          }
        })
        .catch((error) => {
          console.error("리드 조회 실패:", error)
          toast.error(t("stepForm.error.customerGroupRequired"))
        })
        .finally(() => {
          setIsLoadingCountry(false)
        })
    }
  }, [customerGroup?.id, showAIGenerator, t])

  // 새 시퀀스 생성 모드
  const [isCreatingNewSequence, setIsCreatingNewSequence] = useState(false)
  const [newSequenceName, setNewSequenceName] = useState("")
  const [newSequenceDescription, setNewSequenceDescription] = useState("")

  // 워크스페이스의 시퀀스 목록 가져오기
  const { data: sequences, isLoading: isLoadingSequences } = useSequencesByWorkspace(
    workspaceId,
    !!workspaceId,
  )

  // 선택된 시퀀스의 스텝들 가져오기
  const { data: sequenceSteps, isLoading: isLoadingSteps } = useSequenceSteps(
    selectedSequenceId,
    !!selectedSequenceId,
  )

  // 워크스페이스의 활성 이메일 계정들 가져오기
  const { data: emailAccounts, isLoading: isLoadingAccounts } = useActiveEmailAccountsByWorkspace(
    workspaceId,
    !!workspaceId,
  )

  // 시퀀스 등록 및 실행
  const bulkEnroll = useBulkEnrollWithScheduling()
  const createSequence = useCreateSequence()
  const createSequenceStep = useCreateSequenceStep()
  const updateSequenceStep = useUpdateSequenceStep()
  const deleteSequenceStep = useDeleteSequenceStep()
  const activateStepBased = useActivateStepBasedSequence()

  // 시퀀스 스텝이 로드되면 편집 가능한 상태로 복사
  useEffect(() => {
    if (sequenceSteps) {
      setEditedSteps(JSON.parse(JSON.stringify(sequenceSteps)))
    }
  }, [sequenceSteps])

  // 모달이 열릴 때마다 초기화
  useEffect(() => {
    if (isOpen) {
      setSelectedSequenceId("")
      setSelectedEmailAccountId("")
      setEditedSteps([])
      setEditingStepId(null)
      setIsCreatingNewSequence(false)
      setNewSequenceName("")
      setNewSequenceDescription("")
    }
  }, [isOpen])

  // 리드 목록이 로드되면 전체 선택
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedLeadIds를 의존성에 추가하면 무한 루프 발생
  useEffect(() => {
    if (isOpen && leads.length > 0 && selectedLeadIds.length === 0) {
      setSelectedLeadIds(leads.map((lead) => lead.id))
    }
  }, [isOpen, leads.length])

  const handleStepEdit = (stepId: string, field: string, value: string | number) => {
    setEditedSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, [field]: value } : step)),
    )
  }

  // 스텝 편집 완료 시 저장
  const handleSaveStep = async (stepId: string) => {
    const step = editedSteps.find((s) => s.id === stepId)
    if (!step) {
      return
    }

    // 유효성 검사
    if (!step.emailSubject?.trim()) {
      toast.error(t("sequences.launchModal.error.emailSubjectRequired"))
      return
    }

    if (!(step.emailBodyText?.trim() || step.emailBodyHtml?.trim())) {
      toast.error(t("sequences.launchModal.error.emailBodyRequired"))
      return
    }

    const stepData = {
      stepOrder: step.stepOrder,
      delayDays: step.delayDays,
      scheduledHour: step.scheduledHour ?? 9,
      scheduledMinute: step.scheduledMinute ?? 0,
      timezone: step.timezone || "Asia/Seoul",
      emailSubject: step.emailSubject.trim(),
      emailBodyText: step.emailBodyText || "",
      emailBodyHtml: step.emailBodyText
        ? markdownToHtml(step.emailBodyText)
        : step.emailBodyHtml || "",
    }

    try {
      // temp-로 시작하는 ID는 새로 생성, 아니면 업데이트
      if (step.id.startsWith("temp-")) {
        const saved = await createSequenceStep.mutateAsync({
          sequenceId: selectedSequenceId,
          ...stepData,
        })

        console.log("✅ 새 스텝 생성됨:", saved)

        // 로컬 상태에서 임시 ID를 실제 ID로 교체
        setEditedSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, id: saved.id } : s)))
      } else {
        const updated = await updateSequenceStep.mutateAsync({
          sequenceId: selectedSequenceId,
          stepId: step.id,
          data: stepData,
        })

        console.log(`✅ 스텝 ${step.stepOrder} 업데이트됨:`, updated)
      }

      // 쿼리 캐시 갱신 및 refetch 대기
      await queryClient.invalidateQueries({
        queryKey: sequenceKeys.steps(selectedSequenceId),
      })

      await queryClient.refetchQueries({
        queryKey: sequenceKeys.steps(selectedSequenceId),
      })

      setEditingStepId(null)
      toast.success(t("sequences.launchModal.toast.stepSaved"))
    } catch (error) {
      console.error("스텝 저장 오류:", error)
      toast.error("스텝 저장에 실패했습니다.")
    }
  }

  const handleAddStep = () => {
    // 현재 시간 가져오기
    const now = new Date()
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()

    // 임시 ID로 로컬에만 추가 (저장 시 백엔드에 생성됨)
    const newStep: SequenceStep = {
      id: `temp-${Date.now()}`,
      sequenceId: selectedSequenceId,
      stepOrder: editedSteps.length + 1,
      delayDays: 0,
      scheduledHour: currentHour,
      scheduledMinute: currentMinute,
      timezone: "Asia/Seoul",
      emailSubject: "",
      emailBodyText: "",
      emailBodyHtml: "",
      emailTemplateId: null,
      generationSource: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setEditedSteps([...editedSteps, newStep])
    setEditingStepId(newStep.id)
    toast.success(t("sequences.launchModal.toast.stepAdded"))
  }

  const handleRemoveStep = async (stepId: string) => {
    try {
      // temp-로 시작하는 ID는 로컬에서만 삭제
      if (stepId.startsWith("temp-")) {
        setEditedSteps((prev) => {
          const filtered = prev.filter((step) => step.id !== stepId)
          // 스텝 순서 재정렬
          return filtered.map((step, index) => ({
            ...step,
            stepOrder: index + 1,
          }))
        })
        toast.success(t("sequences.launchModal.toast.stepDeleted"))
        return
      }

      // 실제 저장된 스텝은 백엔드에서 삭제
      await deleteSequenceStep.mutateAsync({
        sequenceId: selectedSequenceId,
        stepId,
      })

      console.log(`✅ 스텝 삭제됨: ${stepId}`)

      // 쿼리 캐시 갱신 및 refetch 대기
      await queryClient.invalidateQueries({
        queryKey: sequenceKeys.steps(selectedSequenceId),
      })

      await queryClient.refetchQueries({
        queryKey: sequenceKeys.steps(selectedSequenceId),
      })

      toast.success(t("sequences.launchModal.toast.stepDeleted"))
    } catch (error) {
      console.error("스텝 삭제 오류:", error)
      toast.error("스텝 삭제에 실패했습니다.")
    }
  }

  const handleCreateNewSequence = async () => {
    if (!newSequenceName.trim()) {
      toast.error(t("sequences.launchModal.error.sequenceNameRequired"))
      return
    }

    try {
      const newSequence = await createSequence.mutateAsync({
        workspaceId,
        name: newSequenceName,
        description: newSequenceDescription,
        status: "draft",
        customerGroupId: customerGroup?.id,
      })

      // 시퀀스 목록 새로고침
      await queryClient.invalidateQueries({
        queryKey: sequenceKeys.workspace(workspaceId),
      })

      setSelectedSequenceId(newSequence.id)
      setIsCreatingNewSequence(false)
      setNewSequenceName("")
      setNewSequenceDescription("")

      // 새 시퀀스는 스텝이 없으므로 빈 배열로 설정하고 첫 스텝 추가
      setEditedSteps([])
      toast.success(t("sequences.launchModal.toast.sequenceCreated"))
    } catch (error) {
      console.error("시퀀스 생성 오류:", error)
      // 에러는 이미 mutation의 onError에서 처리됨
    }
  }

  // 사용자 서명 가져오기
  const getUserSignature = () => {
    // DB에서 가져온 기본 서명이 있으면 사용
    if (defaultSignature) {
      return defaultSignature.signatureHtml
    }
    // 없으면 하드코딩된 기본 서명 사용 (폴백)
    return generateSignatureHtml()
  }

  // 서명 편집 모달 열기
  const handleOpenSignatureModal = (stepId: string) => {
    setCurrentEditingStepForSignature(stepId)
    setIsSignatureModalOpen(true)
  }

  // 서명 저장 (현재 스텝에만 적용)
  const handleSaveSignature = (signature: string) => {
    if (currentEditingStepForSignature) {
      setEditedSteps((prev) =>
        prev.map((step) => {
          if (step.id === currentEditingStepForSignature) {
            // 기존 본문에서 서명 부분을 제거하고 새 서명 추가
            let bodyWithoutSignature = step.emailBodyText || ""

            // 기존 서명 패턴 제거 (여러 가능한 구분자)
            const signatureSeparators = [
              /\n\n--\n[\s\S]*$/,
              /\n\n---\n[\s\S]*$/,
              /<div dir="ltr">[\s\S]*<\/div>\s*$/,
            ]

            for (const separator of signatureSeparators) {
              bodyWithoutSignature = bodyWithoutSignature.replace(separator, "")
            }

            return {
              ...step,
              emailBodyText: `${bodyWithoutSignature.trim()}\n\n${signature}`,
            }
          }
          return step
        }),
      )
    }
  }

  // AI로 이메일 템플릿 생성
  const handleGenerateWithAI = async () => {
    if (!editingStepId) {
      toast.error(t("sequences.launchModal.error.selectSequence"))
      return
    }

    if (!workspaceId) {
      toast.error(t("sequences.launchModal.error.workspaceRequired"))
      return
    }

    if (!customerGroup?.id) {
      toast.error(t("sequences.launchModal.error.customerGroupRequired"))
      return
    }

    if (!targetCountry?.trim()) {
      toast.error(t("sequences.launchModal.error.targetCountryRequired"))
      return
    }

    if (!aiPrompt.trim()) {
      toast.error(t("sequences.launchModal.error.promptRequired"))
      return
    }

    if (aiPrompt.trim().length < 10) {
      toast.error(t("sequences.launchModal.error.promptTooShort"))
      return
    }

    setIsGenerating(true)
    try {
      const result = await sequencesApi.generateTemplate({
        workspaceId,
        country: targetCountry,
        prompt: aiPrompt,
      })

      // 현재 편집 중인 스텝 업데이트
      setEditedSteps((prev) =>
        prev.map((step) =>
          step.id === editingStepId
            ? {
                ...step,
                emailSubject: result.emailSubject,
                emailBodyText: `${htmlToMarkdown(result.emailBodyText)}\n\n${getUserSignature()}`,
              }
            : step,
        ),
      )

      toast.success(
        t("sequences.launchModal.success.templateGenerated", {
          language: result.detectedLanguage || "auto",
        }),
      )
      setShowAIGenerator(false)
      setAiPrompt("")
    } catch (error) {
      console.error("AI 템플릿 생성 실패:", error)
      toast.error(error instanceof Error ? error.message : "템플릿 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  // EnrollLeadsDialog와 동일한 방식으로 시퀀스 실행 (복사본 생성)
  const handleLaunch = async () => {
    if (!selectedSequenceId) {
      toast.error(t("sequences.launchModal.error.selectSequence"))
      return
    }

    if (!selectedEmailAccountId) {
      toast.error(t("sequences.launchModal.error.selectEmailAccount"))
      return
    }

    if (selectedLeadIds.length === 0) {
      toast.error(t("sequences.launchModal.error.selectLeads"))
      return
    }

    // 시퀀스 스텝 유효성 검사
    if (editedSteps.length === 0) {
      toast.error(t("sequences.launchModal.error.needSteps"))
      return
    }

    // 저장되지 않은 스텝 확인
    const unsavedSteps = editedSteps.filter((step) => step.id.startsWith("temp-"))
    if (unsavedSteps.length > 0) {
      toast.error(t("sequences.launchModal.error.unsavedSteps", { count: unsavedSteps.length }))
      return
    }

    // 편집 중인 스텝 확인
    if (editingStepId) {
      toast.error(t("sequences.launchModal.error.editingStep"))
      return
    }

    for (const step of editedSteps) {
      if (!step.emailSubject?.trim()) {
        toast.error(t("sequences.launchModal.error.stepNeedsSubject", { order: step.stepOrder }))
        return
      }
      if (!(step.emailBodyText?.trim() || step.emailBodyHtml?.trim())) {
        toast.error(t("sequences.launchModal.error.stepNeedsBody", { order: step.stepOrder }))
        return
      }
    }

    // ✅ 과거 시간 스케줄 검증
    const now = new Date()
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000
    const nowKST = new Date(now.getTime() + KST_OFFSET_MS)
    const currentHour = nowKST.getUTCHours()
    const currentMinute = nowKST.getUTCMinutes()

    for (const step of editedSteps) {
      const delayDays = step.delayDays || 0
      const scheduledHour = step.scheduledHour ?? 9
      const scheduledMinute = step.scheduledMinute ?? 0

      // delayDays가 0이면 오늘 발송인데, 스케줄 시간이 현재 시간보다 이전이면 안됨
      if (delayDays === 0) {
        const scheduledTimeInMinutes = scheduledHour * 60 + scheduledMinute
        const currentTimeInMinutes = currentHour * 60 + currentMinute

        if (scheduledTimeInMinutes <= currentTimeInMinutes) {
          const scheduled = `${String(scheduledHour).padStart(2, "0")}:${String(scheduledMinute).padStart(2, "0")}`
          const current = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`
          toast.error(
            t("sequences.launchModal.error.pastScheduleTime", {
              order: step.stepOrder,
              scheduled,
              current,
            }),
            { duration: 6000 },
          )
          return
        }
      }
    }

    console.log("📋 시퀀스 복사 및 실행 시작:", {
      originalSequenceId: selectedSequenceId,
      customerGroupId: customerGroup?.id,
      leadCount: selectedLeadIds.length,
      leadIds: selectedLeadIds,
      stepsCount: editedSteps.length,
      steps: editedSteps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        scheduledHour: s.scheduledHour,
        scheduledMinute: s.scheduledMinute,
        delayDays: s.delayDays,
      })),
    })

    try {
      // 1. 시퀀스 복사 (고객 그룹 및 리드 포함)
      toast(t("sequences.launchModal.toast.sequenceCopying"), { icon: "📋" })
      const copiedSequence = await sequencesApi.copy(selectedSequenceId, {
        customerGroupId: customerGroup?.id,
        selectedLeadIds,
      })

      console.log("✅ 시퀀스 복사 완료:", {
        originalId: selectedSequenceId,
        copiedId: copiedSequence.id,
        copiedName: copiedSequence.name,
      })

      console.log("📌 복사 시점의 원본 스텝 정보를 확인하려면 백엔드 로그를 확인하세요.")

      toast.success(t("sequences.launchModal.toast.sequenceCopied", { name: copiedSequence.name }))

      // 2. 복사된 시퀀스 활성화
      activateStepBased.mutate(copiedSequence.id, {
        onSuccess: () => {
          console.log("✅ 복사된 시퀀스가 활성화됨")

          // 3. 리드 등록 및 이메일 스케줄링
          bulkEnroll.mutate(
            {
              sequenceId: copiedSequence.id,
              data: {
                leadIds: selectedLeadIds,
                userEmailAccountId: selectedEmailAccountId,
              },
            },
            {
              onSuccess: (result) => {
                console.log("🎉 시퀀스 실행 결과:", result)
                toast.success(
                  t("sequences.launchModal.success.launched", {
                    name: copiedSequence.name,
                    enrolled: result.enrolledCount || 0,
                    scheduled: result.scheduledExecutions || 0,
                  }),
                )
                onClose()

                // 시퀀스 목록 새로고침
                queryClient.invalidateQueries({
                  queryKey: sequenceKeys.workspace(workspaceId),
                })
              },
            },
          )
        },
        onError: (error: Error) => {
          console.error("❌ 복사된 시퀀스 활성화 실패:", error)
          toast.error(error.message || "시퀀스 활성화에 실패했습니다.")
        },
      })
    } catch (error) {
      console.error("❌ 시퀀스 복사 실패:", error)
      toast.error(error instanceof Error ? error.message : "시퀀스 복사에 실패했습니다.")
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="flex max-h-[90vh] max-w-5xl flex-col">
        <DialogHeader className="flex-shrink-0 border-b pb-4">
          <DialogTitle className="flex items-center gap-2 font-semibold text-xl">
            <Send className="h-5 w-5" />
            {t("sequences.launchModal.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {/* 고객 그룹 정보 */}
          {customerGroup && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-5 w-5 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-blue-900">
                      {t("sequences.launchModal.selectedCustomerGroup")}
                    </h4>
                    <p className="mt-1 text-blue-800 text-sm">
                      <strong>{customerGroup.name}</strong>
                      {customerGroup.description && (
                        <span className="ml-2">- {customerGroup.description}</span>
                      )}
                    </p>
                    <p className="mt-1 text-blue-700 text-sm">
                      {t("sequences.launchModal.totalLeadsSelected", {
                        total: leads.length,
                        selected: selectedLeadIds.length,
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 대상 리드 정보 */}
          {customerGroup && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-medium">{t("sequences.launchModal.enrollmentTargetLeads")}</h4>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {t("sequences.launchModal.leadsSelected", { count: selectedLeadIds.length })}
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      className="h-7 text-xs"
                      onClick={() => setSelectedLeadIds(leads.map((lead) => lead.id))}
                      size="sm"
                      variant="ghost"
                    >
                      {t("sequences.launchModal.selectAllLeads")}
                    </Button>
                    <Button
                      className="h-7 text-xs"
                      onClick={() => setSelectedLeadIds([])}
                      size="sm"
                      variant="ghost"
                    >
                      {t("sequences.launchModal.deselectAllLeads")}
                    </Button>
                  </div>
                </div>
              </div>
              {leadsDetail.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  {t("sequences.launchModal.noLeadsInGroup")}
                </p>
              ) : (
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {leadsDetail.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id)
                    const primaryEmail = lead.contacts?.find(
                      (c) => c.isPrimary && c.contactType === "email",
                    )?.contactValue

                    return (
                      // biome-ignore lint/a11y/useSemanticElements: 복잡한 레이아웃을 위해 div 사용
                      <div
                        className={`flex cursor-pointer items-center justify-between border-b px-3 py-2 text-sm transition-colors last:border-0 ${
                          isSelected
                            ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                            : "hover:bg-gray-50"
                        }`}
                        key={lead.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedLeadIds(selectedLeadIds.filter((id) => id !== lead.id))
                          } else {
                            setSelectedLeadIds([...selectedLeadIds, lead.id])
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            if (isSelected) {
                              setSelectedLeadIds(selectedLeadIds.filter((id) => id !== lead.id))
                            } else {
                              setSelectedLeadIds([...selectedLeadIds, lead.id])
                            }
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <input
                              checked={isSelected}
                              className="h-4 w-4 rounded border-gray-300"
                              onChange={() => {}}
                              type="checkbox"
                            />
                            <span className="font-medium">
                              {lead.companyName || t("sequences.launchModal.companyNameUnknown")}
                            </span>
                          </div>
                          <div className="mt-0.5 ml-6 text-muted-foreground text-xs">
                            {primaryEmail || t("sequences.launchModal.noEmail")}
                            {lead.country && ` • ${lead.country}`}
                            {lead.businessType && ` • ${lead.businessType}`}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 시퀀스 선택 또는 생성 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("sequences.launchModal.selectSequence")}</Label>
              <Button
                disabled={createSequence.isPending}
                onClick={() => setIsCreatingNewSequence(!isCreatingNewSequence)}
                size="sm"
                variant="outline"
              >
                {isCreatingNewSequence ? (
                  <>
                    <X className="mr-1 h-4 w-4" />
                    {t("sequences.launchModal.backToSequenceSelect")}
                  </>
                ) : (
                  <>
                    <Plus className="mr-1 h-4 w-4" />
                    {t("sequences.launchModal.createNewSequence")}
                  </>
                )}
              </Button>
            </div>

            {isCreatingNewSequence ? (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>{t("sequences.launchModal.sequenceNameLabel")}</Label>
                    <Input
                      disabled={createSequence.isPending}
                      onChange={(e) => setNewSequenceName(e.target.value)}
                      placeholder={t("sequences.launchModal.sequenceNamePlaceholder")}
                      value={newSequenceName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("sequences.launchModal.sequenceDescriptionLabel")}</Label>
                    <Textarea
                      disabled={createSequence.isPending}
                      onChange={(e) => setNewSequenceDescription(e.target.value)}
                      placeholder={t("sequences.launchModal.sequenceDescriptionPlaceholder")}
                      rows={2}
                      value={newSequenceDescription}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      disabled={createSequence.isPending}
                      onClick={() => {
                        setIsCreatingNewSequence(false)
                        setNewSequenceName("")
                        setNewSequenceDescription("")
                      }}
                      size="sm"
                      variant="outline"
                    >
                      {t("sequences.launchModal.cancelButton")}
                    </Button>
                    <Button
                      disabled={!newSequenceName.trim() || createSequence.isPending}
                      onClick={handleCreateNewSequence}
                      size="sm"
                    >
                      {createSequence.isPending
                        ? t("sequences.launchModal.creating")
                        : t("sequences.launchModal.createSequenceButton")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : isLoadingSequences ? (
              <div className="text-muted-foreground text-sm">
                {t("sequences.launchModal.loading")}
              </div>
            ) : sequences && sequences.length > 0 ? (
              <Select onValueChange={setSelectedSequenceId} value={selectedSequenceId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("sequences.launchModal.selectSequencePlaceholder")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {sequences.map((sequence) => (
                    <SelectItem key={sequence.id} value={sequence.id}>
                      <div className="flex items-center gap-2">
                        <span>{sequence.name}</span>
                        <Badge variant="outline">{sequence.status}</Badge>
                        {sequence.stepsCount !== undefined && (
                          <span className="text-muted-foreground text-xs">
                            ({t("sequences.launchModal.stepsCount", { count: sequence.stepsCount })}
                            )
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Alert>
                <AlertDescription>
                  {t("sequences.launchModal.noSequencesAvailable")}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* 이메일 계정 선택 */}
          {selectedSequenceId && (
            <div className="space-y-3">
              <Label>{t("sequences.launchModal.emailAccountLabel")}</Label>
              {isLoadingAccounts ? (
                <div className="text-muted-foreground text-sm">
                  {t("sequences.launchModal.loading")}
                </div>
              ) : emailAccounts && emailAccounts.length > 0 ? (
                <Select onValueChange={setSelectedEmailAccountId} value={selectedEmailAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("sequences.launchModal.selectEmailAccount")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {emailAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.emailAddress}</span>
                          {account.displayName && (
                            <span className="text-muted-foreground text-xs">
                              ({account.displayName})
                            </span>
                          )}
                          {account.isDefault && (
                            <Badge variant="secondary">
                              {t("sequences.launchModal.defaultBadge")}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert>
                  <AlertDescription>{t("sequences.launchModal.noEmailAccounts")}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 시퀀스 스텝 미리보기 및 편집 */}
          {selectedSequenceId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("sequences.launchModal.sequenceSteps")}</Label>
                <Button
                  disabled={bulkEnroll.isPending}
                  onClick={handleAddStep}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {t("sequences.launchModal.addStep")}
                </Button>
              </div>

              {isLoadingSteps ? (
                <div className="text-muted-foreground text-sm">
                  {t("sequences.launchModal.loading")}
                </div>
              ) : editedSteps.length === 0 ? (
                <Card className="bg-gray-50">
                  <CardContent className="pt-6 pb-6">
                    <div className="text-center text-muted-foreground">
                      <Mail className="mx-auto mb-3 h-12 w-12 opacity-30" />
                      <p className="text-sm">{t("sequences.launchModal.noStepsYet")}</p>
                      <p className="mt-1 text-xs">{t("sequences.launchModal.addFirstStep")}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {editedSteps.map((step) => (
                    <Card key={step.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 font-medium text-sm">
                            <Badge>
                              {t("sequences.launchModal.stepBadge", { order: step.stepOrder })}
                            </Badge>
                            {step.id.startsWith("temp-") && (
                              <Badge
                                className="border-orange-300 text-orange-600"
                                variant="outline"
                              >
                                {t("sequences.launchModal.unsavedBadge")}
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {step.delayDays === 0
                                ? t("sequences.launchModal.immediatelySend")
                                : t("sequences.launchModal.sendAfterDays", {
                                    days: step.delayDays,
                                  })}
                            </span>
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button
                              disabled={updateSequenceStep.isPending}
                              onClick={() => {
                                if (editingStepId === step.id) {
                                  // 저장
                                  handleSaveStep(step.id)
                                } else {
                                  // 편집 모드 진입
                                  setEditingStepId(step.id)
                                }
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              {editingStepId === step.id
                                ? t("sequences.launchModal.saveButton")
                                : t("sequences.launchModal.editButton")}
                            </Button>
                            <Button
                              className="text-red-600 hover:text-red-700"
                              disabled={deleteSequenceStep.isPending}
                              onClick={() => handleRemoveStep(step.id)}
                              size="sm"
                              variant="ghost"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {editingStepId === step.id ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>{t("sequences.launchModal.delayDaysLabel")}</Label>
                                <Input
                                  min="0"
                                  onChange={(e) =>
                                    handleStepEdit(
                                      step.id,
                                      "delayDays",
                                      Number.parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                  type="number"
                                  value={step.delayDays}
                                />
                              </div>
                              <div>
                                <Label>{t("sequences.launchModal.sendTimeLabel")}</Label>
                                <div className="flex gap-2">
                                  <Input
                                    max="23"
                                    min="0"
                                    onChange={(e) =>
                                      handleStepEdit(
                                        step.id,
                                        "scheduledHour",
                                        Number.parseInt(e.target.value, 10) || 0,
                                      )
                                    }
                                    placeholder={t("sequences.launchModal.hourPlaceholder")}
                                    type="number"
                                    value={step.scheduledHour ?? 9}
                                  />
                                  <span className="self-center">:</span>
                                  <Input
                                    max="59"
                                    min="0"
                                    onChange={(e) =>
                                      handleStepEdit(
                                        step.id,
                                        "scheduledMinute",
                                        Number.parseInt(e.target.value, 10) || 0,
                                      )
                                    }
                                    placeholder={t("sequences.launchModal.minutePlaceholder")}
                                    type="number"
                                    value={step.scheduledMinute ?? 0}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* AI 생성 섹션 */}
                            {workspaceId && customerGroup && (
                              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="flex items-center gap-2 font-semibold text-sm">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    {t("sequences.launchModal.aiGeneratorTitle")}
                                  </h3>
                                  <Button
                                    onClick={() => setShowAIGenerator(!showAIGenerator)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                  >
                                    {showAIGenerator
                                      ? t("sequences.launchModal.aiGeneratorClose")
                                      : t("sequences.launchModal.aiGeneratorOpen")}
                                  </Button>
                                </div>

                                {showAIGenerator && (
                                  <div className="space-y-3 border-t pt-2">
                                    {/* 타겟 국가 입력 */}
                                    <div className="space-y-2">
                                      <Label htmlFor={targetCountryId}>
                                        {t("sequences.launchModal.targetCountryLabel")}{" "}
                                        <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        className="bg-background"
                                        disabled={isLoadingCountry}
                                        id={targetCountryId}
                                        onChange={(e) => setTargetCountry(e.target.value)}
                                        placeholder={t(
                                          "sequences.launchModal.targetCountryPlaceholder",
                                        )}
                                        value={targetCountry}
                                      />
                                      <p className="text-muted-foreground text-xs">
                                        {isLoadingCountry
                                          ? t("sequences.launchModal.countryAutoDetecting")
                                          : t("sequences.launchModal.countryAutoDetected")}
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor={promptId}>
                                        {t("sequences.launchModal.emailContentRequestLabel")}{" "}
                                        <span className="text-red-500">*</span>
                                      </Label>
                                      <Textarea
                                        className="min-h-[100px] bg-background"
                                        id={promptId}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder={t(
                                          "sequences.launchModal.emailContentRequestPlaceholder",
                                        )}
                                        value={aiPrompt}
                                      />
                                    </div>

                                    <Button
                                      className="w-full"
                                      disabled={
                                        isGenerating ||
                                        !aiPrompt.trim() ||
                                        aiPrompt.trim().length < 10 ||
                                        !targetCountry?.trim()
                                      }
                                      onClick={handleGenerateWithAI}
                                      type="button"
                                    >
                                      <Sparkles className="mr-2 h-4 w-4" />
                                      {isGenerating
                                        ? t("sequences.launchModal.generating")
                                        : t("sequences.launchModal.generateWithAI")}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div>
                              <Label>{t("sequences.launchModal.emailSubjectLabel")}</Label>
                              <Input
                                onChange={(e) =>
                                  handleStepEdit(step.id, "emailSubject", e.target.value)
                                }
                                placeholder={t("sequences.launchModal.emailSubjectPlaceholder")}
                                value={step.emailSubject}
                              />
                            </div>
                            <div>
                              <div className="mb-2 flex items-center justify-between">
                                <Label>{t("sequences.launchModal.emailBodyLabel")}</Label>
                                <Button
                                  className="h-7"
                                  onClick={() => handleOpenSignatureModal(step.id)}
                                  size="sm"
                                  type="button"
                                  variant="outline"
                                >
                                  <Mail className="mr-1 h-3 w-3" />
                                  {t("sequences.launchModal.editSignature")}
                                </Button>
                              </div>
                              <RichTextEditor
                                height="300px"
                                onChange={(value) =>
                                  handleStepEdit(step.id, "emailBodyText", value)
                                }
                                placeholder="이메일 본문을 입력하세요"
                                value={step.emailBodyText || ""}
                              />
                              <Collapsible className="mt-2">
                                <CollapsibleTrigger className="flex items-center gap-2 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground">
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                                  {t("sequences.launchModal.viewVariables")}
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                  <div className="rounded-md border bg-muted/30 p-3 text-muted-foreground text-xs">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">
                                          {t("sequences.launchModal.variablesCompanyInfo")}
                                        </p>
                                        <ul className="ml-2 space-y-0.5 text-[11px]">
                                          <li>{"{{회사명}}"}</li>
                                          <li>{"{{웹사이트}}"}</li>
                                          <li>{"{{업종}}"}</li>
                                          <li>{"{{설명}}"}</li>
                                          <li>{"{{직원수}}"}</li>
                                          <li>{"{{설립연도}}"}</li>
                                        </ul>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">
                                          {t("sequences.launchModal.variablesLocationInfo")}
                                        </p>
                                        <ul className="ml-2 space-y-0.5 text-[11px]">
                                          <li>{"{{국가}}"}</li>
                                          <li>{"{{도시}}"}</li>
                                          <li>{"{{주/도}}"}</li>
                                          <li>{"{{주소}}"}</li>
                                        </ul>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">
                                          {t("sequences.launchModal.variablesContactInfo")}
                                        </p>
                                        <ul className="ml-2 space-y-0.5 text-[11px]">
                                          <li>{"{{담당자명}}"}</li>
                                          <li>{"{{이메일}}"}</li>
                                        </ul>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">
                                          {t("sequences.launchModal.variablesLeadManagement")}
                                        </p>
                                        <ul className="ml-2 space-y-0.5 text-[11px]">
                                          <li>{"{{리드소스}}"}</li>
                                          <li>{"{{리드상태}}"}</li>
                                          <li>{"{{리드점수}}"}</li>
                                        </ul>
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm">
                              <strong>{t("sequences.launchModal.previewSubject")}</strong>{" "}
                              {step.emailSubject}
                            </div>
                            <div className="text-muted-foreground text-sm">
                              <strong>{t("sequences.launchModal.previewBody")}</strong>{" "}
                              {step.emailBodyText?.substring(0, 100)}
                              {(step.emailBodyText?.length || 0) > 100 && "..."}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {t("sequences.launchModal.sendTime")} {step.scheduledHour ?? 9}:
                              {(step.scheduledMinute ?? 0).toString().padStart(2, "0")}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-shrink-0 justify-end gap-2 border-t bg-white pt-4 dark:bg-gray-950">
          <Button disabled={bulkEnroll.isPending} onClick={onClose} variant="outline">
            <X className="mr-1 h-4 w-4" />
            {t("sequences.launchModal.cancelButton")}
          </Button>
          <Button
            disabled={
              !(selectedSequenceId && selectedEmailAccountId) ||
              editedSteps.length === 0 ||
              bulkEnroll.isPending
            }
            onClick={handleLaunch}
          >
            <Send className="mr-1 h-4 w-4" />
            {bulkEnroll.isPending
              ? t("sequences.launchModal.launching")
              : t("sequences.launchModal.launchButton")}
          </Button>
        </div>
      </DialogContent>

      {/* 서명 편집 모달 */}
      <SignatureEditorModal
        defaultSignature={getUserSignature()}
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSave={handleSaveSignature}
        userId={user?.id}
        workspaceId={workspaceId}
      />
    </Dialog>
  )
}
