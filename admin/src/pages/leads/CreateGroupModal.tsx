import { Loader2, Plus } from "lucide-react"
import { useId, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useBulkAddGroupMembers, useCreateCustomerGroup } from "@/lib/api/hooks/customer-groups"
import { customerGroupsApi } from "@/lib/api/services/customer-groups"
import type { Workspace } from "@/lib/api/types/workspace"

interface CreateGroupModalProps {
  workspaces: Workspace[]
  selectedWorkspaceId: string
  onWorkspaceChange?: (workspaceId: string) => void
  onSuccess?: (groupId: string) => void
  selectedLeadIds?: string[]
  currentLeadsData?: { id: string; companyName?: string }[]
}

export function CreateGroupModal({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onSuccess,
  selectedLeadIds = [],
  currentLeadsData = [],
}: CreateGroupModalProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const groupNameId = useId()
  const groupDescriptionId = useId()
  const workspaceSelectId = useId()

  const createCustomerGroupMutation = useCreateCustomerGroup()
  const bulkAddGroupMembersMutation = useBulkAddGroupMembers()

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      // 모달 열릴 때 현재 선택된 워크스페이스로 초기화
      const initialWorkspaceId =
        selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id || ""
      setWorkspaceId(initialWorkspaceId)
      setGroupName("")
      setGroupDescription("")
    }
  }

  const handleCreateGroup = async () => {
    if (!workspaceId) {
      toast.error(t("leads.group.error.selectWorkspace"))
      return
    }

    if (!groupName.trim()) {
      toast.error(t("leads.group.error.enterGroupName"))
      return
    }

    setIsProcessing(true)

    try {
      // 1. 선택된 리드들이 그룹에 속해있지 않은지 확인
      let leadsToAdd: string[] = []

      if (selectedLeadIds.length > 0) {
        // 각 리드가 속한 그룹들을 확인
        const leadGroupChecks = await Promise.all(
          selectedLeadIds.map(async (leadId) => {
            try {
              const groups = await customerGroupsApi.getLeadGroups(leadId)
              return { leadId, hasGroups: groups.length > 0 }
            } catch (error) {
              console.error(`Failed to check groups for lead ${leadId}:`, error)
              return { leadId, hasGroups: false }
            }
          }),
        )

        // 그룹에 속해있지 않은 리드들만 필터링
        leadsToAdd = leadGroupChecks
          .filter((check) => !check.hasGroups)
          .map((check) => check.leadId)

        // 그룹에 속해있는 리드들이 있다면 사용자에게 알림
        const leadsWithGroups = leadGroupChecks.filter((check) => check.hasGroups)
        if (leadsWithGroups.length > 0) {
          const skippedLeadNames = leadsWithGroups
            .map((check) => {
              const lead = currentLeadsData.find((l) => l.id === check.leadId)
              return lead?.companyName || check.leadId
            })
            .slice(0, 3)
            .join(", ")

          const moreCount = Math.max(0, leadsWithGroups.length - 3)

          toast(
            `${leadsWithGroups.length}${t(
              "leads.group.warning.leadsAlreadyInGroup",
            )}\n(${skippedLeadNames}${moreCount > 0 ? ` 외 ${moreCount}개` : ""})`,
            { duration: 5000 },
          )
        }

        if (leadsToAdd.length === 0) {
          toast.error(t("leads.group.warning.noLeadsAvailable"))
          setIsProcessing(false)
          return
        }
      }

      // 2. 그룹 생성
      const newGroup = await createCustomerGroupMutation.mutateAsync({
        workspaceId,
        name: groupName,
        description: groupDescription || undefined,
        isDynamic: false,
      })

      // 3. 선택된 리드들을 새 그룹에 추가 (그룹에 속하지 않은 리드만)
      if (leadsToAdd.length > 0) {
        await bulkAddGroupMembersMutation.mutateAsync({
          groupId: newGroup.id,
          leadIds: leadsToAdd,
        })

        toast.success(`${t("leads.group.success.createdWithLeads")} ${leadsToAdd.length}개`)
      } else {
        toast.success(t("leads.group.success.created"))
      }

      // 모달 닫기 및 폼 초기화
      setIsOpen(false)
      setGroupName("")
      setGroupDescription("")

      // 워크스페이스가 변경되었다면 부모 컴포넌트에 알림
      if (onWorkspaceChange && workspaceId !== selectedWorkspaceId) {
        onWorkspaceChange(workspaceId)
      }

      // 성공 콜백 호출
      if (onSuccess) {
        onSuccess(newGroup.id)
      }
    } catch (error) {
      // 에러는 mutation에서 처리됨
      console.error("Failed to create customer group:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCancel = () => {
    setIsOpen(false)
    setGroupName("")
    setGroupDescription("")
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        <Plus className="h-4 w-4 mr-1" />
        {t("leads.group.createNewGroup")}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leads.group.createGroupTitle")}</DialogTitle>
            <DialogDescription>{t("leads.group.createGroupDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 워크스페이스 선택 */}
            <div className="space-y-2">
              <Label htmlFor={workspaceSelectId}>{t("leads.group.workspaceRequired")}</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger id={workspaceSelectId}>
                  <SelectValue placeholder={t("leads.group.workspacePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 그룹명 입력 */}
            <div className="space-y-2">
              <Label htmlFor={groupNameId}>{t("leads.group.groupNameRequired")}</Label>
              <Input
                id={groupNameId}
                placeholder={t("leads.group.groupNamePlaceholder")}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleCreateGroup()
                  }
                }}
              />
            </div>

            {/* 설명 입력 */}
            <div className="space-y-2">
              <Label htmlFor={groupDescriptionId}>{t("leads.group.descriptionOptional")}</Label>
              <Textarea
                id={groupDescriptionId}
                placeholder={t("leads.group.descriptionPlaceholder")}
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
              {t("leads.form.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleCreateGroup}
              disabled={isProcessing || !groupName.trim() || !workspaceId}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("leads.group.creating")}
                </>
              ) : (
                t("leads.group.create")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
