'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Mail,
  Users,
  Send,
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Zap,
  Target,
  Activity,
  ArrowUpRight,
  BarChart3,
  Calendar,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RefreshCw
} from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6 h-full overflow-y-auto p-6">
      {/* 헤더 섹션 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">이메일 캠페인 대시보드</h1>
          <p className="text-muted-foreground">AI 기반 이메일 마케팅 자동화 플랫폼</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button size="sm">
            <Mail className="h-4 w-4 mr-2" />
            새 캠페인
          </Button>
        </div>
      </div>

      {/* 핵심 지표 카드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>오늘 발송</CardDescription>
            <CardTitle className="text-2xl">45,284</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500">+12.5%</span>
              <span className="ml-1">전일 대비</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>오픈율</CardDescription>
            <CardTitle className="text-2xl">68.4%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={68.4} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">업계 평균 23.9%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>클릭률</CardDescription>
            <CardTitle className="text-2xl">24.8%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={24.8} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">업계 평균 7.8%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>전환율</CardDescription>
            <CardTitle className="text-2xl">8.2%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-muted-foreground">
              <Activity className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500">+3.1%</span>
              <span className="ml-1">주간 평균</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 실시간 캠페인 현황 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">실시간 캠페인 현황</CardTitle>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                name: '블랙프라이데이 특별 프로모션',
                status: 'active',
                type: 'bulk',
                sent: 32450,
                total: 45000,
                openRate: 72.3,
                clickRate: 28.9,
                progress: 72
              },
              {
                name: '신규 가입자 온보딩 시퀀스',
                status: 'active',
                type: 'sequence',
                sent: 1234,
                total: 1500,
                openRate: 84.2,
                clickRate: 45.6,
                progress: 82
              },
              {
                name: '재구매 유도 캠페인',
                status: 'paused',
                type: 'ai',
                sent: 8920,
                total: 15000,
                openRate: 65.1,
                clickRate: 22.3,
                progress: 59
              },
              {
                name: 'VIP 고객 맞춤형 오퍼',
                status: 'scheduled',
                type: 'ai',
                sent: 0,
                total: 3200,
                openRate: 0,
                clickRate: 0,
                progress: 0
              }
            ].map((campaign, idx) => (
              <div key={idx} className="space-y-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{campaign.name}</h4>
                      <Badge variant={
                        campaign.type === 'bulk' ? 'default' :
                        campaign.type === 'sequence' ? 'secondary' : 'outline'
                      } className="text-xs">
                        {campaign.type === 'bulk' ? '대량발송' :
                         campaign.type === 'sequence' ? '시퀀스' : 'AI 최적화'}
                      </Badge>
                      {campaign.status === 'active' && (
                        <Badge className="text-xs bg-green-500">
                          <PlayCircle className="h-3 w-3 mr-1" />
                          진행중
                        </Badge>
                      )}
                      {campaign.status === 'paused' && (
                        <Badge variant="secondary" className="text-xs">
                          <PauseCircle className="h-3 w-3 mr-1" />
                          일시정지
                        </Badge>
                      )}
                      {campaign.status === 'scheduled' && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          예약됨
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{campaign.sent.toLocaleString()} / {campaign.total.toLocaleString()} 발송</span>
                      {campaign.sent > 0 && (
                        <>
                          <span>오픈율 {campaign.openRate}%</span>
                          <span>클릭률 {campaign.clickRate}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </div>
                <Progress value={campaign.progress} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* AI 최적화 인사이트 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              AI 최적화 인사이트
            </CardTitle>
            <CardDescription>실시간 AI 분석 및 추천</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">발송 시간 최적화</div>
                  <div className="text-xs">
                    타겟 고객의 이메일 오픈 패턴 분석 결과, 오후 2-4시 발송 시 오픈율이 23% 증가합니다.
                  </div>
                  <Button variant="link" className="h-auto p-0 mt-2 text-xs">
                    적용하기 →
                  </Button>
                </AlertDescription>
              </Alert>

              <Alert>
                <Target className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">제목 최적화 제안</div>
                  <div className="text-xs">
                    이모지 사용과 개인화된 제목으로 CTR 15% 상승 예상
                  </div>
                  <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                    "🎯 {name}님, 단독 혜택이 도착했습니다"
                  </div>
                </AlertDescription>
              </Alert>

              <Alert>
                <BarChart3 className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-1">세그먼트 성과</div>
                  <div className="text-xs">
                    VIP 고객 그룹의 전환율이 일반 그룹 대비 3.2배 높습니다.
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* 시퀀스 성과 분석 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              시퀀스 캠페인 성과
            </CardTitle>
            <CardDescription>자동화 시퀀스 퍼포먼스</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="onboarding" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="onboarding">온보딩</TabsTrigger>
                <TabsTrigger value="nurture">육성</TabsTrigger>
                <TabsTrigger value="winback">재활성화</TabsTrigger>
              </TabsList>

              <TabsContent value="onboarding" className="space-y-4">
                <div className="space-y-3">
                  {[
                    { step: '환영 이메일', day: 0, sent: 2341, openRate: 92, clickRate: 45 },
                    { step: '기능 소개', day: 3, sent: 2089, openRate: 78, clickRate: 32 },
                    { step: '사용 팁', day: 7, sent: 1876, openRate: 65, clickRate: 28 },
                    { step: '성공 사례', day: 14, sent: 1654, openRate: 58, clickRate: 24 },
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{step.step}</p>
                          <p className="text-xs text-muted-foreground">Day {step.day}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <p className="font-medium">{step.openRate}%</p>
                          <p className="text-muted-foreground">오픈</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{step.clickRate}%</p>
                          <p className="text-muted-foreground">클릭</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="nurture" className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  육성 시퀀스 데이터 로딩중...
                </div>
              </TabsContent>

              <TabsContent value="winback" className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  재활성화 시퀀스 데이터 로딩중...
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* 예약된 캠페인 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              예약된 캠페인
            </CardTitle>
            <Badge variant="outline">다음 24시간</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { time: '14:00', name: 'VIP 고객 맞춤형 오퍼', recipients: 3200, type: 'AI 최적화' },
              { time: '18:00', name: '주말 특가 알림', recipients: 45000, type: '대량 발송' },
              { time: '내일 09:00', name: '월요일 뉴스레터', recipients: 28500, type: '대량 발송' },
              { time: '내일 11:00', name: '장바구니 이탈 리마인더', recipients: 892, type: '시퀀스' }
            ].map((schedule, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{schedule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {schedule.recipients.toLocaleString()}명 • {schedule.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{schedule.time}</Badge>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 시스템 상태 */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            <span className="font-medium">시스템 정상:</span> 모든 서비스가 정상적으로 작동중입니다.
            SendGrid API 응답시간: 124ms
          </span>
          <Badge className="bg-green-500">정상</Badge>
        </AlertDescription>
      </Alert>
    </div>
  )
}