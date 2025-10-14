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
import { useCreateCustomerGroup } from "@/lib/api/hooks/customer-groups"
import type { Workspace } from "@/lib/api/types/workspace"

interface CreateGroupModalProps {
  workspaces: Workspace[]
  selectedWorkspaceId: string
  onWorkspaceChange?: (workspaceId: string) => void
  onSuccess?: (groupId: string) => void
}

export function CreateGroupModal({
  workspaces,
  selectedWorkspaceId,
  onWorkspaceChange,
  onSuccess,
}: CreateGroupModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId)
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")

  const groupNameId = useId()
  const groupDescriptionId = useId()
  const workspaceSelectId = useId()

  const createCustomerGroupMutation = useCreateCustomerGroup()

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

    try {
      const newGroup = await createCustomerGroupMutation.mutateAsync({
        workspaceId,
        name: groupName,
        description: groupDescription || undefined,
        isDynamic: false,
      })

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

      toast.success("고객 그룹이 생성되었습니다")
    } catch (error) {
      // 에러는 mutation에서 처리됨
      console.error("Failed to create customer group:", error)
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
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={createCustomerGroupMutation.isPending}
            >
              취소
            </Button>
            <Button
              type="button"
              onClick={handleCreateGroup}
              disabled={createCustomerGroupMutation.isPending || !groupName.trim() || !workspaceId}
            >
              {createCustomerGroupMutation.isPending ? (
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
