import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  MailOpen,
  MousePointer,
  Reply,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface SequenceMetricsProps {
  sequenceId: string
  sequenceName: string
  metrics?: {
    // 발송 통계
    totalSent: number
    delivered: number
    bounced: number
    dropped: number

    // 참여 통계
    opened: number
    clicked: number
    replied: number
    unsubscribed: number

    // 성과 지표
    openRate: number
    clickRate: number
    replyRate: number
    bounceRate: number

    // 시퀀스 진행도
    totalEnrollments: number
    activeEnrollments: number
    completedEnrollments: number
    pausedEnrollments: number

    // 시간별 통계
    lastSentAt?: string
    avgTimeToOpen?: number // 분 단위
    avgTimeToReply?: number // 분 단위
  }
  isLoading?: boolean
}

export function SequenceMetrics({
  sequenceId,
  sequenceName,
  metrics,
  isLoading = false,
}: SequenceMetricsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>메트릭스 데이터를 불러오는 중...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const formatPercentage = (rate: number) => {
    if (Number.isNaN(rate) || !Number.isFinite(rate)) {
      return "0.0%"
    }
    return `${rate.toFixed(1)}%`
  }

  const getRateColor = (rate: number, type: "positive" | "negative" = "positive") => {
    if (Number.isNaN(rate) || !Number.isFinite(rate)) {
      return "text-gray-500"
    }

    if (type === "negative") {
      if (rate > 5) return "text-red-600"
      if (rate > 2) return "text-orange-600"
      return "text-green-600"
    }

    if (rate > 20) return "text-green-600"
    if (rate > 10) return "text-blue-600"
    if (rate > 5) return "text-orange-600"
    return "text-red-600"
  }

  return (
    <div className="space-y-6 mb-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{sequenceName}</h2>
          <p className="text-muted-foreground">시퀀스 성과 지표</p>
        </div>
        <Badge variant="outline" className="text-sm">
          ID: {sequenceId.slice(0, 8)}...
        </Badge>
      </div>

      {/* 발송 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 발송</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.totalSent)}</div>
            <p className="text-xs text-muted-foreground">{metrics.delivered} 전달됨</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전달률</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage((metrics.delivered / metrics.totalSent) * 100)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.delivered} / {metrics.totalSent}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">반송률</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(metrics.bounceRate, "negative")}`}>
              {formatPercentage(metrics.bounceRate)}
            </div>
            <p className="text-xs text-muted-foreground">{metrics.bounced} 반송됨 (발송 후 실패)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">드롭률</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getRateColor(
                (metrics.dropped / metrics.totalSent) * 100,
                "negative",
              )}`}
            >
              {formatPercentage((metrics.dropped / metrics.totalSent) * 100)}
            </div>
            <p className="text-xs text-muted-foreground">{metrics.dropped} 드롭됨 (발송 전 차단)</p>
          </CardContent>
        </Card>
      </div>

      {/* 참여 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오픈률</CardTitle>
            <MailOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(metrics.openRate)}`}>
              {formatPercentage(metrics.openRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.opened} / {metrics.delivered} 오픈
            </p>
            <Progress value={metrics.openRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">클릭률</CardTitle>
            <MousePointer className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(metrics.clickRate)}`}>
              {formatPercentage(metrics.clickRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.clicked} / {metrics.delivered} 클릭
            </p>
            <Progress value={metrics.clickRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">답장률</CardTitle>
            <Reply className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getRateColor(metrics.replyRate)}`}>
              {formatPercentage(metrics.replyRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.replied} / {metrics.delivered} 답장
            </p>
            <Progress value={metrics.replyRate} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">구독취소</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getRateColor(
                metrics.delivered > 0 ? (metrics.unsubscribed / metrics.delivered) * 100 : 0,
                "negative",
              )}`}
            >
              {formatPercentage(
                metrics.delivered > 0 ? (metrics.unsubscribed / metrics.delivered) * 100 : 0,
              )}
            </div>
            <p className="text-xs text-muted-foreground">{metrics.unsubscribed} 구독취소</p>
          </CardContent>
        </Card>
      </div>

      {/* 시퀀스 진행도 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            시퀀스 진행 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics.totalEnrollments}</div>
              <p className="text-sm text-muted-foreground">총 등록</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics.activeEnrollments}</div>
              <p className="text-sm text-muted-foreground">진행 중</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {metrics.completedEnrollments}
              </div>
              <p className="text-sm text-muted-foreground">완료</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{metrics.pausedEnrollments}</div>
              <p className="text-sm text-muted-foreground">일시정지</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>전체 진행률</span>
              <span>
                {formatPercentage((metrics.completedEnrollments / metrics.totalEnrollments) * 100)}
              </span>
            </div>
            <Progress
              value={(metrics.completedEnrollments / metrics.totalEnrollments) * 100}
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
