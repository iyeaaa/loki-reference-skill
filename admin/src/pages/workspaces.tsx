import {
  Calendar,
  CheckCircle,
  CreditCard,
  Edit2,
  Key,
  MoreHorizontal,
  Plus,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Workspace {
  id: string
  name: string
  email: string
  plan: "free" | "starter" | "pro" | "enterprise"
  status: "active" | "inactive" | "suspended"
  owner: string
  members: number
  emailsUsed: number
  emailLimit: number
  apiKey: string
  createdAt: string
  lastActive: string
  monthlySpend: number
}

interface Member {
  id: string
  name: string
  email: string
  role: "owner" | "admin" | "member"
  lastActive: string
  status: "active" | "inactive"
}

export default function WorkspacesPage() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("workspace1")
  const [activeTab, setActiveTab] = useState("overview")

  // 예시 워크스페이스 데이터
  const workspaces: Workspace[] = [
    {
      id: "workspace1",
      name: "루카스에듀테인먼트",
      email: "lukas@tam9.me",
      plan: "pro",
      status: "active",
      owner: "김철수",
      members: 12,
      emailsUsed: 45284,
      emailLimit: 100000,
      apiKey: "sg.xxxxxxxxxxxxxxxxxxxxxx",
      createdAt: "2024-01-15",
      lastActive: "방금 전",
      monthlySpend: 89000,
    },
    {
      id: "workspace2",
      name: "예지상사",
      email: "yamy0612@naver.com",
      plan: "starter",
      status: "active",
      owner: "박영희",
      members: 5,
      emailsUsed: 12350,
      emailLimit: 25000,
      apiKey: "sg.yyyyyyyyyyyyyyyyyyyyyy",
      createdAt: "2024-03-20",
      lastActive: "2시간 전",
      monthlySpend: 29000,
    },
    {
      id: "workspace3",
      name: "익투스",
      email: "ictuskorea@gmail.com",
      plan: "enterprise",
      status: "active",
      owner: "이민수",
      members: 25,
      emailsUsed: 182456,
      emailLimit: 500000,
      apiKey: "sg.zzzzzzzzzzzzzzzzzzzzzz",
      createdAt: "2023-11-08",
      lastActive: "1일 전",
      monthlySpend: 199000,
    },
    {
      id: "workspace4",
      name: "리오닉스",
      email: "rionix@kakao.com",
      plan: "free",
      status: "inactive",
      owner: "정수진",
      members: 2,
      emailsUsed: 950,
      emailLimit: 1000,
      apiKey: "sg.aaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2024-07-12",
      lastActive: "1주 전",
      monthlySpend: 0,
    },
  ]

  const members: Member[] = [
    {
      id: "1",
      name: "김철수",
      email: "kim@company.com",
      role: "owner",
      lastActive: "방금 전",
      status: "active",
    },
    {
      id: "2",
      name: "박영희",
      email: "park@company.com",
      role: "admin",
      lastActive: "2시간 전",
      status: "active",
    },
    {
      id: "3",
      name: "이민수",
      email: "lee@company.com",
      role: "member",
      lastActive: "1일 전",
      status: "active",
    },
    {
      id: "4",
      name: "정수진",
      email: "jung@company.com",
      role: "member",
      lastActive: "3일 전",
      status: "inactive",
    },
  ]

  const currentWorkspace = workspaces.find((w) => w.id === selectedWorkspace) || workspaces[0]

  const getPlanBadge = (plan: Workspace["plan"]) => {
    const planMap = {
      free: { label: "Free", className: "bg-gray-500" },
      starter: { label: "Starter", className: "bg-blue-500" },
      pro: { label: "Pro", className: "bg-purple-500" },
      enterprise: {
        label: "Enterprise",
        className: "bg-gradient-to-r from-purple-500 to-pink-500",
      },
    }
    const { label, className } = planMap[plan]
    return <Badge className={className}>{label}</Badge>
  }

  const getStatusBadge = (status: Workspace["status"]) => {
    const statusMap = {
      active: { label: "활성", className: "bg-green-500" },
      inactive: { label: "비활성", className: "bg-gray-500" },
      suspended: { label: "정지", className: "bg-red-500" },
    }
    const { label, className } = statusMap[status]
    return <Badge className={className}>{label}</Badge>
  }

  const getRoleBadge = (role: Member["role"]) => {
    const roleMap = {
      owner: { label: "소유자", className: "bg-yellow-500" },
      admin: { label: "관리자", className: "bg-blue-500" },
      member: { label: "멤버", className: "bg-gray-500" },
    }
    const { label, className } = roleMap[role]
    return <Badge className={className}>{label}</Badge>
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">워크스페이스</h1>
          <p className="text-muted-foreground">워크스페이스 관리 및 설정</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />새 워크스페이스
        </Button>
      </div>

      {/* 워크스페이스 선택 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {workspaces.map((workspace) => (
          <Card
            key={workspace.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedWorkspace === workspace.id ? "ring-2 ring-violet-500" : ""
            }`}
            onClick={() => setSelectedWorkspace(workspace.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-base">{workspace.name}</CardTitle>
                  <CardDescription className="text-xs">{workspace.email}</CardDescription>
                </div>
                {getPlanBadge(workspace.plan)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">이메일 사용량</span>
                  <span className="font-medium">
                    {workspace.emailsUsed.toLocaleString()} /{" "}
                    {workspace.emailLimit.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={(workspace.emailsUsed / workspace.emailLimit) * 100}
                  className="h-2"
                />
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Users className="h-3 w-3 mr-1" />
                    {workspace.members}명
                  </div>
                  {getStatusBadge(workspace.status)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 워크스페이스 상세 정보 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">개요</TabsTrigger>
          <TabsTrigger value="members">멤버</TabsTrigger>
          <TabsTrigger value="api">API 설정</TabsTrigger>
          <TabsTrigger value="billing">결제</TabsTrigger>
          <TabsTrigger value="settings">설정</TabsTrigger>
        </TabsList>

        {/* 개요 탭 */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>이번 달 발송</CardDescription>
                <CardTitle className="text-2xl">
                  {currentWorkspace.emailsUsed.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress
                  value={(currentWorkspace.emailsUsed / currentWorkspace.emailLimit) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  한도: {currentWorkspace.emailLimit.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>월 비용</CardDescription>
                <CardTitle className="text-2xl">
                  ₩{currentWorkspace.monthlySpend.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-green-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  정상 결제
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>활성 멤버</CardDescription>
                <CardTitle className="text-2xl">{currentWorkspace.members}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-xs text-muted-foreground">
                  <UserCheck className="h-3 w-3 mr-1" />
                  {currentWorkspace.lastActive}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>워크스페이스 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">이름</Label>
                  <p className="font-medium">{currentWorkspace.name}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">이메일</Label>
                  <p className="font-medium">{currentWorkspace.email}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">소유자</Label>
                  <p className="font-medium">{currentWorkspace.owner}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">생성일</Label>
                  <p className="font-medium">{currentWorkspace.createdAt}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">플랜</Label>
                  <div className="mt-1">{getPlanBadge(currentWorkspace.plan)}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">상태</Label>
                  <div className="mt-1">{getStatusBadge(currentWorkspace.status)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 멤버 탭 */}
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">팀 멤버</h3>
            <Button>
              <UserCheck className="h-4 w-4 mr-2" />
              멤버 초대
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>멤버</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>마지막 활동</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{member.name.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(member.role)}</TableCell>
                    <TableCell>
                      <Badge variant={member.status === "active" ? "default" : "secondary"}>
                        {member.status === "active" ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.lastActive}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>작업</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <Edit2 className="h-3 w-3 mr-2" />
                            역할 변경
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Shield className="h-3 w-3 mr-2" />
                            권한 설정
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-3 w-3 mr-2" />
                            제거
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* API 설정 탭 */}
        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SendGrid API 설정</CardTitle>
              <CardDescription>API 키를 관리하고 웹훅을 설정합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>API 키</Label>
                <div className="flex gap-2">
                  <Input
                    value={currentWorkspace.apiKey}
                    type="password"
                    readOnly
                    className="font-mono"
                  />
                  <Button variant="outline">
                    <Key className="h-4 w-4 mr-2" />
                    재생성
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  이 키를 안전하게 보관하세요. 외부에 노출되지 않도록 주의하세요.
                </p>
              </div>

              <div className="space-y-2">
                <Label>웹훅 URL</Label>
                <Input placeholder="https://your-domain.com/webhook" />
                <p className="text-xs text-muted-foreground">
                  이메일 이벤트를 수신할 웹훅 엔드포인트를 입력하세요
                </p>
              </div>

              <div className="space-y-3">
                <Label>이벤트 설정</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">오픈 추적</p>
                      <p className="text-xs text-muted-foreground">이메일 오픈 이벤트 추적</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">클릭 추적</p>
                      <p className="text-xs text-muted-foreground">링크 클릭 이벤트 추적</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">바운스 추적</p>
                      <p className="text-xs text-muted-foreground">반송된 이메일 추적</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>

              <Button>
                <CheckCircle className="h-4 w-4 mr-2" />
                설정 저장
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 결제 탭 */}
        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>현재 플랜</CardTitle>
                <CardDescription>구독 정보 및 사용량</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">
                      {currentWorkspace.plan.charAt(0).toUpperCase() +
                        currentWorkspace.plan.slice(1)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ₩{currentWorkspace.monthlySpend.toLocaleString()}/월
                    </p>
                  </div>
                  {getPlanBadge(currentWorkspace.plan)}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>이메일 발송 한도</span>
                    <span className="font-medium">
                      {currentWorkspace.emailLimit.toLocaleString()}/월
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>팀 멤버</span>
                    <span className="font-medium">{currentWorkspace.members}명</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>API 호출</span>
                    <span className="font-medium">무제한</span>
                  </div>
                </div>

                <Button className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  플랜 업그레이드
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>결제 방법</CardTitle>
                <CardDescription>등록된 결제 수단</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <CreditCard className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">•••• •••• •••• 4242</p>
                    <p className="text-xs text-muted-foreground">만료: 12/25</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    변경
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">다음 결제일</span>
                    <span className="font-medium">2024년 10월 15일</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">예상 금액</span>
                    <span className="font-medium">
                      ₩{currentWorkspace.monthlySpend.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  결제 내역 보기
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 설정 탭 */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>워크스페이스 설정</CardTitle>
              <CardDescription>일반 설정 및 보안</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>워크스페이스 이름</Label>
                <Input value={currentWorkspace.name} />
              </div>

              <div className="space-y-2">
                <Label>발신 이메일</Label>
                <Input value={currentWorkspace.email} />
                <p className="text-xs text-muted-foreground">
                  이 이메일은 SendGrid에서 발송되는 모든 이메일의 발신자로 표시됩니다
                </p>
              </div>

              <div className="space-y-3">
                <Label>보안 설정</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">2단계 인증</p>
                      <p className="text-xs text-muted-foreground">모든 멤버에게 2FA 요구</p>
                    </div>
                    <Switch />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">IP 화이트리스트</p>
                      <p className="text-xs text-muted-foreground">특정 IP에서만 접근 허용</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button>
                  <Settings className="h-4 w-4 mr-2" />
                  설정 저장
                </Button>
                <Button variant="outline" className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  워크스페이스 삭제
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
