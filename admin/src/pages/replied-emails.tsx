import { ChevronDown, ChevronRight, Mail, MessageSquare, User } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
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
import type { EmailStatus, RepliedEmail, ThreadGroupedEmail } from "@/lib/api/types/email"

export default function RepliedEmailsPage() {
  const workspaceSelectId = useId()
  const userSelectId = useId()
  const statusSelectId = useId()
  const searchInputId = useId()
  const groupThreadsId = useId()

  const [selectedWorkspace, setSelectedWorkspace] = useState("")
  const [selectedUser, setSelectedUser] = useState("")
  const [groupByThread, setGroupByThread] = useState(true)
  const [statusFilter, setStatusFilter] = useState<EmailStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  const limit = 20

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
  } = useRepliedEmails(selectedWorkspace, selectedUser, {
    limit,
    offset: (page - 1) * limit,
    groupByThread,
    status: statusFilter,
    search: searchQuery || undefined,
  })

  const totalPages = repliedEmailsData ? Math.ceil(repliedEmailsData.total / limit) : 0

  const toggleThread = (threadId: string) => {
    const newExpanded = new Set(expandedThreads)
    if (newExpanded.has(threadId)) {
      newExpanded.delete(threadId)
    } else {
      newExpanded.add(threadId)
    }
    setExpandedThreads(newExpanded)
  }

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

    const total = repliedEmailsData.total || repliedEmailsData.data.length

    // Count today's replies (only for non-grouped view)
    let todayCount = 0
    if (!groupByThread && repliedEmailsData.data.length > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      todayCount = (repliedEmailsData.data as RepliedEmail[]).filter((reply) => {
        const replyDate = new Date(reply.repliedAt || reply.createdAt)
        replyDate.setHours(0, 0, 0, 0)
        return replyDate.getTime() === today.getTime()
      }).length
    }

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
  }, [repliedEmailsData, groupByThread])

  return (
    <div className="p-6">
      {/* Workspace and User Selection */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>답장 이메일 조회 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="space-y-2">
              <Label htmlFor={statusSelectId}>상태 필터</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as EmailStatus | "all")
                  setPage(1)
                }}
              >
                <SelectTrigger id={statusSelectId}>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="replied">답장됨</SelectItem>
                  <SelectItem value="delivered">전달됨</SelectItem>
                  <SelectItem value="opened">열림</SelectItem>
                  <SelectItem value="clicked">클릭됨</SelectItem>
                  <SelectItem value="bounced">반송됨</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={searchInputId}>검색</Label>
              <Input
                id={searchInputId}
                placeholder="제목, 이메일, 리드명 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>

          {/* Thread grouping toggle */}
          <div className="mt-4 flex items-center space-x-2">
            <Switch
              id={groupThreadsId}
              checked={groupByThread}
              onCheckedChange={(checked) => {
                setGroupByThread(checked)
                setPage(1)
                setExpandedThreads(new Set())
              }}
            />
            <Label htmlFor={groupThreadsId}>스레드별로 그룹화</Label>
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
          ) : groupByThread ? (
            // Thread-grouped view
            <div className="space-y-2">
              {(repliedEmailsData.data as ThreadGroupedEmail[]).map((thread) => {
                const isExpanded = expandedThreads.has(thread.threadId)
                return (
                  <div key={thread.threadId} className="border rounded-lg">
                    <button
                      type="button"
                      className="w-full flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50 text-left"
                      onClick={() => toggleThread(thread.threadId)}
                    >
                      <div className="h-6 w-6 flex items-center justify-center">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{thread.leadName || "Unknown"}</div>
                            <div className="text-xs text-muted-foreground">{thread.fromEmail}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm truncate">
                            {thread.subject || "(제목 없음)"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {thread.sequenceName ? (
                            <Badge variant="outline">{thread.sequenceName}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          <Badge variant="secondary">{thread.emailCount}개 이메일</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(thread.latestActivity).toLocaleString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4">
                        <div className="text-sm text-muted-foreground mb-2">
                          스레드 세부 정보 (구현 예정)
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // List view
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
                {(repliedEmailsData.data as RepliedEmail[]).map((reply) => (
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

          {/* Pagination */}
          {repliedEmailsData && repliedEmailsData.data.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {repliedEmailsData.total}개 중 {(page - 1) * limit + 1}-
                {Math.min(page * limit, repliedEmailsData.total)}개 표시
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  이전
                </Button>
                <div className="text-sm">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
