import { Mail, MessageSquare, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function RepliedEmailsPage() {
  const replies = [
    {
      id: 1,
      from: "kim@company.com",
      name: "김철수",
      subject: "Re: 신규 서비스 안내",
      date: "2024-09-29 14:30",
      campaign: "프로모션",
      sentiment: "positive",
    },
    {
      id: 2,
      from: "park@startup.com",
      name: "박영희",
      subject: "Re: 환영합니다!",
      date: "2024-09-29 11:20",
      campaign: "온보딩",
      sentiment: "neutral",
    },
    {
      id: 3,
      from: "lee@corp.com",
      name: "이민수",
      subject: "Re: 특별 혜택 안내",
      date: "2024-09-28 16:45",
      campaign: "리텐션",
      sentiment: "positive",
    },
  ]

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">234</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">오늘 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">긍정 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">답장율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8.7%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            최근 답장
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>고객</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>캠페인</TableHead>
                <TableHead>감정</TableHead>
                <TableHead>날짜</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replies.map((reply) => (
                <TableRow key={reply.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{reply.name}</div>
                        <div className="text-xs text-muted-foreground">{reply.from}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{reply.subject}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{reply.campaign}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={reply.sentiment === "positive" ? "default" : "secondary"}>
                      {reply.sentiment === "positive" ? "긍정" : "중립"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">{reply.date}</div>
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
