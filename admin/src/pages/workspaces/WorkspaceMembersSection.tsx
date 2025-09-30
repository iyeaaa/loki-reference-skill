import { Trash2, UserPlus } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useRemoveWorkspaceMember,
  useUpdateMemberRole,
  useUpdateMemberStatus,
  useWorkspaceMembers,
} from "@/lib/api/hooks/workspaces"
import type { User } from "@/lib/api/types/user"
import { AddMemberDialog } from "./AddMemberDialog"

interface WorkspaceMembersSectionProps {
  workspaceId: string
  users: User[]
  isEdit: boolean
}

export function WorkspaceMembersSection({
  workspaceId,
  users,
  isEdit,
}: WorkspaceMembersSectionProps) {
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)

  const { data: members = [], isLoading } = useWorkspaceMembers(workspaceId, isEdit)
  const updateMemberRole = useUpdateMemberRole()
  const updateMemberStatus = useUpdateMemberStatus()
  const removeMember = useRemoveWorkspaceMember()

  const handleRoleChange = (memberId: string, newRole: string) => {
    updateMemberRole.mutate({
      workspaceId,
      memberId,
      role: newRole,
    })
  }

  const handleStatusChange = (memberId: string, newStatus: string) => {
    updateMemberStatus.mutate({
      workspaceId,
      memberId,
      status: newStatus,
    })
  }

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!confirm(`${memberName} 멤버를 제거하시겠습니까?`)) return

    removeMember.mutate({
      workspaceId,
      memberId,
    })
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "invited":
        return "secondary"
      case "inactive":
        return "outline"
      case "removed":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "활성"
      case "invited":
        return "초대됨"
      case "inactive":
        return "비활성"
      case "removed":
        return "제거됨"
      default:
        return status
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "소유자"
      case "admin":
        return "관리자"
      case "member":
        return "멤버"
      case "viewer":
        return "뷰어"
      default:
        return role
    }
  }

  if (!isEdit) {
    return (
      <Card className="p-4 bg-gray-50">
        <p className="text-sm text-gray-600">
          워크스페이스 생성 후 멤버를 추가할 수 있습니다.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">워크스페이스 멤버</h3>
        <Button size="sm" onClick={() => setShowAddMemberDialog(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          멤버 추가
        </Button>
      </div>

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-gray-600">로딩 중...</p>
        </Card>
      ) : members.length === 0 ? (
        <Card className="p-4 bg-gray-50">
          <p className="text-sm text-gray-600">등록된 멤버가 없습니다.</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>사용자</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>초대 날짜</TableHead>
                <TableHead>가입 날짜</TableHead>
                <TableHead className="w-[80px]">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.username}</TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">{getRoleLabel("owner")}</SelectItem>
                        <SelectItem value="admin">{getRoleLabel("admin")}</SelectItem>
                        <SelectItem value="member">{getRoleLabel("member")}</SelectItem>
                        <SelectItem value="viewer">{getRoleLabel("viewer")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={member.status}
                      onValueChange={(value) => handleStatusChange(member.id, value)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invited">
                          <Badge variant={getStatusBadgeVariant("invited")}>
                            {getStatusLabel("invited")}
                          </Badge>
                        </SelectItem>
                        <SelectItem value="active">
                          <Badge variant={getStatusBadgeVariant("active")}>
                            {getStatusLabel("active")}
                          </Badge>
                        </SelectItem>
                        <SelectItem value="inactive">
                          <Badge variant={getStatusBadgeVariant("inactive")}>
                            {getStatusLabel("inactive")}
                          </Badge>
                        </SelectItem>
                        <SelectItem value="removed">
                          <Badge variant={getStatusBadgeVariant("removed")}>
                            {getStatusLabel("removed")}
                          </Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {new Date(member.invitedAt).toLocaleDateString("ko-KR")}
                  </TableCell>
                  <TableCell>
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString("ko-KR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveMember(member.id, member.username || "")}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddMemberDialog
        workspaceId={workspaceId}
        users={users}
        existingMemberUserIds={members.map((m) => m.userId)}
        isOpen={showAddMemberDialog}
        onClose={() => setShowAddMemberDialog(false)}
      />
    </div>
  )
}