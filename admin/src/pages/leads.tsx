import { Eye, FileUp, History, Mail, Plus, Search, Upload, Users } from "lucide-react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function LeadsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const navigate = useNavigate()

  const customers = [
    {
      id: 1,
      name: "김지연",
      email: "kim@beautycorp.com",
      company: "뷰티코프",
      status: "active",
      lastContact: "2일 전",
      emails: 12,
      groups: ["VIP 고객", "스킨케어 관심"],
    },
    {
      id: 2,
      name: "박서현",
      email: "park@skinlab.com",
      company: "스킨랩",
      status: "replied",
      lastContact: "1시간 전",
      emails: 8,
      groups: ["신규 가입", "메이크업 관심"],
    },
    {
      id: 3,
      name: "이민주",
      email: "lee@cosmetics.com",
      company: "코스메틱스",
      status: "pending",
      lastContact: "1주 전",
      emails: 3,
      groups: ["재구매 고객"],
    },
    {
      id: 4,
      name: "최유나",
      email: "choi@glow.co.kr",
      company: "글로우",
      status: "active",
      lastContact: "3일 전",
      emails: 15,
      groups: ["VIP 고객", "재구매 고객"],
    },
  ]

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">전체 고객</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3,842</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">활성 고객</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,567</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">답장 받음</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">487</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">오늘 추가</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="이름, 이메일, 회사 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select defaultValue="all">
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="replied">답장함</SelectItem>
            <SelectItem value="pending">대기중</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <FileUp className="h-4 w-4 mr-2" />
          CSV 업로드
        </Button>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          가져오기
        </Button>
        <Button onClick={() => navigate("/customer-groups")} variant="outline">
          <Users className="h-4 w-4 mr-2" />
          그룹 보기
        </Button>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          고객 추가
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>고객명</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>회사</TableHead>
              <TableHead>소속 그룹</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>마지막 연락</TableHead>
              <TableHead>발송 이력</TableHead>
              <TableHead>액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>{customer.company}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {customer.groups.map((group, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {group}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      customer.status === "active"
                        ? "default"
                        : customer.status === "replied"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {customer.status === "active"
                      ? "활성"
                      : customer.status === "replied"
                        ? "답장함"
                        : "대기중"}
                  </Badge>
                </TableCell>
                <TableCell>{customer.lastContact}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <span>{customer.emails}건</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                      <History className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline">
                      <Mail className="h-3 w-3 mr-1" />
                      메일
                    </Button>
                    <Button size="sm" variant="ghost">
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
