import { Clock, Edit, GitBranch, Mail, Pause, Play, Plus, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const sequencesData = [
  {
    id: 1,
    name: "신규 고객 온보딩",
    status: "active",
    steps: 5,
    recipients: 245,
    openRate: "68%",
    clickRate: "32%",
    lastModified: "2024-01-15",
  },
  {
    id: 2,
    name: "제품 출시 캠페인",
    status: "paused",
    steps: 8,
    recipients: 1024,
    openRate: "45%",
    clickRate: "18%",
    lastModified: "2024-01-10",
  },
  {
    id: 3,
    name: "재참여 시퀀스",
    status: "active",
    steps: 3,
    recipients: 512,
    openRate: "52%",
    clickRate: "25%",
    lastModified: "2024-01-08",
  },
  {
    id: 4,
    name: "프리미엄 업그레이드",
    status: "draft",
    steps: 6,
    recipients: 0,
    openRate: "-",
    clickRate: "-",
    lastModified: "2024-01-20",
  },
]

export default function SequencesPage() {
  const [sequences] = useState(sequencesData)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">활성</Badge>
      case "paused":
        return <Badge className="bg-yellow-500">일시정지</Badge>
      case "draft":
        return <Badge variant="secondary">초안</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">시퀀스 관리</h1>
          <p className="text-gray-500 mt-2">자동화된 이메일 시퀀스를 생성하고 관리하세요</p>
        </div>
        <Button className="bg-violet-600 hover:bg-violet-700">
          <Plus className="mr-2 h-4 w-4" />새 시퀀스 만들기
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 시퀀스</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">활성 2개, 초안 1개</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 수신자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,781</div>
            <p className="text-xs text-muted-foreground">+12% 지난 달 대비</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 오픈율</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">55%</div>
            <p className="text-xs text-muted-foreground">업계 평균 23%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 클릭률</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">25%</div>
            <p className="text-xs text-muted-foreground">업계 평균 2.5%</p>
          </CardContent>
        </Card>
      </div>

      {/* Sequences Table */}
      <Card>
        <CardHeader>
          <CardTitle>시퀀스 목록</CardTitle>
          <CardDescription>모든 이메일 시퀀스를 관리하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>현재 등록된 모든 시퀀스 목록입니다</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>시퀀스 이름</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>단계</TableHead>
                <TableHead>수신자</TableHead>
                <TableHead>오픈율</TableHead>
                <TableHead>클릭률</TableHead>
                <TableHead>마지막 수정</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequences.map((sequence) => (
                <TableRow key={sequence.id}>
                  <TableCell className="font-medium">{sequence.name}</TableCell>
                  <TableCell>{getStatusBadge(sequence.status)}</TableCell>
                  <TableCell>{sequence.steps} 단계</TableCell>
                  <TableCell>{sequence.recipients}</TableCell>
                  <TableCell>{sequence.openRate}</TableCell>
                  <TableCell>{sequence.clickRate}</TableCell>
                  <TableCell>{sequence.lastModified}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {sequence.status === "active" ? (
                        <Button size="sm" variant="ghost">
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
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
