import {
  CheckCircle2,
  Clock,
  Mail,
  MailOpen,
  MousePointer,
  Reply,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

type SequenceMetricsProps = {
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
    minTimeToReply?: number // 분 단위
    maxTimeToReply?: number // 분 단위

    // 회신 상세 정보
    replySummaries?: Array<{
      originalEmailId: string
      replyTime: number
      aiSummary: string | null
      sentiment: string | null
      intent: string | null
    }>
  }
  isLoading?: boolean
}

export function SequenceMetrics({
  sequenceId,
  sequenceName,
  metrics,
  isLoading = false,
}: SequenceMetricsProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="mb-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card className="animate-pulse" key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
              </CardHeader>
              <CardContent>
                <div className="mb-2 h-8 w-1/2 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card className="animate-pulse" key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
              </CardHeader>
              <CardContent>
                <div className="mb-2 h-8 w-1/2 rounded bg-gray-200" />
                <div className="h-3 w-full rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-muted-foreground">
            <Mail className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>{t("sequences.metrics.loading")}</p>
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
      if (rate > 5) {
        return "text-red-600"
      }
      if (rate > 2) {
        return "text-orange-600"
      }
      return "text-green-600"
    }

    if (rate > 20) {
      return "text-green-600"
    }
    if (rate > 10) {
      return "text-blue-600"
    }
    if (rate > 5) {
      return "text-orange-600"
    }
    return "text-red-600"
  }

  return (
    <div className="mb-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl">{sequenceName}</h2>
          <p className="text-muted-foreground">{t("sequences.metrics.title")}</p>
        </div>
        <Badge className="text-sm" variant="outline">
          ID: {sequenceId.slice(0, 8)}...
        </Badge>
      </div>

      {/* 발송 통계 - 핵심 지표만 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("sequences.metrics.totalSent")}
            </CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatNumber(metrics.totalSent)}</div>
            <p className="text-muted-foreground text-xs">
              {metrics.delivered} {t("sequences.metrics.delivered")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("sequences.metrics.deliveryRate")}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-green-600">
              {formatPercentage((metrics.delivered / metrics.totalSent) * 100)}
            </div>
            <p className="text-muted-foreground text-xs">
              {metrics.delivered} / {metrics.totalSent}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 참여 통계 - 핵심 지표만 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">{t("sequences.metrics.openRate")}</CardTitle>
            <MailOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`font-bold text-2xl ${getRateColor(metrics.openRate)}`}>
              {formatPercentage(metrics.openRate)}
            </div>
            <p className="text-muted-foreground text-xs">
              {metrics.opened} / {metrics.delivered} {t("sequences.metrics.opened")}
            </p>
            <Progress className="mt-2 h-2" value={metrics.openRate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("sequences.metrics.clickRate")}
            </CardTitle>
            <MousePointer className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`font-bold text-2xl ${getRateColor(metrics.clickRate)}`}>
              {formatPercentage(metrics.clickRate)}
            </div>
            <p className="text-muted-foreground text-xs">
              {metrics.clicked} / {metrics.delivered} {t("sequences.metrics.clicked")}
            </p>
            <Progress className="mt-2 h-2" value={metrics.clickRate} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t("sequences.metrics.replyRate")}
            </CardTitle>
            <Reply className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={`font-bold text-2xl ${getRateColor(metrics.replyRate)}`}>
              {formatPercentage(metrics.replyRate)}
            </div>
            <p className="text-muted-foreground text-xs">
              {metrics.replied} / {metrics.delivered} {t("sequences.metrics.replied")}
            </p>
            <Progress className="mt-2 h-2" value={metrics.replyRate} />
          </CardContent>
        </Card>
      </div>

      {/* 회신 시간 통계 */}
      {metrics.replied > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2 font-medium text-sm">
              <Clock className="h-4 w-4 text-blue-600" />
              회신 시간 통계
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.avgTimeToReply !== undefined ||
            metrics.minTimeToReply !== undefined ||
            metrics.maxTimeToReply !== undefined ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {metrics.avgTimeToReply !== undefined && (
                  <div className="text-center">
                    <div className="font-semibold text-blue-600 text-lg">
                      {formatReplyTime(metrics.avgTimeToReply)}
                    </div>
                    <p className="text-muted-foreground text-xs">평균 회신 시간</p>
                  </div>
                )}
                {metrics.minTimeToReply !== undefined && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 font-semibold text-green-600 text-lg">
                      <TrendingDown className="h-4 w-4" />
                      {formatReplyTime(metrics.minTimeToReply)}
                    </div>
                    <p className="text-muted-foreground text-xs">최단 회신 시간</p>
                  </div>
                )}
                {metrics.maxTimeToReply !== undefined && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 font-semibold text-lg text-orange-600">
                      <TrendingUp className="h-4 w-4" />
                      {formatReplyTime(metrics.maxTimeToReply)}
                    </div>
                    <p className="text-muted-foreground text-xs">최장 회신 시간</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground text-sm">
                회신 시간 데이터를 계산 중입니다...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 회신 내용 요약 */}
      {metrics.replied > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">회신 내용 요약</CardTitle>
            <Badge variant="outline">{metrics.replySummaries?.length || 0}개</Badge>
          </CardHeader>
          <CardContent>
            {metrics.replySummaries && metrics.replySummaries.length > 0 ? (
              <div className="space-y-3">
                {metrics.replySummaries.map((summary, index) => (
                  <div className="space-y-2 rounded-lg border p-3" key={summary.originalEmailId}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs" variant="outline">
                          #{index + 1}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          회신 시간: {formatReplyTime(summary.replyTime)}
                        </span>
                      </div>
                      {summary.sentiment && (
                        <Badge
                          className="text-xs"
                          variant={
                            summary.sentiment === "positive"
                              ? "default"
                              : summary.sentiment === "negative"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {summary.sentiment === "positive"
                            ? "긍정"
                            : summary.sentiment === "negative"
                              ? "부정"
                              : "중립"}
                        </Badge>
                      )}
                    </div>
                    {summary.intent && (
                      <div>
                        <Badge className="text-xs" variant="outline">
                          의도: {summary.intent}
                        </Badge>
                      </div>
                    )}
                    {summary.aiSummary && (
                      <p className="line-clamp-2 text-muted-foreground text-sm">
                        {summary.aiSummary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-muted-foreground text-sm">
                회신 내용 요약 데이터가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function formatReplyTime(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)}분`
  }
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
  }
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`
}
