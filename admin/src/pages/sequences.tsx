import { Edit2, Pause, Play, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function SequencesPage() {
  const sequences = [
    {
      id: 1,
      name: "신규 고객 환영",
      status: "active",
      stepCount: 4,
      recipients: 156,
      responseRate: 18.5,
    },
    {
      id: 2,
      name: "구매 미완료 팔로우업",
      status: "draft",
      stepCount: 3,
      recipients: 0,
      responseRate: 0,
    },
    {
      id: 3,
      name: "재구매 유도",
      status: "active",
      stepCount: 2,
      recipients: 78,
      responseRate: 8.2,
    },
  ]

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">활성 시퀀스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 발송 예정</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">234</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">평균 응답율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12.5%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">팔로우업 시퀀스</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />새 시퀀스
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>시퀀스 이름</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>단계 수</TableHead>
              <TableHead>발송 예정</TableHead>
              <TableHead>응답률</TableHead>
              <TableHead>액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.map((sequence) => (
              <TableRow key={sequence.id}>
                <TableCell className="font-medium">{sequence.name}</TableCell>
                <TableCell>
                  <Badge variant={sequence.status === "active" ? "default" : "secondary"}>
                    {sequence.status === "active" ? "활성" : "초안"}
                  </Badge>
                </TableCell>
                <TableCell>{sequence.stepCount}단계</TableCell>
                <TableCell>{sequence.recipients}명</TableCell>
                <TableCell>{sequence.responseRate}%</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    {sequence.status === "active" ? (
                      <Button size="sm" variant="ghost">
                        <Pause className="h-3 w-3" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost">
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
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
