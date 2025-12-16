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

type WorkspaceMembersSectionProps = {
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
    if (!confirm(`${memberName} 멤버를 제거하시겠습니까?`)) {
      return
    }

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
      <Card className="bg-gray-50 p-4">
        <p className="text-gray-600 text-sm">워크스페이스 생성 후 멤버를 추가할 수 있습니다.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-700 text-sm">멤버 ({members.length})</h3>
        <Button onClick={onAddMemberClick} size="sm" type="button" variant="outline">
          <UserPlus className="mr-1 h-3.5 w-3.5" />
          추가
        </Button>
      </div>

      {isLoading ? (
        <div className="py-4 text-center text-gray-500 text-sm">로딩 중...</div>
      ) : members.length === 0 ? (
        <Card className="border-dashed bg-gray-50 p-4">
          <p className="text-center text-gray-500 text-sm">등록된 멤버가 없습니다.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="w-8 px-2 py-2" />
                <TableHead className="px-2 py-2 font-medium text-xs">사용자</TableHead>
                <TableHead className="w-[100px] px-2 py-2 font-medium text-xs">역할</TableHead>
                <TableHead className="w-[80px] px-2 py-2 font-medium text-xs">상태</TableHead>
                <TableHead className="w-[80px] px-2 py-2 font-medium text-xs">초대일</TableHead>
                <TableHead className="w-[40px] px-2 py-2 font-medium text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <React.Fragment key={member.id}>
                  <TableRow
                    className={`cursor-pointer hover:bg-gray-50 ${expandedMemberId === member.id ? "bg-gray-50" : ""}`}
                    onClick={() => toggleExpand(member.id)}
                  >
                    <TableCell className="px-2 py-2">
                      {expandedMemberId === member.id ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{member.username}</span>
                        <span className="text-gray-500 text-xs">{member.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        onValueChange={(value) => handleRoleChange(member.id, value)}
                        value={member.role}
                      >
                        <SelectTrigger className="h-7 w-[90px] text-xs">
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
                    <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        onValueChange={(value) => handleStatusChange(member.id, value)}
                        value={member.status}
                      >
                        <SelectTrigger className="h-7 w-[70px] p-1 text-xs">
                          <Badge
                            className="px-1.5 py-0 text-[10px]"
                            variant={getStatusBadgeVariant(member.status)}
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
                    <TableCell className="px-2 py-2 text-gray-500 text-xs">
                      {new Date(member.invitedAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        className="h-7 w-7 p-0 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRemoveMember(member.id, member.username || "")}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedMemberId === member.id && (
                    <TableRow>
                      <TableCell className="bg-gray-50/50 p-0" colSpan={6}>
                        <MemberIamSection
                          memberEmail={member.email}
                          memberId={member.id}
                          memberName={member.username || "Unknown"}
                          memberRole={member.role}
                          workspaceId={workspaceId}
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
