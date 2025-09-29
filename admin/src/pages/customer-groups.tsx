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
      name: "VIP 고객",
      description: "연 100만원 이상 구매",
      count: 523,
      conditions: ["구매금액 > 1,000,000", "재구매율 > 80%"],
      engagement: 68,
      conversion: 28,
      icon: Star,
      color: "text-yellow-600 bg-yellow-50",
    },
    {
      id: 2,
      name: "스킨케어 관심 고객",
      description: "스킨케어 제품 주 구매층",
      count: 1234,
      conditions: ["스킨케어 구매 > 3회", "최근 30일 활동"],
      engagement: 52,
      conversion: 15,
      icon: Sparkles,
      color: "text-pink-600 bg-pink-50",
    },
    {
      id: 3,
      name: "신규 가입 고객",
      description: "30일 이내 신규 가입",
      count: 342,
      conditions: ["가입일 < 30일", "첫 구매 전"],
      engagement: 45,
      conversion: 8,
      icon: Heart,
      color: "text-blue-600 bg-blue-50",
    },
    {
      id: 4,
      name: "재구매 고객",
      description: "2회 이상 구매 완료",
      count: 892,
      conditions: ["구매횟수 >= 2", "평균 구매액 > 50,000"],
      engagement: 61,
      conversion: 22,
      icon: ShoppingBag,
      color: "text-purple-600 bg-purple-50",
    },
    {
      id: 5,
      name: "휴면 고객",
      description: "90일 이상 구매 없음",
      count: 456,
      conditions: ["최종구매 > 90일", "이메일 오픈 < 10%"],
      engagement: 12,
      conversion: 3,
      icon: Clock,
      color: "text-gray-600 bg-gray-50",
    },
    {
      id: 6,
      name: "메이크업 VIP",
      description: "메이크업 제품 충성 고객",
      count: 287,
      conditions: ["메이크업 구매 > 5회", "월평균 구매 > 100,000"],
      engagement: 72,
      conversion: 31,
      icon: Target,
      color: "text-rose-600 bg-rose-50",
    },
  ]

  const totalCustomers = groups.reduce((sum, group) => sum + group.count, 0)
  const avgEngagement = Math.round(
    groups.reduce((sum, group) => sum + group.engagement, 0) / groups.length
  )

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">전체 그룹</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 고객 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">평균 참여율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgEngagement}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">활성 시퀀스</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>고객 그룹 목록</CardTitle>
          <CardDescription>효율적인 그룹별 관리 및 성과 추적</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>그룹명</TableHead>
                <TableHead>고객 수</TableHead>
                <TableHead>조건</TableHead>
                <TableHead>참여율</TableHead>
                <TableHead>전환율</TableHead>
                <TableHead>성과</TableHead>
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
                    <span className="font-medium">{group.count.toLocaleString()}명</span>
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
                    {group.engagement > 60 && <Badge variant="default">우수</Badge>}
                    {group.engagement > 40 && group.engagement <= 60 && (
                      <Badge variant="secondary">양호</Badge>
                    )}
                    {group.engagement <= 40 && <Badge variant="outline">관리필요</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        고객보기
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
