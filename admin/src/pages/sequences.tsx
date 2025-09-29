import { Edit2, Pause, Play, Plus, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"

export default function SequencesPage() {
  const sequences = [
    {
      id: 1,
      name: "미국 백화점 바이어 초기 컨택",
      status: "active",
      stepCount: 4,
      recipients: 45,
      responseRate: 28.0,
      openRate: 62.2,
      clickRate: 26.7,
      meetingRate: 15.6,
      hasABTest: true,
      variants: [
        { name: "A", recipients: 23, openRate: 65.2, responseRate: 30.4 },
        { name: "B", recipients: 22, openRate: 59.1, responseRate: 25.5 },
      ],
    },
    {
      id: 2,
      name: "일본 유통사 제품 제안",
      status: "active",
      stepCount: 3,
      recipients: 32,
      responseRate: 22.0,
      openRate: 59.4,
      clickRate: 25.0,
      meetingRate: 12.5,
      hasABTest: false,
    },
    {
      id: 3,
      name: "유럽 오가닉 바이어 인증 안내",
      status: "active",
      stepCount: 5,
      recipients: 28,
      responseRate: 25.0,
      openRate: 60.7,
      clickRate: 21.4,
      meetingRate: 14.3,
      hasABTest: true,
      variants: [
        { name: "A", recipients: 14, openRate: 64.3, responseRate: 28.6 },
        { name: "B", recipients: 14, openRate: 57.1, responseRate: 21.4 },
      ],
    },
    {
      id: 4,
      name: "동남아 디스트리뷰터 파트너십",
      status: "active",
      stepCount: 3,
      recipients: 38,
      responseRate: 20.0,
      openRate: 57.9,
      clickRate: 23.7,
      meetingRate: 10.5,
      hasABTest: false,
    },
    {
      id: 5,
      name: "중동 프리미엄 바이어 제안",
      status: "draft",
      stepCount: 4,
      recipients: 0,
      responseRate: 0,
      openRate: 0,
      clickRate: 0,
      meetingRate: 0,
      hasABTest: false,
    },
  ]

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">활성 컨택 시퀀스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">진행 중 바이어</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">143개사</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">평균 바이어 응답률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23.8%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">바이어 컨택 자동 시퀀스</h2>
        <Button>
          <Plus className="h-4 w-4 mr-2" />새 컨택 시퀀스
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>컨택 시퀀스명</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>바이어</TableHead>
              <TableHead>오픈율</TableHead>
              <TableHead>클릭율</TableHead>
              <TableHead>응답률</TableHead>
              <TableHead>미팅율</TableHead>
              <TableHead>액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.map((sequence) => (
              <>
                <TableRow key={sequence.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {sequence.name}
                        {sequence.hasABTest && (
                          <Badge variant="outline" className="text-xs">
                            A/B 테스트
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{sequence.stepCount}단계</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={sequence.status === "active" ? "default" : "secondary"}>
                      {sequence.status === "active" ? "진행중" : "준비중"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{sequence.recipients}개사</span>
                  </TableCell>
                  <TableCell>
                    {sequence.openRate > 0 ? (
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{sequence.openRate}%</span>
                        <Progress value={sequence.openRate} className="h-1.5 w-16" />
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {sequence.clickRate > 0 ? (
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{sequence.clickRate}%</span>
                        <Progress value={sequence.clickRate * 2} className="h-1.5 w-16" />
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {sequence.responseRate > 0 ? (
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{sequence.responseRate}%</span>
                        <Progress
                          value={sequence.responseRate * 2}
                          className="h-1.5 w-16 [&>div]:bg-green-600"
                        />
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {sequence.meetingRate > 0 ? (
                      <div className="space-y-1">
                        <span className="text-sm font-medium">{sequence.meetingRate}%</span>
                        <Progress
                          value={sequence.meetingRate * 3}
                          className="h-1.5 w-16 [&>div]:bg-blue-600"
                        />
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
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
                {sequence.hasABTest &&
                  sequence.variants?.map((variant) => (
                    <TableRow key={`${sequence.id}-${variant.name}`} className="bg-muted/30">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            변형 {variant.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {variant.recipients}개사
                          </span>
                        </div>
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{variant.openRate}%</span>
                          {variant.openRate > sequence.openRate && (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{variant.responseRate}%</span>
                          {variant.responseRate > sequence.responseRate && (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  ))}
              </>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
