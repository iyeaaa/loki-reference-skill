import { useEffect, useId, useState } from "react"
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
import { customerGroupsApi } from "@/lib/api/services/customer-groups"
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { LeadStatus } from "@/lib/api/types/lead"
import type { Workspace } from "@/lib/api/types/workspace"

interface BulkActionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (actionType: string, value: string | string[]) => void
  leadCount: number
  actionType: "status" | "businessType" | "copyToGroup" | null
  customerGroups?: CustomerGroup[]
  workspaces?: Workspace[]
  currentWorkspaceId?: string
}

export function BulkActionModal({
  isOpen,
  onClose,
  onConfirm,
  leadCount,
  actionType,
  customerGroups = [],
  workspaces = [],
  currentWorkspaceId,
}: BulkActionModalProps) {
  const [selectedValue, setSelectedValue] = useState<string>("")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    // 현재 워크스페이스가 "all"이 아니면 기본값으로 설정
    return currentWorkspaceId && currentWorkspaceId !== "all" ? currentWorkspaceId : "all"
  })
  const [allGroups, setAllGroups] = useState<CustomerGroup[]>([])
  const [isLoadingGroups, setIsLoadingGroups] = useState(false)
  const statusSelectId = useId()
  const businessTypeInputId = useId()
  const groupSelectId = useId()
  const workspaceSelectId = useId()

  const handleConfirm = () => {
    if (!actionType || !selectedValue) return

    onConfirm(actionType, selectedValue)
    setSelectedValue("")
    onClose()
  }

  const handleClose = () => {
    setSelectedValue("")
    // 기본값으로 초기화
    setSelectedWorkspaceId(
      currentWorkspaceId && currentWorkspaceId !== "all" ? currentWorkspaceId : "all",
    )
    setAllGroups([])
    onClose()
  }

  // 모달이 열릴 때마다 워크스페이스 선택을 현재 워크스페이스로 초기화
  useEffect(() => {
    if (isOpen && actionType === "copyToGroup") {
      setSelectedWorkspaceId(
        currentWorkspaceId && currentWorkspaceId !== "all" ? currentWorkspaceId : "all",
      )
    }
  }, [isOpen, actionType, currentWorkspaceId])

  // 워크스페이스 선택에 따라 그룹 조회
  useEffect(() => {
    if (!isOpen || actionType !== "copyToGroup") {
      setAllGroups([])
      return
    }

    const loadGroups = async () => {
      if (selectedWorkspaceId === "all" && workspaces.length > 0) {
        // 모든 워크스페이스의 그룹 조회
        setIsLoadingGroups(true)
        try {
          const allWorkspaceIds = workspaces.map((w) => w.id)
          const response = await customerGroupsApi.list({
            page: 1,
            limit: 1000,
            workspaceIds: allWorkspaceIds,
          })
          setAllGroups(response.customerGroups)
        } catch (error) {
          console.error("Failed to load all groups:", error)
          setAllGroups([])
        } finally {
          setIsLoadingGroups(false)
        }
      } else if (selectedWorkspaceId && selectedWorkspaceId !== "all") {
        // 특정 워크스페이스의 그룹만 조회
        setIsLoadingGroups(true)
        try {
          const groups = await customerGroupsApi.getByWorkspace(selectedWorkspaceId)
          setAllGroups(groups)
        } catch (error) {
          console.error("Failed to load groups:", error)
          setAllGroups([])
        } finally {
          setIsLoadingGroups(false)
        }
      } else {
        setAllGroups([])
      }
    }

    loadGroups()
  }, [isOpen, actionType, selectedWorkspaceId, workspaces])

  // 워크스페이스 선택 시 그룹 목록 초기화
  useEffect(() => {
    if (selectedWorkspaceId) {
      setSelectedValue("")
    }
  }, [selectedWorkspaceId])

  // 사용할 그룹 목록 결정
  const availableGroups =
    actionType === "copyToGroup" && workspaces.length > 0 ? allGroups : customerGroups

  // 그룹 이름에 워크스페이스 정보 추가
  const getGroupDisplayName = (group: CustomerGroup) => {
    if (actionType !== "copyToGroup" || workspaces.length === 0) {
      return `${group.name} (${group.leadCount || 0}개 리드)`
    }
    // workspaceName이 있으면 우선 사용, 없으면 workspaces 배열에서 찾기
    const workspaceName =
      group.workspaceName ||
      workspaces.find((w) => w.id === group.workspaceId)?.name ||
      "알 수 없음"
    return `${group.name} [${workspaceName}] (${group.leadCount || 0}개 리드)`
  }

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: "new", label: "신규" },
    { value: "contacted", label: "연락됨" },
    { value: "qualified", label: "적격" },
    { value: "unqualified", label: "부적격" },
    { value: "converted", label: "전환됨" },
    { value: "lost", label: "실패" },
    { value: "unsubscribed", label: "구독취소" },
  ]

  const getTitle = () => {
    switch (actionType) {
      case "status":
        return "리드 상태 일괄 변경"
      case "businessType":
        return "업종 일괄 변경"
      case "copyToGroup":
        return "고객 그룹에 복사"
      default:
        return "일괄 작업"
    }
  }

  const getDescription = () => {
    switch (actionType) {
      case "copyToGroup":
        return `선택한 ${leadCount}개의 리드를 다른 고객 그룹에 복사합니다. 기존 그룹 소속은 유지됩니다.`
      default:
        return `선택한 ${leadCount}개의 리드에 대해 작업을 수행합니다.`
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {actionType === "status" && (
            <div className="space-y-2">
              <Label htmlFor={statusSelectId}>상태 선택</Label>
              <Select value={selectedValue} onValueChange={setSelectedValue}>
                <SelectTrigger id={statusSelectId}>
                  <SelectValue placeholder="상태를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "businessType" && (
            <div className="space-y-2">
              <Label htmlFor={businessTypeInputId}>업종</Label>
              <Input
                id={businessTypeInputId}
                value={selectedValue}
                onChange={(e) => setSelectedValue(e.target.value)}
                placeholder="업종을 입력하세요 (예: IT, 제조업, 서비스업)"
              />
            </div>
          )}

          {actionType === "copyToGroup" && (
            <div className="space-y-4">
              {workspaces.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor={workspaceSelectId}>워크스페이스 선택</Label>
                  <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                    <SelectTrigger id={workspaceSelectId}>
                      <SelectValue placeholder="워크스페이스를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">모든 워크스페이스</SelectItem>
                      {workspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    💡 워크스페이스를 선택하면 해당 워크스페이스의 그룹만 표시됩니다.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor={groupSelectId}>대상 고객 그룹</Label>
                <Select value={selectedValue} onValueChange={setSelectedValue}>
                  <SelectTrigger id={groupSelectId}>
                    <SelectValue
                      placeholder={isLoadingGroups ? "그룹 로딩 중..." : "그룹을 선택하세요"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingGroups ? (
                      <SelectItem disabled value="loading">
                        그룹을 불러오는 중...
                      </SelectItem>
                    ) : availableGroups.length === 0 ? (
                      <SelectItem disabled value="none">
                        사용 가능한 그룹이 없습니다
                      </SelectItem>
                    ) : (
                      availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {getGroupDisplayName(group)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  💡 선택한 리드들이 해당 그룹에 추가됩니다 (기존 그룹 소속 유지)
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedValue}>
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
