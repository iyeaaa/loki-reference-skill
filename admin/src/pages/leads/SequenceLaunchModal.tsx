import { useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Mail, Plus, Send, Sparkles, Trash2, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
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
import { generateSignatureHtml } from "@/lib/utils/email-signature"
import { htmlToMarkdown, markdownToHtml } from "@/lib/utils/markdown"

interface SequenceLaunchModalProps {
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
  const queryClient = useQueryClient()
  const [selectedSequenceId, setSelectedSequenceId] = useState("")
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState("")
  const [editedSteps, setEditedSteps] = useState<SequenceStep[]>([])
  const [editingStepId, setEditingStepId] = useState<string | null>(null)

  // AI 이메일 생성 관련 상태
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [targetCountry, setTargetCountry] = useState<string>("")
  const [isLoadingCountry, setIsLoadingCountry] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // useId for form accessibility
  const targetCountryId = useId()
  const promptId = useId()

  // 고객 그룹의 모든 멤버 조회
  const { data: membersData } = useCustomerGroupMembers(
    customerGroup?.id || "",
    1,
    10000,
    !!customerGroup?.id,
  )

  // EnrollLeadsDialog와 동일한 방식으로 leads 생성
  const members = membersData?.members || []
  const leads = members.map((member) => ({
    id: member.leadId,
  }))

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
            toast("고객 그룹에 국가 정보가 없습니다. 직접 입력해주세요.", {
              icon: "⚠️",
            })
          }
        })
        .catch((error) => {
          console.error("리드 조회 실패:", error)
          toast.error("리드 정보를 가져오는데 실패했습니다.")
        })
        .finally(() => {
          setIsLoadingCountry(false)
        })
    }
  }, [customerGroup?.id, showAIGenerator])

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

  const handleStepEdit = (stepId: string, field: string, value: string | number) => {
    setEditedSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, [field]: value } : step)),
    )
  }

  // 스텝 편집 완료 시 저장
  const handleSaveStep = async (stepId: string) => {
    const step = editedSteps.find((s) => s.id === stepId)
    if (!step) return

    // 유효성 검사
    if (!step.emailSubject?.trim()) {
      toast.error("이메일 제목을 입력해주세요.")
      return
    }

    if (!step.emailBodyText?.trim() && !step.emailBodyHtml?.trim()) {
      toast.error("이메일 본문을 입력해주세요.")
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
      toast.success("스텝이 저장되었습니다.")
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setEditedSteps([...editedSteps, newStep])
    setEditingStepId(newStep.id)
    toast.success("스텝이 추가되었습니다. 제목과 내용을 입력 후 저장해주세요.")
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
        toast.success("스텝이 삭제되었습니다.")
        return
      }

      // 실제 저장된 스텝은 백엔드에서 삭제
      await deleteSequenceStep.mutateAsync({
        sequenceId: selectedSequenceId,
        stepId: stepId,
      })

      console.log(`✅ 스텝 삭제됨: ${stepId}`)

      // 쿼리 캐시 갱신 및 refetch 대기
      await queryClient.invalidateQueries({
        queryKey: sequenceKeys.steps(selectedSequenceId),
      })

      await queryClient.refetchQueries({
        queryKey: sequenceKeys.steps(selectedSequenceId),
      })

      toast.success("스텝이 삭제되었습니다.")
    } catch (error) {
      console.error("스텝 삭제 오류:", error)
      toast.error("스텝 삭제에 실패했습니다.")
    }
  }

  const handleCreateNewSequence = async () => {
    if (!newSequenceName.trim()) {
      toast.error("시퀀스 이름을 입력해주세요.")
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
      toast.success("새 시퀀스가 생성되었습니다. 이메일 스텝을 추가해주세요.")
    } catch (error) {
      console.error("시퀀스 생성 오류:", error)
      // 에러는 이미 mutation의 onError에서 처리됨
    }
  }

  // 사용자 서명 생성
  const generateUserSignature = () => {
    // TODO: 사용자 정보에서 이름과 직함 가져오기
    const name = undefined
    const title = undefined
    if (name && title) {
      return generateSignatureHtml({ name, title })
    }
    return generateSignatureHtml() // 기본값 사용
  }

  // AI로 이메일 템플릿 생성
  const handleGenerateWithAI = async () => {
    if (!editingStepId) {
      toast.error("먼저 스텝을 선택해주세요.")
      return
    }

    if (!workspaceId) {
      toast.error("워크스페이스 정보가 없습니다.")
      return
    }

    if (!customerGroup?.id) {
      toast.error("고객 그룹이 설정되어 있지 않습니다.")
      return
    }

    if (!targetCountry?.trim()) {
      toast.error("타겟 국가를 입력해주세요.")
      return
    }

    if (!aiPrompt.trim()) {
      toast.error("이메일 내용 요청사항을 입력해주세요.")
      return
    }

    if (aiPrompt.trim().length < 10) {
      toast.error("이메일 내용 요청사항을 10자 이상 입력해주세요.")
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
                emailBodyText: `${htmlToMarkdown(
                  result.emailBodyText,
                )}\n\n${generateUserSignature()}`,
              }
            : step,
        ),
      )

      toast.success(`이메일 템플릿이 생성되었습니다! (언어: ${result.detectedLanguage || "auto"})`)
      setShowAIGenerator(false)
      setAiPrompt("")
    } catch (error) {
      console.error("AI 템플릿 생성 실패:", error)
      toast.error(error instanceof Error ? error.message : "템플릿 생성에 실패했습니다.")
    } finally {
      setIsGenerating(false)
    }
  }

  // EnrollLeadsDialog와 동일한 방식으로 시퀀스 실행
  const handleLaunch = () => {
    if (!selectedSequenceId) {
      toast.error("시퀀스를 선택하거나 생성해주세요.")
      return
    }

    if (!selectedEmailAccountId) {
      toast.error("이메일 계정을 선택해주세요.")
      return
    }

    if (leads.length === 0) {
      toast.error("발송할 리드가 없습니다.")
      return
    }

    // 시퀀스 스텝 유효성 검사
    if (editedSteps.length === 0) {
      toast.error("최소 1개 이상의 이메일 스텝이 필요합니다.")
      return
    }

    // 저장되지 않은 스텝 확인
    const unsavedSteps = editedSteps.filter((step) => step.id.startsWith("temp-"))
    if (unsavedSteps.length > 0) {
      toast.error(
        `저장되지 않은 스텝이 ${unsavedSteps.length}개 있습니다. 모든 스텝을 저장한 후 실행해주세요.`,
      )
      return
    }

    for (const step of editedSteps) {
      if (!step.emailSubject?.trim()) {
        toast.error(`스텝 ${step.stepOrder}: 이메일 제목이 필요합니다.`)
        return
      }
      if (!step.emailBodyText?.trim() && !step.emailBodyHtml?.trim()) {
        toast.error(`스텝 ${step.stepOrder}: 이메일 본문이 필요합니다.`)
        return
      }
    }

    console.log("🚀 시퀀스 실행 시작:", {
      sequenceId: selectedSequenceId,
      customerGroupId: customerGroup?.id,
      leadCount: leads.length,
      leadIds: leads.map((lead) => lead.id),
      stepsCount: editedSteps.length,
    })

    // 1. 스텝 기반 시퀀스 활성화 (워커가 처리하기 위해 필요)
    activateStepBased.mutate(selectedSequenceId, {
      onSuccess: () => {
        console.log("✅ 스텝 기반 시퀀스가 활성화됨")

        // 2. 리드 등록 및 이메일 스케줄링
        bulkEnroll.mutate(
          {
            sequenceId: selectedSequenceId,
            data: {
              leadIds: leads.map((lead) => lead.id),
              userEmailAccountId: selectedEmailAccountId,
            },
          },
          {
            onSuccess: (result) => {
              console.log("🎉 시퀀스 실행 결과:", result)
              toast.success(
                `시퀀스가 성공적으로 실행되었습니다! (${
                  result.enrolledCount || 0
                }명 등록, ${result.scheduledExecutions || 0}개 이메일 스케줄됨)`,
              )
              onClose()
            },
          },
        )
      },
      onError: (error: Error) => {
        console.error("❌ 시퀀스 활성화 실패:", error)
        toast.error(error.message || "시퀀스 활성화에 실패했습니다.")
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" />
            시퀀스 이메일 발송
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-6 pr-2">
          {/* 고객 그룹 정보 */}
          {customerGroup && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium text-blue-900">선택된 고객 그룹</h4>
                    <p className="text-sm text-blue-800 mt-1">
                      <strong>{customerGroup.name}</strong>
                      {customerGroup.description && (
                        <span className="ml-2">- {customerGroup.description}</span>
                      )}
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {leads.length}명의 리드에게 이메일을 발송합니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 시퀀스 선택 또는 생성 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>시퀀스 선택</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingNewSequence(!isCreatingNewSequence)}
                disabled={createSequence.isPending}
              >
                {isCreatingNewSequence ? (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    시퀀스 선택으로 돌아가기
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />새 시퀀스 만들기
                  </>
                )}
              </Button>
            </div>

            {isCreatingNewSequence ? (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label>시퀀스 이름 *</Label>
                    <Input
                      value={newSequenceName}
                      onChange={(e) => setNewSequenceName(e.target.value)}
                      placeholder="예: 신규 고객 환영 시퀀스"
                      disabled={createSequence.isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>시퀀스 설명</Label>
                    <Textarea
                      value={newSequenceDescription}
                      onChange={(e) => setNewSequenceDescription(e.target.value)}
                      placeholder="시퀀스에 대한 설명을 입력하세요 (선택사항)"
                      rows={2}
                      disabled={createSequence.isPending}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsCreatingNewSequence(false)
                        setNewSequenceName("")
                        setNewSequenceDescription("")
                      }}
                      disabled={createSequence.isPending}
                    >
                      취소
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateNewSequence}
                      disabled={!newSequenceName.trim() || createSequence.isPending}
                    >
                      {createSequence.isPending ? "생성 중..." : "시퀀스 생성"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : isLoadingSequences ? (
              <div className="text-sm text-muted-foreground">로딩 중...</div>
            ) : sequences && sequences.length > 0 ? (
              <Select value={selectedSequenceId} onValueChange={setSelectedSequenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="시퀀스를 선택하세요" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] overflow-y-auto">
                  {sequences.map((sequence) => (
                    <SelectItem key={sequence.id} value={sequence.id}>
                      <div className="flex items-center gap-2">
                        <span>{sequence.name}</span>
                        <Badge variant="outline">{sequence.status}</Badge>
                        {sequence.stepsCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({sequence.stepsCount}개 스텝)
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
                  생성된 시퀀스가 없습니다. 위의 "새 시퀀스 만들기" 버튼을 눌러 시퀀스를
                  생성해주세요.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* 이메일 계정 선택 */}
          {selectedSequenceId && (
            <div className="space-y-3">
              <Label>발송 이메일 계정</Label>
              {isLoadingAccounts ? (
                <div className="text-sm text-muted-foreground">로딩 중...</div>
              ) : emailAccounts && emailAccounts.length > 0 ? (
                <Select value={selectedEmailAccountId} onValueChange={setSelectedEmailAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="이메일 계정을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {emailAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <span>{account.emailAddress}</span>
                          {account.displayName && (
                            <span className="text-xs text-muted-foreground">
                              ({account.displayName})
                            </span>
                          )}
                          {account.isDefault && <Badge variant="secondary">기본</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Alert>
                  <AlertDescription>
                    활성화된 이메일 계정이 없습니다. 설정 페이지에서 이메일 계정을 추가해주세요.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 시퀀스 스텝 미리보기 및 편집 */}
          {selectedSequenceId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>이메일 시퀀스 스텝</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddStep}
                  disabled={bulkEnroll.isPending}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  스텝 추가
                </Button>
              </div>

              {isLoadingSteps ? (
                <div className="text-sm text-muted-foreground">로딩 중...</div>
              ) : editedSteps.length === 0 ? (
                <Card className="bg-gray-50">
                  <CardContent className="pt-6 pb-6">
                    <div className="text-center text-muted-foreground">
                      <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">아직 이메일 스텝이 없습니다.</p>
                      <p className="text-xs mt-1">
                        "스텝 추가" 버튼을 눌러 첫 번째 이메일을 만들어보세요.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {editedSteps.map((step) => (
                    <Card key={step.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Badge>스텝 {step.stepOrder}</Badge>
                            {step.id.startsWith("temp-") && (
                              <Badge
                                variant="outline"
                                className="text-orange-600 border-orange-300"
                              >
                                저장 필요
                              </Badge>
                            )}
                            <span className="text-muted-foreground">
                              {step.delayDays === 0 ? "즉시 발송" : `${step.delayDays}일 후`}
                            </span>
                          </CardTitle>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (editingStepId === step.id) {
                                  // 저장
                                  handleSaveStep(step.id)
                                } else {
                                  // 편집 모드 진입
                                  setEditingStepId(step.id)
                                }
                              }}
                              disabled={updateSequenceStep.isPending}
                            >
                              {editingStepId === step.id ? "저장" : "편집"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStep(step.id)}
                              className="text-red-600 hover:text-red-700"
                              disabled={deleteSequenceStep.isPending}
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
                                <Label>발송 지연 (일)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={step.delayDays}
                                  onChange={(e) =>
                                    handleStepEdit(
                                      step.id,
                                      "delayDays",
                                      parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                />
                              </div>
                              <div>
                                <Label>발송 시간</Label>
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="23"
                                    value={step.scheduledHour ?? 9}
                                    onChange={(e) =>
                                      handleStepEdit(
                                        step.id,
                                        "scheduledHour",
                                        parseInt(e.target.value, 10) || 0,
                                      )
                                    }
                                    placeholder="시"
                                  />
                                  <span className="self-center">:</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    max="59"
                                    value={step.scheduledMinute ?? 0}
                                    onChange={(e) =>
                                      handleStepEdit(
                                        step.id,
                                        "scheduledMinute",
                                        parseInt(e.target.value, 10) || 0,
                                      )
                                    }
                                    placeholder="분"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* AI 생성 섹션 */}
                            {workspaceId && customerGroup && (
                              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    AI 이메일 템플릿 생성
                                  </h3>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowAIGenerator(!showAIGenerator)}
                                  >
                                    {showAIGenerator ? "닫기" : "열기"}
                                  </Button>
                                </div>

                                {showAIGenerator && (
                                  <div className="space-y-3 pt-2 border-t">
                                    {/* 타겟 국가 입력 */}
                                    <div className="space-y-2">
                                      <Label htmlFor={targetCountryId}>
                                        타겟 국가 <span className="text-red-500">*</span>
                                      </Label>
                                      <Input
                                        id={targetCountryId}
                                        value={targetCountry}
                                        onChange={(e) => setTargetCountry(e.target.value)}
                                        placeholder="예: 한국, 미국, 일본 (여러 국가는 쉼표로 구분)"
                                        className="bg-background"
                                        disabled={isLoadingCountry}
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        {isLoadingCountry
                                          ? "🔄 고객 그룹의 리드에서 국가 정보를 조회 중입니다..."
                                          : "고객 그룹의 리드에서 자동으로 감지되며, 직접 수정할 수 있습니다."}
                                      </p>
                                    </div>

                                    <div className="space-y-2">
                                      <Label htmlFor={promptId}>
                                        이메일 내용 요청사항 <span className="text-red-500">*</span>
                                      </Label>
                                      <Textarea
                                        id={promptId}
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="예: K-뷰티 제품의 글로벌 유통 파트너십을 제안하는 이메일을 작성해주세요. 우리 제품의 강점과 파트너십 혜택을 강조해주세요."
                                        className="bg-background min-h-[100px]"
                                      />
                                    </div>

                                    <Button
                                      type="button"
                                      onClick={handleGenerateWithAI}
                                      disabled={
                                        isGenerating ||
                                        !aiPrompt.trim() ||
                                        aiPrompt.trim().length < 10 ||
                                        !targetCountry?.trim()
                                      }
                                      className="w-full"
                                    >
                                      <Sparkles className="h-4 w-4 mr-2" />
                                      {isGenerating ? "생성 중..." : "AI로 템플릿 생성"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div>
                              <Label>이메일 제목</Label>
                              <Input
                                value={step.emailSubject}
                                onChange={(e) =>
                                  handleStepEdit(step.id, "emailSubject", e.target.value)
                                }
                                placeholder="이메일 제목을 입력하세요"
                              />
                            </div>
                            <div>
                              <Label>이메일 본문</Label>
                              <RichTextEditor
                                value={step.emailBodyText || ""}
                                onChange={(value) =>
                                  handleStepEdit(step.id, "emailBodyText", value)
                                }
                                placeholder="이메일 본문을 입력하세요"
                                height="300px"
                              />
                              <Collapsible className="mt-2">
                                <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                                  사용 가능한 변수 보기
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                  <div className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">회사 정보:</p>
                                        <ul className="space-y-0.5 ml-2 text-[11px]">
                                          <li>{"{{회사명}}"}</li>
                                          <li>{"{{웹사이트}}"}</li>
                                          <li>{"{{업종}}"}</li>
                                          <li>{"{{설명}}"}</li>
                                          <li>{"{{직원수}}"}</li>
                                          <li>{"{{설립연도}}"}</li>
                                        </ul>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">위치 정보:</p>
                                        <ul className="space-y-0.5 ml-2 text-[11px]">
                                          <li>{"{{국가}}"}</li>
                                          <li>{"{{도시}}"}</li>
                                          <li>{"{{주/도}}"}</li>
                                          <li>{"{{주소}}"}</li>
                                        </ul>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">연락처:</p>
                                        <ul className="space-y-0.5 ml-2 text-[11px]">
                                          <li>{"{{담당자명}}"}</li>
                                          <li>{"{{이메일}}"}</li>
                                        </ul>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-medium text-foreground">리드 관리:</p>
                                        <ul className="space-y-0.5 ml-2 text-[11px]">
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
                              <strong>제목:</strong> {step.emailSubject}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <strong>본문:</strong> {step.emailBodyText?.substring(0, 100)}
                              {(step.emailBodyText?.length || 0) > 100 && "..."}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              발송 시간: {step.scheduledHour ?? 9}:
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

        <div className="flex justify-end gap-2 pt-4 border-t mt-4 flex-shrink-0 bg-white dark:bg-gray-950">
          <Button variant="outline" onClick={onClose} disabled={bulkEnroll.isPending}>
            <X className="h-4 w-4 mr-1" />
            취소
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={
              !selectedSequenceId ||
              !selectedEmailAccountId ||
              editedSteps.length === 0 ||
              bulkEnroll.isPending
            }
          >
            <Send className="h-4 w-4 mr-1" />
            {bulkEnroll.isPending ? "발송 중..." : "시퀀스 실행"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
