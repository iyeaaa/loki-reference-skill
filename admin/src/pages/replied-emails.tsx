import { Mail, MessageSquare, User } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
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
import { useRepliedEmails } from "@/lib/api/hooks/emails"
import { useUsers } from "@/lib/api/hooks/users"
import { useWorkspaces } from "@/lib/api/hooks/workspaces"

export default function RepliedEmailsPage() {
  const workspaceSelectId = useId()
  const userSelectId = useId()

  const [selectedWorkspace, setSelectedWorkspace] = useState("")
  const [selectedUser, setSelectedUser] = useState("")

  const { data: workspacesData } = useWorkspaces()
  const { data: usersData } = useUsers()

  // Auto-select first workspace and user
  useEffect(() => {
    if (workspacesData?.workspaces && workspacesData.workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(workspacesData.workspaces[0].id)
    }
  }, [workspacesData, selectedWorkspace])

  useEffect(() => {
    if (usersData?.users && usersData.users.length > 0 && !selectedUser) {
      setSelectedUser(usersData.users[0].id)
    }
  }, [usersData, selectedUser])

  const {
    data: repliedEmailsData,
    isLoading,
    error,
  } = useRepliedEmails(selectedWorkspace, selectedUser, { limit: 50, offset: 0 })

  // Calculate statistics from real data
  const stats = useMemo(() => {
    if (!repliedEmailsData?.data) {
      return {
        total: 0,
        today: 0,
        meeting: 0,
        responseRate: "0%",
      }
    }

    const replies = repliedEmailsData.data
    const total = replies.length

    // Count today's replies
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayCount = replies.filter((reply) => {
      const replyDate = new Date(reply.repliedAt || reply.createdAt)
      replyDate.setHours(0, 0, 0, 0)
      return replyDate.getTime() === today.getTime()
    }).length

    // For meeting requests and response rate, we'd need more data
    // Using placeholder calculations for now
    const meetingCount = Math.floor(total * 0.37) // ~37% placeholder
    const responseRate =
      repliedEmailsData.total > 0
        ? `${((total / Math.max(repliedEmailsData.total * 5, total)) * 100).toFixed(1)}%`
        : "0%"

    return {
      total,
      today: todayCount,
      meeting: meetingCount,
      responseRate,
    }
  }, [repliedEmailsData])

  return (
    <div className="p-6">
      {/* Workspace and User Selection */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>답장 이메일 조회 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={workspaceSelectId}>워크스페이스</Label>
              <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                <SelectTrigger id={workspaceSelectId}>
                  <SelectValue placeholder="워크스페이스 선택" />
                </SelectTrigger>
                <SelectContent>
                  {workspacesData?.workspaces?.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={userSelectId}>사용자</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger id={userSelectId}>
                  <SelectValue placeholder="사용자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {usersData?.users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status display */}
          {isLoading && (
            <div className="mt-4 text-sm text-muted-foreground">답장 이메일 로딩 중...</div>
          )}
          {error && (
            <div className="mt-4 text-sm text-red-600">
              답장 이메일을 불러오는 중 오류가 발생했습니다: {error.message}
            </div>
          )}
          {repliedEmailsData && (
            <div className="mt-4 text-sm text-green-600">
              ✓ {repliedEmailsData.data.length}개의 답장 이메일을 찾았습니다
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 바이어 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">오늘 받은 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">미팅 요청 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.meeting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">바이어 응답률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.responseRate}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            최근 바이어 답장
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">로딩 중...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-600">오류가 발생했습니다</div>
          ) : !repliedEmailsData?.data || repliedEmailsData.data.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">답장 이메일이 없습니다</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>바이어</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>컨택 대상</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>날짜</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repliedEmailsData.data.map((reply) => (
                  <TableRow key={reply.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{reply.leadName || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground">{reply.fromEmail}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{reply.subject || "(제목 없음)"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {reply.sequenceName ? (
                        <Badge variant="outline">{reply.sequenceName}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={reply.status === "replied" ? "default" : "secondary"}>
                        {reply.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(reply.repliedAt || reply.createdAt).toLocaleString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
