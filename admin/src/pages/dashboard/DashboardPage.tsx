import {
  BarChart3,
  Clock,
  Heart,
  Mail,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 고객</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">중소 뷰티업체</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 발송</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">해외 바이어 컨택</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 오픈율</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">38.7%</div>
            <p className="text-xs text-muted-foreground">해외 바이어 오픈</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">바이어 응답률</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18.4%</div>
            <p className="text-xs text-muted-foreground">미팅 요청 포함</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>최근 시퀀스 성과</CardTitle>
            <CardDescription>해외 바이어 컨택 자동 시퀀스 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  name: "미국 백화점 바이어 컨택",
                  type: "us-buyers",
                  sent: 45,
                  opened: 28,
                  clicked: 12,
                  status: "active",
                  icon: Sparkles,
                },
                {
                  name: "일본 드럭스토어 유통사",
                  type: "jp-distributors",
                  sent: 32,
                  opened: 19,
                  clicked: 8,
                  status: "active",
                  icon: Heart,
                },
                {
                  name: "유럽 오가닉 화장품 바이어",
                  type: "eu-organic",
                  sent: 28,
                  opened: 17,
                  clicked: 6,
                  status: "active",
                  icon: ShoppingBag,
                },
                {
                  name: "동남아 뷰티 디스트리뷰터",
                  type: "sea-distributors",
                  sent: 38,
                  opened: 22,
                  clicked: 9,
                  status: "active",
                  icon: Clock,
                },
              ].map((sequence) => (
                <div
                  key={sequence.name}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sequence.name}</p>
                    <p className="text-xs text-muted-foreground">
                      발송: {sequence.sent} | 오픈: {sequence.opened} | 클릭: {sequence.clicked}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">
                      {((sequence.opened / sequence.sent) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">오픈율</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>팔로우업 발송 예정</CardTitle>
            <CardDescription>바이어 자동 팔로우업 발송 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">2일 후 팔로우업</span>
                    <Badge variant="outline">18건</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    제품 카탈로그 재전송, 회사 소개서
                  </div>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">5일 후 팔로우업</span>
                    <Badge variant="outline">12건</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    화상 미팅 요청, 샘플 제공 안내
                  </div>
                </div>

                <div className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">10일 후 팔로우업</span>
                    <Badge variant="outline">8건</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    추가 제품 정보, 거래 조건 협의
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">오늘 예정</span>
                  <span className="text-sm font-bold">총 38건</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>고객 세그먼트별 성과</CardTitle>
          <CardDescription>뷰티업체 유형별 바이어 반응률</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">스킨케어 제조업체</span>
                <Badge variant="default">52개사</Badge>
              </div>
              <div className="text-xs text-muted-foreground">오픈율 42% | 바이어응답 21%</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">메이크업 브랜드</span>
                <Badge variant="default">38개사</Badge>
              </div>
              <div className="text-xs text-muted-foreground">오픈율 45% | 바이어응답 24%</div>
            </div>
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">헤어케어 전문기업</span>
                <Badge variant="default">37개사</Badge>
              </div>
              <div className="text-xs text-muted-foreground">오픈율 35% | 바이어응답 15%</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
