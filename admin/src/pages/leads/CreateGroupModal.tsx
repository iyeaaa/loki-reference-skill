import { Loader2, Plus } from "lucide-react"
import { useId, useState } from "react"
import toast from "react-hot-toast"
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
      toast.error("워크스페이스를 선택해주세요")
      return
    }

    if (!groupName.trim()) {
      toast.error("그룹명을 입력해주세요")
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
            `${leadsWithGroups.length}개의 리드는 이미 그룹에 속해있어 제외되었습니다.\n(${skippedLeadNames}${
              moreCount > 0 ? ` 외 ${moreCount}개` : ""
            })`,
            { duration: 5000 },
          )
        }

        if (leadsToAdd.length === 0) {
          toast.error(
            "그룹에 속하지 않은 리드가 없습니다. 모든 선택된 리드가 이미 그룹에 속해있습니다.",
          )
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

        toast.success(`고객 그룹이 생성되었고 ${leadsToAdd.length}개의 리드가 추가되었습니다`)
      } else {
        toast.success("고객 그룹이 생성되었습니다")
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
        <Plus className="h-4 w-4 mr-1" />새 그룹 생성
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 고객 그룹 생성</DialogTitle>
            <DialogDescription>
              새로운 고객 그룹을 생성합니다. 워크스페이스를 선택하고 그룹 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 워크스페이스 선택 */}
            <div className="space-y-2">
              <Label htmlFor={workspaceSelectId}>워크스페이스 *</Label>
              <Select value={workspaceId} onValueChange={setWorkspaceId}>
                <SelectTrigger id={workspaceSelectId}>
                  <SelectValue placeholder="워크스페이스 선택" />
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
              <Label htmlFor={groupNameId}>그룹명 *</Label>
              <Input
                id={groupNameId}
                placeholder="고객 그룹명을 입력하세요"
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
              <Label htmlFor={groupDescriptionId}>설명 (선택사항)</Label>
              <Textarea
                id={groupDescriptionId}
                placeholder="그룹 설명을 입력하세요"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
              취소
            </Button>
            <Button
              type="button"
              onClick={handleCreateGroup}
              disabled={isProcessing || !groupName.trim() || !workspaceId}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                "생성"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
