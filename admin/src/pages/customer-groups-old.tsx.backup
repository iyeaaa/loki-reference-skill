import { Clock, Edit2, Heart, ShoppingBag, Sparkles, Star, Target, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function CustomerGroupsPage() {
  const groups = [
    {
      id: 1,
      name: "미국 백화점 바이어",
      description: "Nordstrom, Bloomingdale's 등",
      count: 45,
      conditions: ["백화점 유통", "고급 브랜드 선호"],
      engagement: 62,
      conversion: 28,
      icon: Star,
      color: "text-yellow-600 bg-yellow-50",
    },
    {
      id: 2,
      name: "일본 드럭스토어 유통사",
      description: "Matsumoto Kiyoshi, Welcia 등",
      count: 32,
      conditions: ["일본 시장", "대량 구매 가능"],
      engagement: 59,
      conversion: 22,
      icon: Sparkles,
      color: "text-pink-600 bg-pink-50",
    },
    {
      id: 3,
      name: "유럽 오가닉 화장품 바이어",
      description: "친환경 인증 제품 전문",
      count: 28,
      conditions: ["오가닉 인증 필수", "EU 시장"],
      engagement: 61,
      conversion: 25,
      icon: Heart,
      color: "text-blue-600 bg-blue-50",
    },
    {
      id: 4,
      name: "동남아 뷰티 디스트리뷰터",
      description: "베트남, 태국, 싱가포르",
      count: 38,
      conditions: ["동남아 유통망", "K-뷰티 관심"],
      engagement: 58,
      conversion: 20,
      icon: ShoppingBag,
      color: "text-purple-600 bg-purple-50",
    },
    {
      id: 5,
      name: "중동 프리미엄 바이어",
      description: "UAE, 사우디 고급 유통",
      count: 24,
      conditions: ["할랄 인증", "럭셔리 세그먼트"],
      engagement: 45,
      conversion: 15,
      icon: Clock,
      color: "text-gray-600 bg-gray-50",
    },
    {
      id: 6,
      name: "중국 이커머스 플랫폼",
      description: "티몰, 징둥 입점 바이어",
      count: 52,
      conditions: ["온라인 판매", "중국 인증"],
      engagement: 54,
      conversion: 18,
      icon: Target,
      color: "text-rose-600 bg-rose-50",
    },
  ]

  const totalBuyers = groups.reduce((sum, group) => sum + group.count, 0)
  const avgEngagement = Math.round(
    groups.reduce((sum, group) => sum + group.engagement, 0) / groups.length
  )

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">바이어 그룹</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 바이어 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBuyers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">평균 응답률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">활성 컨택 시퀀스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>해외 바이어 그룹 목록</CardTitle>
          <CardDescription>권역별 바이어 관리 및 컨택 성과 추적</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>바이어 그룹</TableHead>
                <TableHead>바이어 수</TableHead>
                <TableHead>특성</TableHead>
                <TableHead>응답률</TableHead>
                <TableHead>미팅 전환율</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-muted-foreground">{group.description}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{group.count.toLocaleString()}개사</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {group.conditions.map((condition, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{group.engagement}%</span>
                      </div>
                      <Progress value={group.engagement} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{group.conversion}%</span>
                      </div>
                      <Progress
                        value={group.conversion * 3}
                        className={`h-1.5 ${group.conversion > 20 ? "[&>div]:bg-green-600" : ""}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    {group.engagement > 60 && <Badge variant="default">적극 응답</Badge>}
                    {group.engagement > 40 && group.engagement <= 60 && (
                      <Badge variant="secondary">관심 보유</Badge>
                    )}
                    {group.engagement <= 40 && <Badge variant="outline">추가 접근</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        바이어 보기
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Edit2 className="h-3 w-3" />
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
