import {
  Building,
  Calendar,
  Download,
  Filter,
  Mail,
  Phone,
  Plus,
  Star,
  Upload,
  UserCheck,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const leadsData = [
  {
    id: 1,
    name: "김철수",
    email: "kimcs@company.com",
    company: "테크놀로지 주식회사",
    phone: "010-1234-5678",
    status: "hot",
    score: 95,
    lastContact: "2024-01-20",
    source: "웹사이트",
    assignedTo: "이영희",
  },
  {
    id: 2,
    name: "박영희",
    email: "park@startup.com",
    company: "스타트업 벤처스",
    phone: "010-2345-6789",
    status: "warm",
    score: 75,
    lastContact: "2024-01-18",
    source: "링크드인",
    assignedTo: "김민수",
  },
  {
    id: 3,
    name: "이민수",
    email: "lee@enterprise.co.kr",
    company: "엔터프라이즈 솔루션",
    phone: "010-3456-7890",
    status: "cold",
    score: 40,
    lastContact: "2024-01-15",
    source: "추천",
    assignedTo: "박지훈",
  },
  {
    id: 4,
    name: "정수진",
    email: "jung@consulting.com",
    company: "컨설팅 그룹",
    phone: "010-4567-8901",
    status: "qualified",
    score: 88,
    lastContact: "2024-01-19",
    source: "세미나",
    assignedTo: "이영희",
  },
  {
    id: 5,
    name: "최동욱",
    email: "choi@manufacturing.kr",
    company: "제조산업 코리아",
    phone: "010-5678-9012",
    status: "warm",
    score: 65,
    lastContact: "2024-01-17",
    source: "광고",
    assignedTo: "김민수",
  },
]

export default function LeadsPage() {
  const [leads] = useState(leadsData)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "hot":
        return <Badge className="bg-red-500">Hot</Badge>
      case "warm":
        return <Badge className="bg-orange-500">Warm</Badge>
      case "cold":
        return <Badge className="bg-blue-500">Cold</Badge>
      case "qualified":
        return <Badge className="bg-green-500">Qualified</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-gray-600"
  }

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">고객 관리</h1>
          <p className="text-gray-500 mt-2">잠재 고객을 추적하고 관리하세요</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            가져오기
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            내보내기
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-700">
            <Plus className="mr-2 h-4 w-4" />새 고객 추가
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 고객</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,245</div>
            <p className="text-xs text-muted-foreground">+20.1% 지난 달 대비</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hot 리드</CardTitle>
            <Star className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">145</div>
            <p className="text-xs text-muted-foreground">즉시 팔로우업 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전환율</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5%</div>
            <p className="text-xs text-muted-foreground">업계 평균 10%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 스코어</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">73</div>
            <p className="text-xs text-muted-foreground">+5 포인트 상승</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>고객 목록</CardTitle>
          <CardDescription>모든 잠재 고객을 검색하고 필터링하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="이름, 이메일, 회사명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              고급 필터
            </Button>
          </div>

          {/* Leads Table */}
          <Table>
            <TableCaption>현재 등록된 모든 고객 목록입니다</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>회사</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>스코어</TableHead>
                <TableHead>마지막 접촉</TableHead>
                <TableHead>출처</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>{getStatusBadge(lead.status)}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${getScoreColor(lead.score)}`}>
                      {lead.score}
                    </span>
                  </TableCell>
                  <TableCell>{lead.lastContact}</TableCell>
                  <TableCell>{lead.source}</TableCell>
                  <TableCell>{lead.assignedTo}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost">
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Phone className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
