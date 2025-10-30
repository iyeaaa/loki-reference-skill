import { ExternalLink } from "lucide-react"
import { useEffect, useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  useCustomerGroupMembers,
  useCustomerGroupsByWorkspace,
} from "@/lib/api/hooks/customer-groups"
import { useSequenceEnrollments } from "@/lib/api/hooks/sequences"
import { useSuspenseUserWorkspaces } from "@/lib/api/hooks/workspaces"
import type { CustomerGroupMember } from "@/lib/api/types/customer-group"
import type { Sequence, SequenceStatus } from "@/lib/api/types/sequence"
import { useAuth } from "@/lib/auth-provider"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

// Extended type to include joined lead data
interface CustomerGroupMemberWithLead extends CustomerGroupMember {
  leadCompanyName?: string
  leadBusinessType?: string
}

interface SequenceFormProps {
  sequence?: Sequence
  isEdit?: boolean
  onSave: (sequenceData: unknown) => Promise<void> | void
  onCancel: () => void
  stepsCount?: number
}

export function SequenceForm({
  sequence,
  isEdit = false,
  onSave,
  onCancel,
  stepsCount = 0,
}: SequenceFormProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { selectedWorkspace } = useWorkspace()

  // Fetch user's workspaces only (owned or member)
  // Use a dummy UUID if user is not available to satisfy the hook call rules
  const { data: allWorkspaces = [] } = useSuspenseUserWorkspaces(
    user?.id || "00000000-0000-0000-0000-000000000000",
  )

  // Only use workspaces if user exists
  const workspaces = user?.id ? allWorkspaces : []

  // Parse selectedLeadIds from JSON string with error handling
  const initialSelectedLeadIds = (() => {
    if (!sequence?.selectedLeadIds) return []
    try {
      const parsed = JSON.parse(sequence.selectedLeadIds)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.error("Failed to parse selectedLeadIds:", error)
      return []
    }
  })()

  // Get initial workspace ID - use selected workspace if not editing and not "all"
  const initialWorkspaceId =
    sequence?.workspaceId ||
    (!isEdit && selectedWorkspace?.id && selectedWorkspace.id !== "all" ? selectedWorkspace.id : "")

  const [formData, setFormData] = useState({
    name: sequence?.name || "",
    description: sequence?.description || "",
    workspaceId: initialWorkspaceId,
    status: (sequence?.status || "draft") as SequenceStatus,
    customerGroupId: sequence?.customerGroupId || "",
  })

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(initialSelectedLeadIds)
  const [showLeadSelection, setShowLeadSelection] = useState(false)

  const { data: customerGroups } = useCustomerGroupsByWorkspace(
    formData.workspaceId,
    Boolean(formData.workspaceId),
  )

  // Check if sequence has any enrollments (to disable customer group change)
  const { data: enrollmentsData } = useSequenceEnrollments(
    sequence?.id || "",
    1,
    1,
    Boolean(isEdit && sequence?.id),
  )
  const hasEnrollments = (enrollmentsData?.total || 0) > 0

  // Fetch customer group members when group is selected and lead selection is shown
  const { data: membersData } = useCustomerGroupMembers(
    formData.customerGroupId || "",
    1,
    1000,
    Boolean(formData.customerGroupId) && showLeadSelection,
  )

  const members = (membersData?.members || []) as CustomerGroupMemberWithLead[]

  const nameId = useId()
  const descriptionId = useId()
  const selectAllId = useId()

  const customerGroupId = formData.customerGroupId

  // Reset selectedLeadIds when customer group changes (only in create mode)
  // biome-ignore lint/correctness/useExhaustiveDependencies: isEdit doesn't change during component lifecycle
  useEffect(() => {
    if (!isEdit) {
      setSelectedLeadIds([])
    }
  }, [customerGroupId])

  const handleToggleAllLeads = () => {
    if (selectedLeadIds.length === members.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(members.map((m) => m.leadId))
    }
  }

  const handleToggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 고객그룹 필수 검증
    if (!formData.customerGroupId) {
      toast.error(t("sequences.toast.selectCustomerGroup"))
      return
    }

    onSave({
      ...formData,
      selectedLeadIds: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={nameId}>{t("sequences.form.sequenceName")}</Label>
        <Input
          id={nameId}
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          placeholder={t("sequences.form.sequenceNamePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={descriptionId}>{t("sequences.form.description")}</Label>
        <Textarea
          id={descriptionId}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={t("sequences.form.descriptionPlaceholder")}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerGroup">{t("sequences.form.workspace")}</Label>
        <Combobox
          options={workspaces.map((workspace) => ({
            value: workspace.id,
            label: workspace.name,
            sublabel: workspace.description || undefined,
          }))}
          value={formData.workspaceId}
          onValueChange={(value) => setFormData({ ...formData, workspaceId: value })}
          placeholder={t("sequences.form.workspacePlaceholder")}
          searchPlaceholder={t("sequences.form.workspaceSearchPlaceholder")}
          emptyText={t("sequences.form.workspaceEmptyText")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerGroup" className="flex items-center gap-2">
          {t("sequences.form.customerGroup")}
          <span className="text-red-500">*</span>
        </Label>
        <Select
          value={formData.customerGroupId}
          onValueChange={(value) => setFormData({ ...formData, customerGroupId: value })}
          disabled={!formData.workspaceId || hasEnrollments}
          required
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                formData.workspaceId ? "고객그룹 선택 (필수)" : "먼저 워크스페이스를 선택하세요"
              }
            />
          </SelectTrigger>
          {customerGroups && customerGroups.length === 0 && (
            <SelectContent>
              <SelectItem disabled value="none">
                고객그룹이 없습니다.
              </SelectItem>
            </SelectContent>
          )}
          {customerGroups && customerGroups.length > 0 && (
            <SelectContent>
              {customerGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group.leadCount || 0}개 리드)
                </SelectItem>
              ))}
            </SelectContent>
          )}
        </Select>
        {customerGroups && customerGroups.length === 0 && formData.workspaceId && (
          <div className="rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-3 mt-2">
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-2">
              ⚠️ 선택한 워크스페이스에 고객 그룹이 없습니다
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
              시퀀스를 생성하려면 먼저 고객 그룹을 만들어야 합니다.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => window.open("/customer-groups", "_blank")}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              고객 그룹 생성하러 가기
            </Button>
          </div>
        )}
        {hasEnrollments ? (
          <p className="text-xs text-amber-600">
            ⚠️ 이미 실행 이력이 있는 시퀀스는 고객그룹을 변경할 수 없습니다
          </p>
        ) : customerGroups && customerGroups.length > 0 ? (
          <p className="text-xs text-gray-500">
            💡 워크플로우 실행을 위해 고객그룹을 반드시 선택해야 합니다
          </p>
        ) : null}
      </div>

      {/* 리드 선택 섹션 */}
      {formData.customerGroupId && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">이메일 대상 선택 (선택사항)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowLeadSelection(!showLeadSelection)}
            >
              {showLeadSelection ? "접기" : "특정 고객 선택"}
            </Button>
          </div>

          {!showLeadSelection && (
            <p className="text-xs text-muted-foreground">
              기본값: 고객 그룹의 모든 리드에게 이메일 발송
              {selectedLeadIds.length > 0 && ` (현재 ${selectedLeadIds.length}명 선택됨)`}
            </p>
          )}

          {showLeadSelection && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-background p-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={selectAllId}
                    checked={members.length > 0 && selectedLeadIds.length === members.length}
                    onCheckedChange={handleToggleAllLeads}
                  />
                  <Label htmlFor={selectAllId} className="text-sm font-medium cursor-pointer">
                    전체 선택 ({selectedLeadIds.length}/{members.length})
                  </Label>
                </div>
                {selectedLeadIds.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLeadIds([])}
                  >
                    선택 해제
                  </Button>
                )}
              </div>

              <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border bg-background p-3">
                {members.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    고객 그룹에 리드가 없습니다.
                  </p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.leadId}
                      className="flex items-center gap-2 rounded-sm p-2 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={member.leadId}
                        checked={selectedLeadIds.includes(member.leadId)}
                        onCheckedChange={() => handleToggleLead(member.leadId)}
                      />
                      <Label htmlFor={member.leadId} className="flex-1 text-sm cursor-pointer">
                        <span className="font-medium">{member.leadCompanyName}</span>
                        {member.leadBusinessType && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({member.leadBusinessType})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {selectedLeadIds.length > 0
                  ? `선택된 ${selectedLeadIds.length}명의 고객에게만 이메일이 발송됩니다.`
                  : "고객을 선택하지 않으면 고객 그룹의 모든 리드에게 발송됩니다."}
              </p>
            </div>
          )}
        </div>
      )}

      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="status">상태</Label>
          <Select
            value={formData.status}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                status: value as SequenceStatus,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">초안</SelectItem>
              <SelectItem value="active" disabled={stepsCount > 0}>
                활성 {stepsCount > 0 && "(스텝 기반은 토글 버튼 사용)"}
              </SelectItem>
              <SelectItem value="paused">일시정지</SelectItem>
              <SelectItem value="archived">보관됨</SelectItem>
              <SelectItem value="completed">발송완료</SelectItem>
            </SelectContent>
          </Select>
          {stepsCount > 0 && formData.status !== "active" && (
            <p className="text-xs text-amber-600">
              💡 스텝 기반 시퀀스는 목록의 활성화 토글 버튼을 사용하세요
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="min-w-[100px]">
          {isEdit ? "수정 완료" : "생성"}
        </Button>
      </div>
    </form>
  )
}
