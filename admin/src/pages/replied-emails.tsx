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
      from: "buyer@nordstrom.com",
      name: "Sarah Johnson",
      subject: "Re: K-Beauty Product Line Introduction",
      date: "2024-09-29 14:30",
      campaign: "미국 백화점 바이어",
      sentiment: "positive",
    },
    {
      id: 2,
      from: "purchasing@matsukiyo.co.jp",
      name: "田中太郎",
      subject: "Re: 新製品のご提案",
      date: "2024-09-29 11:20",
      campaign: "일본 드럭스토어",
      sentiment: "positive",
    },
    {
      id: 3,
      from: "buyer@organic-beauty.eu",
      name: "Marie Dubois",
      subject: "Re: Organic Skincare Partnership",
      date: "2024-09-28 16:45",
      campaign: "유럽 오가닉",
      sentiment: "neutral",
    },
    {
      id: 4,
      from: "contact@sea-distributor.com",
      name: "Nguyen Van A",
      subject: "Re: Distribution Partnership Inquiry",
      date: "2024-09-28 10:15",
      campaign: "동남아 디스트리뷰터",
      sentiment: "positive",
    },
  ]

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 바이어 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">오늘 받은 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">미팅 요청 답장</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">32</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">바이어 응답률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18.4%</div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>바이어</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>컨택 대상</TableHead>
                <TableHead>반응</TableHead>
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
                      <span className="text-sm">{reply.subject}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{reply.campaign}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={reply.sentiment === "positive" ? "default" : "secondary"}>
                      {reply.sentiment === "positive" ? "미팅 관심" : "정보 요청"}
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
