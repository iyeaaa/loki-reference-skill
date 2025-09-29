import {
  Building,
  Calendar,
  Download,
  Filter,
  Hash,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react"
import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
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

interface Lead {
  id: number
  name: string
  email: string
  company: string
  phone: string
  status: "new" | "contacted" | "qualified" | "proposal" | "negotiation" | "closed"
  score: number
  tags: string[]
  groups: string[]
  lastContact: string
  nextAction: string
  lifetime_value: number
  email_opens: number
  email_clicks: number
  source: string
}

export default function LeadsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLeads, setSelectedLeads] = useState<number[]>([])
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterGroup, setFilterGroup] = useState<string>("all")

  // 예시 고객 데이터
  const leads: Lead[] = [
    {
      id: 1,
      name: "김철수",
      email: "kimcs@techcorp.com",
      company: "테크놀로지 주식회사",
      phone: "010-1234-5678",
      status: "qualified",
      score: 95,
      tags: ["VIP", "기업고객"],
      groups: ["VIP 고객", "재구매 고객"],
      lastContact: "2시간 전",
      nextAction: "계약서 발송",
      lifetime_value: 5240000,
      email_opens: 45,
      email_clicks: 23,
      source: "웹사이트",
    },
    {
      id: 2,
      name: "박영희",
      email: "park@design.com",
      company: "디자인 스튜디오",
      phone: "010-2345-6789",
      status: "proposal",
      score: 78,
      tags: ["신규", "관심고객"],
      groups: ["신규 가입자"],
      lastContact: "1일 전",
      nextAction: "팔로우업 전화",
      lifetime_value: 1280000,
      email_opens: 12,
      email_clicks: 5,
      source: "추천",
    },
    {
      id: 3,
      name: "이민수",
      email: "lee@startup.io",
      company: "스타트업 벤처스",
      phone: "010-3456-7890",
      status: "new",
      score: 62,
      tags: ["잠재고객"],
      groups: ["신규 가입자"],
      lastContact: "3일 전",
      nextAction: "웰컴 이메일",
      lifetime_value: 0,
      email_opens: 3,
      email_clicks: 1,
      source: "광고",
    },
    {
      id: 4,
      name: "정수진",
      email: "jung@retail.kr",
      company: "리테일 매니지먼트",
      phone: "010-4567-8901",
      status: "negotiation",
      score: 88,
      tags: ["우선협상", "대형거래"],
      groups: ["VIP 고객"],
      lastContact: "5시간 전",
      nextAction: "가격 협상",
      lifetime_value: 8920000,
      email_opens: 67,
      email_clicks: 34,
      source: "이벤트",
    },
    {
      id: 5,
      name: "최동훈",
      email: "choi@media.com",
      company: "미디어 그룹",
      phone: "010-5678-9012",
      status: "contacted",
      score: 45,
      tags: ["휴면"],
      groups: ["휴면 고객"],
      lastContact: "2주 전",
      nextAction: "재활성화 캠페인",
      lifetime_value: 450000,
      email_opens: 8,
      email_clicks: 2,
      source: "소셜미디어",
    },
  ]

  const stats = {
    total: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    qualified: leads.filter((l) => l.status === "qualified").length,
    avgScore: Math.round(leads.reduce((acc, l) => acc + l.score, 0) / leads.length),
    totalValue: leads.reduce((acc, l) => acc + l.lifetime_value, 0),
  }

  const getStatusBadge = (status: Lead["status"]) => {
    const statusMap = {
      new: { label: "신규", className: "bg-blue-500" },
      contacted: { label: "연락됨", className: "bg-yellow-500" },
      qualified: { label: "검증됨", className: "bg-green-500" },
      proposal: { label: "제안", className: "bg-purple-500" },
      negotiation: { label: "협상", className: "bg-orange-500" },
      closed: { label: "성사", className: "bg-gray-500" },
    }
    const { label, className } = statusMap[status]
    return <Badge className={className}>{label}</Badge>
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    if (score >= 40) return "text-orange-600"
    return "text-red-600"
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(leads.map((l) => l.id))
    } else {
      setSelectedLeads([])
    }
  }

  const handleSelectLead = (leadId: number, checked: boolean) => {
    if (checked) {
      setSelectedLeads([...selectedLeads, leadId])
    } else {
      setSelectedLeads(selectedLeads.filter((id) => id !== leadId))
    }
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">전체 고객</h1>
          <p className="text-muted-foreground">모든 고객 정보 관리 및 상태 추적</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            가져오기
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />새 고객
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 고객</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              활성 고객
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>신규 고객</CardDescription>
            <CardTitle className="text-2xl">{stats.new}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-green-500">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% 증가
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>검증된 고객</CardDescription>
            <CardTitle className="text-2xl">{stats.qualified}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <UserCheck className="h-3 w-3 mr-1" />
              구매 가능성 높음
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>평균 점수</CardDescription>
            <CardTitle className="text-2xl">{stats.avgScore}</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.avgScore} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 가치</CardDescription>
            <CardTitle className="text-xl">₩{(stats.totalValue / 1000000).toFixed(1)}M</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              생애 가치
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 액션 바 */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="이름, 이메일, 회사로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="new">신규</SelectItem>
              <SelectItem value="contacted">연락됨</SelectItem>
              <SelectItem value="qualified">검증됨</SelectItem>
              <SelectItem value="proposal">제안</SelectItem>
              <SelectItem value="negotiation">협상</SelectItem>
              <SelectItem value="closed">성사</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="그룹" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 그룹</SelectItem>
              <SelectItem value="vip">VIP 고객</SelectItem>
              <SelectItem value="new">신규 가입자</SelectItem>
              <SelectItem value="inactive">휴면 고객</SelectItem>
              <SelectItem value="repeat">재구매 고객</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* 선택된 항목 액션 바 */}
        {selectedLeads.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{selectedLeads.length}개 선택됨</span>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLeads([])}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Tag className="h-3 w-3 mr-1" />
                태그 추가
              </Button>
              <Button variant="outline" size="sm">
                <Users className="h-3 w-3 mr-1" />
                그룹에 추가
              </Button>
              <Button variant="outline" size="sm">
                <Mail className="h-3 w-3 mr-1" />
                이메일 보내기
              </Button>
              <Button variant="outline" size="sm" className="text-red-600">
                삭제
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 고객 테이블 */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedLeads.length === leads.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>고객</TableHead>
              <TableHead>회사</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>점수</TableHead>
              <TableHead>그룹</TableHead>
              <TableHead>참여도</TableHead>
              <TableHead>생애가치</TableHead>
              <TableHead>다음 액션</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedLeads.includes(lead.id)}
                    onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{lead.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-xs text-muted-foreground">{lead.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.company}</span>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(lead.status)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${getScoreColor(lead.score)}`}>
                      {lead.score}
                    </span>
                    <Progress value={lead.score} className="w-[60px] h-2" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {lead.groups.map((group, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {group}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-1">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>{lead.email_opens} 오픈</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />
                      <span>{lead.email_clicks} 클릭</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">₩{(lead.lifetime_value / 1000000).toFixed(1)}M</div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{lead.nextAction}</div>
                    <div className="text-xs text-muted-foreground flex items-center">
                      <Calendar className="h-3 w-3 mr-1" />
                      {lead.lastContact}
                    </div>
                  </div>
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
                      <DropdownMenuItem>상세 보기</DropdownMenuItem>
                      <DropdownMenuItem>편집</DropdownMenuItem>
                      <DropdownMenuItem>이메일 보내기</DropdownMenuItem>
                      <DropdownMenuItem>통화 기록</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">삭제</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
