import { ChevronDown, ChevronRight, Trash2, UserPlus } from "lucide-react"
import React, { useState } from "react"
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
import { MemberIamSection } from "./MemberIamSection"

interface WorkspaceMembersSectionProps {
  workspaceId: string
  isEdit: boolean
  onAddMemberClick: () => void
}

export function WorkspaceMembersSection({
  workspaceId,
  isEdit,
  onAddMemberClick,
}: WorkspaceMembersSectionProps) {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
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

  const toggleExpand = (memberId: string) => {
    setExpandedMemberId((prev) => (prev === memberId ? null : memberId))
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default"
      case "inactive":
        return "secondary"
      case "removed":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "활성"
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
        <p className="text-sm text-gray-600">워크스페이스 생성 후 멤버를 추가할 수 있습니다.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">멤버 ({members.length})</h3>
        <Button type="button" size="sm" variant="outline" onClick={onAddMemberClick}>
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          추가
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-500 py-4 text-center">로딩 중...</div>
      ) : members.length === 0 ? (
        <Card className="p-4 bg-gray-50 border-dashed">
          <p className="text-sm text-gray-500 text-center">등록된 멤버가 없습니다.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-8 py-2 px-2"></TableHead>
                <TableHead className="py-2 px-2 text-xs font-medium">사용자</TableHead>
                <TableHead className="py-2 px-2 text-xs font-medium w-[100px]">역할</TableHead>
                <TableHead className="py-2 px-2 text-xs font-medium w-[80px]">상태</TableHead>
                <TableHead className="py-2 px-2 text-xs font-medium w-[80px]">초대일</TableHead>
                <TableHead className="py-2 px-2 text-xs font-medium w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <React.Fragment key={member.id}>
                  <TableRow
                    className={`cursor-pointer hover:bg-gray-50 ${expandedMemberId === member.id ? "bg-gray-50" : ""}`}
                    onClick={() => toggleExpand(member.id)}
                  >
                    <TableCell className="py-2 px-2">
                      {expandedMemberId === member.id ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="py-2 px-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{member.username}</span>
                        <span className="text-xs text-gray-500">{member.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.id, value)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[90px]">
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
                    <TableCell className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={member.status}
                        onValueChange={(value) => handleStatusChange(member.id, value)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[70px] p-1">
                          <Badge
                            variant={getStatusBadgeVariant(member.status)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {getStatusLabel(member.status)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{getStatusLabel("active")}</SelectItem>
                          <SelectItem value="inactive">{getStatusLabel("inactive")}</SelectItem>
                          <SelectItem value="removed">{getStatusLabel("removed")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="py-2 px-2 text-xs text-gray-500">
                      {new Date(member.invitedAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.id, member.username || "")}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedMemberId === member.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="p-0 bg-gray-50/50">
                        <MemberIamSection
                          memberId={member.id}
                          memberName={member.username || "Unknown"}
                          memberEmail={member.email}
                          workspaceId={workspaceId}
                          memberRole={member.role}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
