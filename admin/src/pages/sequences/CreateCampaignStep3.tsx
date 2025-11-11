import { Check, Clock, Mail, Users } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useCustomerGroup } from "@/lib/api/hooks/customer-groups"
import { useCreateSequence, useCreateSequenceStep } from "@/lib/api/hooks/sequences"
import { useWorkspaces } from "@/lib/api/hooks/workspaces"

interface EmailStep {
  stepOrder: number
  delayDays: number
  scheduledHour: number
  scheduledMinute: number
  emailSubject: string
  emailBodyText: string
  files?: File[] // 첨부 파일
}

interface CreateCampaignStep3Props {
  data: {
    workspaceId: string
    customerGroupId: string
    selectedLeadIds: string[]
    name: string
    description: string
    steps: EmailStep[]
    memo: string
  }
  onChange: (data: { name: string; description: string; memo: string }) => void
}

export function CreateCampaignStep3({ data, onChange }: CreateCampaignStep3Props) {
  const navigate = useNavigate()
  const [name, setName] = useState(data.name)
  const [description, setDescription] = useState(data.description)
  const [memo, setMemo] = useState(data.memo)

  const { data: workspacesData } = useWorkspaces()
  const { data: customerGroup } = useCustomerGroup(
    data.customerGroupId,
    Boolean(data.customerGroupId),
  )

  const createSequence = useCreateSequence()
  const createSequenceStep = useCreateSequenceStep()

  const workspace = workspacesData?.workspaces.find((w) => w.id === data.workspaceId)
  const recipientCount =
    data.selectedLeadIds.length > 0 ? data.selectedLeadIds.length : customerGroup?.leadCount || 0

  // biome-ignore lint/correctness/useExhaustiveDependencies: adding onChange to dependencies will cause infinite loop
  useEffect(() => {
    onChange({ name, description, memo })
  }, [name, description, memo])

  const handleSaveDraft = async () => {
    if (!name.trim()) {
      toast.error("캠페인 이름을 입력해주세요")
      return
    }

    createSequence.mutate(
      {
        workspaceId: data.workspaceId,
        customerGroupId: data.customerGroupId,
        name: name.trim(),
        description: description.trim() || undefined,
        status: "draft",
        selectedLeadIds: data.selectedLeadIds.length > 0 ? data.selectedLeadIds : undefined,
      },
      {
        onSuccess: async (sequence) => {
          // Create steps if any
          if (data.steps.length > 0) {
            try {
              for (const step of data.steps) {
                console.log(
                  "📎 CreateCampaignStep3 - Creating step with files:",
                  step.files?.length || 0,
                )
                await createSequenceStep.mutateAsync({
                  data: {
                    sequenceId: sequence.id,
                    stepOrder: step.stepOrder,
                    delayDays: step.delayDays,
                    scheduledHour: step.scheduledHour,
                    scheduledMinute: step.scheduledMinute,
                    emailSubject: step.emailSubject,
                    emailBodyText: step.emailBodyText,
                  },
                  files: step.files,
                })
              }
              toast.success("초안이 저장되었습니다")
            } catch (error) {
              toast.error(
                `스텝 생성 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
              )
            }
          } else {
            toast.success("초안이 저장되었습니다")
          }
          navigate("/sequences")
        },
        onError: (error) => {
          toast.error(`오류: ${error.message}`)
        },
      },
    )
  }

  const handleSaveReady = async () => {
    if (!name.trim()) {
      toast.error("캠페인 이름을 입력해주세요")
      return
    }

    createSequence.mutate(
      {
        workspaceId: data.workspaceId,
        customerGroupId: data.customerGroupId,
        name: name.trim(),
        description: description.trim() || undefined,
        status: "ready",
        selectedLeadIds: data.selectedLeadIds.length > 0 ? data.selectedLeadIds : undefined,
      },
      {
        onSuccess: async (sequence) => {
          // Create steps if any
          if (data.steps.length > 0) {
            try {
              for (const step of data.steps) {
                console.log(
                  "📎 CreateCampaignStep3 - Creating step (ready) with files:",
                  step.files?.length || 0,
                )
                await createSequenceStep.mutateAsync({
                  data: {
                    sequenceId: sequence.id,
                    stepOrder: step.stepOrder,
                    delayDays: step.delayDays,
                    scheduledHour: step.scheduledHour,
                    scheduledMinute: step.scheduledMinute,
                    emailSubject: step.emailSubject,
                    emailBodyText: step.emailBodyText,
                  },
                  files: step.files,
                })
              }
              toast.success("캠페인이 준비 상태로 저장되었습니다")
            } catch (error) {
              toast.error(
                `스텝 생성 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
              )
            }
          } else {
            toast.success("캠페인이 준비 상태로 저장되었습니다")
          }
          navigate("/sequences")
        },
        onError: (error) => {
          toast.error(`오류: ${error.message}`)
        },
      },
    )
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-6 pr-4">
        {/* Campaign Name & Description */}
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">캠페인 정보</h3>
          <div className="space-y-2">
            <Label>캠페인 이름 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 신규 고객 온보딩 캠페인"
            />
          </div>
          <div className="space-y-2">
            <Label>설명</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="캠페인에 대한 설명을 입력하세요..."
              rows={3}
            />
          </div>
        </div>

        {/* Recipients Summary */}
        <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">수신자 요약</h3>
            <Check className="h-4 w-4 text-green-600 ml-auto" />
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">워크스페이스</span>
              <span className="font-medium">{workspace?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">고객그룹</span>
              <span className="font-medium">{customerGroup?.name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">수신자 수</span>
              <span className="font-medium">{recipientCount}명</span>
            </div>
            {data.selectedLeadIds.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-xs text-blue-900 dark:text-blue-200">
                특정 고객 {data.selectedLeadIds.length}명에게만 발송됩니다
              </div>
            )}
          </div>
        </div>

        {/* Scenario Summary */}
        <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">시나리오 요약</h3>
            <Check className="h-4 w-4 text-green-600 ml-auto" />
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground mb-3">
              총 {data.steps.length}개의 이메일 스텝
            </div>
            {data.steps.map((step) => (
              <div key={step.stepOrder} className="rounded-lg border bg-background p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold flex-shrink-0">
                    {step.stepOrder}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Clock className="h-3 w-3" />
                      {step.delayDays === 0 ? "즉시 발송" : `${step.delayDays}일 후`}
                      {" · "}
                      {String(step.scheduledHour).padStart(2, "0")}:
                      {String(step.scheduledMinute).padStart(2, "0")}
                    </div>
                    <p className="text-sm font-medium mb-1">{step.emailSubject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {step.emailBodyText}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Memo */}
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="font-semibold">메모 (선택사항)</h3>
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="캠페인에 대한 추가 메모를 입력하세요..."
            rows={4}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={createSequence.isPending}
            className="flex-1"
          >
            초안 저장
          </Button>
          <Button onClick={handleSaveReady} disabled={createSequence.isPending} className="flex-1">
            {createSequence.isPending ? "저장 중..." : "준비 완료"}
          </Button>
        </div>

        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-3">
          <p className="text-xs text-blue-900 dark:text-blue-200">
            <strong>초안 저장:</strong> 캠페인이 초안 상태로 저장되며, 나중에 수정할 수 있습니다.
            <br />
            <strong>준비 완료:</strong> 캠페인이 준비 상태로 저장되며, 바로 활성화할 수 있습니다.
          </p>
        </div>
      </div>
    </ScrollArea>
  )
}
