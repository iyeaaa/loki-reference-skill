import { Activity, Filter, Mail, MoreHorizontal, Plus, Search } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Campaign {
  id: string
  name: string
  status: "active" | "paused" | "scheduled" | "completed" | "draft"
  type: "email" | "sequence" | "ai-optimized"
  targetGroup: string
  sentCount: number
  totalCount: number
  openRate: number
  clickRate: number
  conversionRate: number
  scheduledDate?: string
  createdDate: string
  progress: number
}

export default function CampaignsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")

  // 예시 캠페인 데이터
  const campaigns: Campaign[] = [
    {
      id: "1",
      name: "블랙프라이데이 프로모션",
      status: "active",
      type: "email",
      targetGroup: "VIP 고객",
      sentCount: 12450,
      totalCount: 15000,
      openRate: 68.5,
      clickRate: 24.3,
      conversionRate: 8.7,
      createdDate: "2024-09-28",
      progress: 83,
    },
    {
      id: "2",
      name: "신규 가입 환영 시퀀스",
      status: "active",
      type: "sequence",
      targetGroup: "신규 가입자",
      sentCount: 3200,
      totalCount: 3200,
      openRate: 82.1,
      clickRate: 45.6,
      conversionRate: 12.3,
      createdDate: "2024-09-25",
      progress: 100,
    },
    {
      id: "3",
      name: "재구매 유도 캠페인",
      status: "paused",
      type: "ai-optimized",
      targetGroup: "휴면 고객",
      sentCount: 5600,
      totalCount: 10000,
      openRate: 45.2,
      clickRate: 12.8,
      conversionRate: 3.4,
      createdDate: "2024-09-20",
      progress: 56,
    },
    {
      id: "4",
      name: "연말 특별 오퍼",
      status: "scheduled",
      type: "email",
      targetGroup: "전체 고객",
      sentCount: 0,
      totalCount: 45000,
      openRate: 0,
      clickRate: 0,
      conversionRate: 0,
      scheduledDate: "2024-12-01 09:00",
      createdDate: "2024-09-15",
      progress: 0,
    },
    {
      id: "5",
      name: "VIP 맞춤형 추천",
      status: "completed",
      type: "ai-optimized",
      targetGroup: "VIP 고객",
      sentCount: 8900,
      totalCount: 8900,
      openRate: 75.3,
      clickRate: 32.1,
      conversionRate: 15.2,
      createdDate: "2024-09-10",
      progress: 100,
    },
  ]

  const stats = {
    totalActive: campaigns.filter((c) => c.status === "active").length,
    totalSent: campaigns.reduce((acc, c) => acc + c.sentCount, 0),
    avgOpenRate:
      campaigns.filter((c) => c.sentCount > 0).reduce((acc, c) => acc + c.openRate, 0) /
      campaigns.filter((c) => c.sentCount > 0).length,
    avgClickRate:
      campaigns.filter((c) => c.sentCount > 0).reduce((acc, c) => acc + c.clickRate, 0) /
      campaigns.filter((c) => c.sentCount > 0).length,
  }

  const getStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "active":
        return <Badge variant="default">진행중</Badge>
      case "paused":
        return <Badge variant="secondary">일시정지</Badge>
      case "scheduled":
        return <Badge variant="outline">예약됨</Badge>
      case "completed":
        return <Badge variant="default">완료</Badge>
      case "draft":
        return <Badge variant="outline">초안</Badge>
    }
  }

  const getTypeBadge = (type: Campaign["type"]) => {
    switch (type) {
      case "email":
        return <Badge variant="outline">이메일</Badge>
      case "sequence":
        return <Badge variant="outline">시퀀스</Badge>
      case "ai-optimized":
        return <Badge variant="outline">AI 최적화</Badge>
    }
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">캠페인</h1>
          <p className="text-muted-foreground">이메일 마케팅 캠페인 관리 및 실행</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />새 캠페인
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>활성 캠페인</CardDescription>
            <CardTitle className="text-2xl">{stats.totalActive}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="h-3 w-3 mr-1" />
              현재 실행중
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>총 발송</CardDescription>
            <CardTitle className="text-2xl">{stats.totalSent.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Mail className="h-3 w-3 mr-1" />
              이번 달
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>평균 오픈율</CardDescription>
            <CardTitle className="text-2xl">{stats.avgOpenRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.avgOpenRate} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>평균 클릭률</CardDescription>
            <CardTitle className="text-2xl">{stats.avgClickRate.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stats.avgClickRate} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="캠페인 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="active">진행중</SelectItem>
            <SelectItem value="paused">일시정지</SelectItem>
            <SelectItem value="scheduled">예약됨</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="draft">초안</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="유형" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            <SelectItem value="email">이메일</SelectItem>
            <SelectItem value="sequence">시퀀스</SelectItem>
            <SelectItem value="ai-optimized">AI 최적화</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* 캠페인 목록 */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="active">진행중</TabsTrigger>
          <TabsTrigger value="scheduled">예약됨</TabsTrigger>
          <TabsTrigger value="completed">완료</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{campaign.name}</h3>
                      {getStatusBadge(campaign.status)}
                      {getTypeBadge(campaign.type)}
                      <Badge variant="secondary">{campaign.targetGroup}</Badge>
                    </div>

                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">발송</p>
                        <p className="font-medium">
                          {campaign.sentCount.toLocaleString()} /{" "}
                          {campaign.totalCount.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">오픈율</p>
                        <p className="font-medium">{campaign.openRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">클릭률</p>
                        <p className="font-medium">{campaign.clickRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">전환율</p>
                        <p className="font-medium">{campaign.conversionRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {campaign.scheduledDate ? "예약 시간" : "생성일"}
                        </p>
                        <p className="font-medium">
                          {campaign.scheduledDate || campaign.createdDate}
                        </p>
                      </div>
                    </div>

                    <Progress value={campaign.progress} className="h-2" />
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>작업</DropdownMenuLabel>
                      <DropdownMenuItem>상세 보기</DropdownMenuItem>
                      <DropdownMenuItem>수정</DropdownMenuItem>
                      <DropdownMenuItem>복제</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {campaign.status === "active" && (
                        <DropdownMenuItem>일시정지</DropdownMenuItem>
                      )}
                      {campaign.status === "paused" && <DropdownMenuItem>재개</DropdownMenuItem>}
                      <DropdownMenuItem className="text-red-600">삭제</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
