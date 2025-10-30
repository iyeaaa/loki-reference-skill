import { AlertCircle, Mail, Users } from "lucide-react"
import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCustomerGroupMembers } from "@/lib/api/hooks/customer-groups"
import { useEmailAccountsByWorkspace } from "@/lib/api/hooks/email-accounts"
import { useBulkEnrollWithScheduling, useSequenceSteps } from "@/lib/api/hooks/sequences"
import type { CustomerGroupMember } from "@/lib/api/types/customer-group"
import type { Sequence } from "@/lib/api/types/sequence"

// Extended type to include joined lead data
interface CustomerGroupMemberWithLead extends CustomerGroupMember {
  leadCompanyName?: string
  leadBusinessType?: string
}

interface Lead {
  id: string
  companyName?: string
  businessType?: string
}

interface EnrollLeadsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sequence: Sequence
}

export function EnrollLeadsDialog({ open, onOpenChange, sequence }: EnrollLeadsDialogProps) {
  const [selectedEmailAccount, setSelectedEmailAccount] = useState<string>("")

  // 이메일 계정 목록 조회
  const { data: emailAccounts = [] } = useEmailAccountsByWorkspace(
    sequence.workspaceId,
    Boolean(sequence.workspaceId),
  )

  // 시퀀스 스텝 목록 조회 (과거 시간 검증용)
  const { data: stepsData } = useSequenceSteps(sequence.id, Boolean(sequence.id))
  const steps = stepsData || []

  // 고객그룹의 멤버 목록 조회
  const { data: membersData } = useCustomerGroupMembers(
    sequence.customerGroupId || "",
    1,
    1000,
    Boolean(sequence.customerGroupId),
  )

  const members = (membersData?.members || []) as CustomerGroupMemberWithLead[]
  const leads: Lead[] = members.map((member) => ({
    id: member.leadId,
    companyName: member.leadCompanyName,
    businessType: member.leadBusinessType,
  }))
  const activeEmailAccounts = emailAccounts.filter((acc) => acc.status === "active")

  // 첫 번째 활성 이메일 계정 자동 선택
  useEffect(() => {
    if (activeEmailAccounts.length > 0 && !selectedEmailAccount) {
      setSelectedEmailAccount(activeEmailAccounts[0].id)
    }
  }, [activeEmailAccounts, selectedEmailAccount])

  const bulkEnroll = useBulkEnrollWithScheduling()

  const handleEnroll = () => {
    if (!selectedEmailAccount) {
      alert("발송할 이메일 계정을 선택하세요.")
      return
    }

    if (leads.length === 0) {
      alert("등록할 리드가 없습니다.")
      return
    }

    // ✅ 과거 시간 스케줄 검증
    const now = new Date()
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000
    const nowKST = new Date(now.getTime() + KST_OFFSET_MS)
    const currentHour = nowKST.getUTCHours()
    const currentMinute = nowKST.getUTCMinutes()

    for (const step of steps) {
      const delayDays = step.delayDays || 0
      const scheduledHour = step.scheduledHour ?? 9
      const scheduledMinute = step.scheduledMinute ?? 0

      // delayDays가 0이면 오늘 발송인데, 스케줄 시간이 현재 시간보다 이전이면 안됨
      if (delayDays === 0) {
        const scheduledTimeInMinutes = scheduledHour * 60 + scheduledMinute
        const currentTimeInMinutes = currentHour * 60 + currentMinute

        if (scheduledTimeInMinutes <= currentTimeInMinutes) {
          toast.error(
            `스텝 ${step.stepOrder}: 스케줄 시간(${String(scheduledHour).padStart(2, "0")}:${String(
              scheduledMinute,
            ).padStart(2, "0")})이 현재 시간(${String(currentHour).padStart(2, "0")}:${String(
              currentMinute,
            ).padStart(
              2,
              "0",
            )})보다 이전입니다.\n\n시퀀스를 수정하여 발송 지연일을 1일 이상으로 설정하거나, 시간을 현재 시간 이후로 변경해주세요.`,
            { duration: 6000 },
          )
          return
        }
      }
    }

    bulkEnroll.mutate(
      {
        sequenceId: sequence.id,
        data: {
          leadIds: leads.map((lead) => lead.id),
          userEmailAccountId: selectedEmailAccount,
        },
      },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            시퀀스 실행 - 리드 등록
          </DialogTitle>
          <DialogDescription>
            선택된 고객그룹의 리드들을 시퀀스에 등록하고 자동 이메일 발송을 시작합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 시퀀스 정보 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">시퀀스 정보</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">시퀀스명:</span>
                <span className="font-medium text-blue-900">{sequence.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">고객그룹:</span>
                <span className="font-medium text-blue-900">
                  {sequence.customerGroupName || "지정 안 됨"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">상태:</span>
                <Badge
                  variant={sequence.status === "active" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {sequence.status === "active"
                    ? "활성"
                    : sequence.status === "draft"
                      ? "초안"
                      : sequence.status === "paused"
                        ? "일시정지"
                        : "보관됨"}
                </Badge>
              </div>
            </div>
          </div>

          {/* 경고: 고객그룹 미지정 */}
          {!sequence.customerGroupId && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-900">고객그룹이 지정되지 않았습니다</p>
                  <p className="text-sm text-orange-700 mt-1">
                    시퀀스를 편집하여 고객그룹을 먼저 지정해주세요.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 대상 리드 정보 */}
          {sequence.customerGroupId && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">등록 대상 리드</h4>
                <Badge variant="secondary">{leads.length}명</Badge>
              </div>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  고객그룹에 리드가 없습니다.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {leads.slice(0, 10).map((lead) => (
                    <div
                      key={lead.id}
                      className="text-sm flex items-center justify-between py-1 border-b last:border-0"
                    >
                      <span className="font-medium">{lead.companyName}</span>
                      <span className="text-xs text-muted-foreground">{lead.businessType}</span>
                    </div>
                  ))}
                  {leads.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      외 {leads.length - 10}개 회사
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 발송 이메일 계정 선택 */}
          <div className="space-y-2">
            <Label htmlFor="emailAccount">
              발송 이메일 계정 <span className="text-red-500">*</span>
            </Label>
            {activeEmailAccounts.length === 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">활성화된 이메일 계정이 없습니다</p>
                    <p className="text-sm text-red-700 mt-1">
                      이메일 계정 페이지에서 계정을 추가하고 활성화해주세요.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <Select value={selectedEmailAccount} onValueChange={setSelectedEmailAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="이메일 계정 선택" />
                </SelectTrigger>
                <SelectContent>
                  {activeEmailAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {account.emailAddress}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 실행 안내 */}
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2">실행 시 동작:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ 선택된 리드들이 시퀀스에 등록됩니다</li>
              <li>✓ 첫 번째 스텝이 즉시 또는 예약 발송됩니다</li>
              <li>✓ 이후 스텝은 설정된 대기 시간에 따라 자동 발송됩니다</li>
              <li>✓ 등록 현황 탭에서 진행 상황을 확인할 수 있습니다</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            onClick={handleEnroll}
            disabled={
              !sequence.customerGroupId ||
              leads.length === 0 ||
              !selectedEmailAccount ||
              bulkEnroll.isPending
            }
          >
            {bulkEnroll.isPending ? "등록 중..." : `${leads.length}명 등록 및 실행`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
