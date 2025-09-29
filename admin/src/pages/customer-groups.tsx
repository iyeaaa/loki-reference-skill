import {
  Calendar,
  ChevronRight,
  Copy,
  Edit2,
  Filter,
  GitBranch,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Tag,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

interface CustomerGroup {
  id: string
  name: string
  description: string
  customerCount: number
  tags: string[]
  conditions: {
    type: string
    value: string
  }[]
  activeSequences: number
  lastUpdated: string
  growth: number
  engagementRate: number
  conversionRate: number
}

export default function CustomerGroupsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTag, setFilterTag] = useState<string>("all")
  const [_view, _setView] = useState<"grid" | "list">("grid")

  // 예시 고객 그룹 데이터
  const customerGroups: CustomerGroup[] = [
    {
      id: "1",
      name: "VIP 고객",
      description: "3개월 내 10만원 이상 구매한 고객",
      customerCount: 3542,
      tags: ["high-value", "loyal"],
      conditions: [
        { type: "구매금액", value: "10만원 이상" },
        { type: "기간", value: "최근 3개월" },
      ],
      activeSequences: 3,
      lastUpdated: "2024-09-29",
      growth: 12.5,
      engagementRate: 82.3,
      conversionRate: 24.7,
    },
    {
      id: "2",
      name: "신규 가입자",
      description: "최근 30일 내 가입한 신규 고객",
      customerCount: 1284,
      tags: ["new", "onboarding"],
      conditions: [
        { type: "가입일", value: "30일 이내" },
        { type: "구매횟수", value: "0회" },
      ],
      activeSequences: 2,
      lastUpdated: "2024-09-29",
      growth: 45.2,
      engagementRate: 68.5,
      conversionRate: 12.3,
    },
    {
      id: "3",
      name: "휴면 고객",
      description: "90일 이상 활동이 없는 고객",
      customerCount: 8923,
      tags: ["inactive", "re-engagement"],
      conditions: [
        { type: "최종활동", value: "90일 이상" },
        { type: "이메일오픈", value: "없음" },
      ],
      activeSequences: 1,
      lastUpdated: "2024-09-28",
      growth: -5.3,
      engagementRate: 12.4,
      conversionRate: 2.1,
    },
    {
      id: "4",
      name: "재구매 고객",
      description: "2회 이상 구매한 반복 구매 고객",
      customerCount: 5678,
      tags: ["repeat", "loyal"],
      conditions: [
        { type: "구매횟수", value: "2회 이상" },
        { type: "평균구매금액", value: "5만원 이상" },
      ],
      activeSequences: 4,
      lastUpdated: "2024-09-27",
      growth: 8.9,
      engagementRate: 75.6,
      conversionRate: 18.4,
    },
    {
      id: "5",
      name: "장바구니 이탈",
      description: "장바구니에 상품을 담고 구매하지 않은 고객",
      customerCount: 2341,
      tags: ["cart-abandonment", "recovery"],
      conditions: [
        { type: "장바구니", value: "상품 있음" },
        { type: "구매완료", value: "없음" },
        { type: "기간", value: "7일 이내" },
      ],
      activeSequences: 1,
      lastUpdated: "2024-09-29",
      growth: 15.7,
      engagementRate: 45.2,
      conversionRate: 8.6,
    },
  ]

  const stats = {
    totalGroups: customerGroups.length,
    totalCustomers: customerGroups.reduce((acc, g) => acc + g.customerCount, 0),
    activeSequences: customerGroups.reduce((acc, g) => acc + g.activeSequences, 0),
    avgEngagement:
      customerGroups.reduce((acc, g) => acc + g.engagementRate, 0) / customerGroups.length,
  }

  const allTags = Array.from(new Set(customerGroups.flatMap((g) => g.tags)))

  return (
    <div className="space-y-6 h-full overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">고객 그룹</h1>
          <p className="text-muted-foreground">세그먼트별 고객 관리 및 타겟팅</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <Settings2 className="h-4 w-4" />
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />새 그룹 생성
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>전체 그룹</CardDescription>
            <CardTitle className="text-2xl">{stats.totalGroups}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Users className="h-3 w-3 mr-1" />
              활성 그룹
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 고객 수</CardDescription>
            <CardTitle className="text-2xl">{stats.totalCustomers.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-green-500">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5% 증가
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>활성 시퀀스</CardDescription>
            <CardTitle className="text-2xl">{stats.activeSequences}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <GitBranch className="h-3 w-3 mr-1" />
              실행 중
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>평균 참여율</CardDescription>
            <CardTitle className="text-2xl">{stats.avgEngagement.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.avgEngagement} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="그룹 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="태그" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 태그</SelectItem>
            {allTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* 그룹 목록 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {customerGroups.map((group) => (
          <Card key={group.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>작업</DropdownMenuLabel>
                    <DropdownMenuItem>
                      <Edit2 className="h-3 w-3 mr-2" />
                      수정
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Copy className="h-3 w-3 mr-2" />
                      복제
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <GitBranch className="h-3 w-3 mr-2" />
                      시퀀스 연결
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-3 w-3 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 태그 */}
              <div className="flex flex-wrap gap-1">
                {group.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* 조건 */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">조건</p>
                {group.conditions.map((condition, idx) => (
                  <div key={idx} className="flex items-center text-xs">
                    <ChevronRight className="h-3 w-3 mr-1 text-muted-foreground" />
                    <span className="font-medium">{condition.type}:</span>
                    <span className="ml-1">{condition.value}</span>
                  </div>
                ))}
              </div>

              {/* 통계 */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div>
                  <p className="text-xs text-muted-foreground">고객 수</p>
                  <p className="text-lg font-semibold flex items-center">
                    {group.customerCount.toLocaleString()}
                    {group.growth > 0 ? (
                      <span className="text-xs text-green-500 ml-1">+{group.growth}%</span>
                    ) : (
                      <span className="text-xs text-red-500 ml-1">{group.growth}%</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">활성 시퀀스</p>
                  <p className="text-lg font-semibold">{group.activeSequences}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">참여율</span>
                  <span className="font-medium">{group.engagementRate}%</span>
                </div>
                <Progress value={group.engagementRate} className="h-1.5" />
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 mr-1" />
                  {group.lastUpdated}
                </div>
                <Button size="sm" variant="outline">
                  <UserPlus className="h-3 w-3 mr-1" />
                  고객 보기
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
