import {
  Calendar,
  CheckCircle,
  Clock,
  Mail,
  Reply,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSequence, useSequenceMetrics, useSequenceSteps } from "@/lib/api/hooks/sequences"
import { cn } from "@/lib/utils"

type CampaignOverviewProps = {
  sequenceId: string
}

export function CampaignOverview({ sequenceId }: CampaignOverviewProps) {
  const { t } = useTranslation()
  const { data: sequence } = useSequence(sequenceId)
  const { data: metricsData } = useSequenceMetrics(sequenceId)
  const { data: steps = [] } = useSequenceSteps(sequenceId)

  if (!sequence) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">{t("sequences.campaignOverview.loading")}</div>
      </div>
    )
  }

  const metrics = metricsData?.data

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      // case "generating":
      //   return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      case "ready":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      case "paused":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
      case "completed":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
      case "archived":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  const progress =
    metrics && metrics.totalEnrollments > 0
      ? (metrics.completedEnrollments / metrics.totalEnrollments) * 100
      : 0

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl">{sequence.name}</CardTitle>
              {sequence.description && (
                <p className="mt-2 text-muted-foreground text-sm">{sequence.description}</p>
              )}
            </div>
            <Badge className={cn("text-sm", getStatusColor(sequence.status))} variant="secondary">
              {t(`sequences.table.status.${sequence.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground text-xs">
                  {t("sequences.campaignOverview.created")}
                </div>
                <div className="font-medium text-sm">
                  {new Date(sequence.createdAt).toLocaleDateString("ko-KR")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground text-xs">
                  {t("sequences.campaignOverview.workspace")}
                </div>
                <div className="font-medium text-sm">{sequence.workspaceName || "-"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-muted-foreground text-xs">
                  {t("sequences.campaignOverview.creator")}
                </div>
                <div className="font-medium text-sm">{sequence.createdByUsername || "-"}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t("sequences.campaignOverview.target")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("sequences.campaignOverview.customerGroup")}
              </span>
              <span className="font-medium text-sm">{sequence.customerGroupName || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("sequences.campaignOverview.recipientCount")}
              </span>
              <span className="font-medium text-sm">
                {metrics?.totalEnrollments || 0}
                {t("sequences.campaignOverview.peopleCount")}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t("sequences.campaignOverview.scenario")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                {t("sequences.campaignOverview.totalSteps")}
              </span>
              <span className="font-medium text-sm">
                {steps.length}
                {t("sequences.campaignOverview.stepCount")}
              </span>
            </div>

            {steps.length > 0 && (
              <div className="space-y-2 border-t pt-2">
                {steps.map((step, _index) => (
                  <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-2" key={step.id}>
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs">
                      {step.stepOrder}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
                        <Clock className="h-3 w-3" />
                        {step.delayDays === 0
                          ? t("sequences.campaignOverview.immediately")
                          : t("sequences.campaignOverview.daysLater", { days: step.delayDays })}
                        {" · "}
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </div>
                      <p className="truncate font-medium text-sm">{step.emailSubject}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics Card */}
      {metrics && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {t("sequences.campaignOverview.performance")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("sequences.campaignOverview.overallProgress")}
                  </span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress className="h-2" value={progress} />
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <div className="text-center">
                  <div className="font-bold text-2xl">{metrics.totalSent || 0}</div>
                  <div className="text-muted-foreground text-xs">
                    {t("sequences.campaignOverview.totalSent")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl">
                    {metrics.totalSent > 0
                      ? Math.round(((metrics.opened || 0) / metrics.totalSent) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("sequences.campaignOverview.openRate")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl">
                    {metrics.opened > 0
                      ? Math.round(((metrics.replied || 0) / metrics.opened) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("sequences.campaignOverview.replyRate")}
                  </div>
                </div>
              </div>

              {/* 회신 시간 통계 */}
              {metrics.replied > 0 &&
                (metrics.avgTimeToReply !== undefined ||
                  metrics.minTimeToReply !== undefined ||
                  metrics.maxTimeToReply !== undefined) && (
                  <div className="mt-6 border-t pt-6">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="rounded-md bg-blue-50 p-1.5 dark:bg-blue-950">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-semibold text-foreground text-sm">회신 시간 통계</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {metrics.avgTimeToReply !== undefined && (
                        <div className="rounded-lg border border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 dark:border-blue-800/50 dark:from-blue-950/50 dark:to-blue-900/30">
                          <div className="text-center">
                            <div className="mb-1 font-bold text-blue-700 text-xl dark:text-blue-300">
                              {formatReplyTime(metrics.avgTimeToReply)}
                            </div>
                            <div className="font-medium text-blue-600/80 text-xs dark:text-blue-400/80">
                              평균 회신 시간
                            </div>
                          </div>
                        </div>
                      )}
                      {metrics.minTimeToReply !== undefined && (
                        <div className="rounded-lg border border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 dark:border-blue-800/50 dark:from-blue-950/50 dark:to-blue-900/30">
                          <div className="text-center">
                            <div className="mb-1 flex items-center justify-center gap-1 font-bold text-blue-700 text-xl dark:text-blue-300">
                              <TrendingDown className="h-4 w-4" />
                              {formatReplyTime(metrics.minTimeToReply)}
                            </div>
                            <div className="font-medium text-blue-600/80 text-xs dark:text-blue-400/80">
                              최단 회신 시간
                            </div>
                          </div>
                        </div>
                      )}
                      {metrics.maxTimeToReply !== undefined && (
                        <div className="rounded-lg border border-blue-200/50 bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 dark:border-blue-800/50 dark:from-blue-950/50 dark:to-blue-900/30">
                          <div className="text-center">
                            <div className="mb-1 flex items-center justify-center gap-1 font-bold text-blue-700 text-xl dark:text-blue-300">
                              <TrendingUp className="h-4 w-4" />
                              {formatReplyTime(metrics.maxTimeToReply)}
                            </div>
                            <div className="font-medium text-blue-600/80 text-xs dark:text-blue-400/80">
                              최장 회신 시간
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* 회신 내용 요약 */}
              {metrics.replied > 0 &&
                metrics.replySummaries &&
                metrics.replySummaries.length > 0 && (
                  <div className="mt-6 border-t pt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-md bg-blue-50 p-1.5 dark:bg-blue-950">
                          <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="font-semibold text-foreground text-sm">
                          회신 내용 요약
                        </span>
                      </div>
                      <Badge className="font-medium text-xs" variant="secondary">
                        {metrics.replySummaries.length}개
                      </Badge>
                    </div>
                    <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                      {metrics.replySummaries.map((summary, index) => (
                        <div
                          className="group relative rounded-lg border border-border/50 bg-gradient-to-r from-muted/30 to-muted/10 p-3 transition-all duration-200 hover:border-primary/30 hover:shadow-sm dark:from-muted/20 dark:to-muted/5 dark:hover:border-primary/20"
                          key={summary.originalEmailId}
                        >
                          <div className="mb-2 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <Badge
                                className="shrink-0 bg-background font-semibold text-xs"
                                variant="outline"
                              >
                                #{index + 1}
                              </Badge>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                                <Clock className="h-3 w-3" />
                                <span className="font-medium">
                                  {formatReplyTime(summary.replyTime)}
                                </span>
                              </div>
                            </div>
                            {summary.sentiment && (
                              <Badge
                                className="shrink-0 font-medium text-xs"
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
                            <div className="mb-2">
                              <Badge
                                className="bg-background/50 font-medium text-xs"
                                variant="outline"
                              >
                                의도: {summary.intent}
                              </Badge>
                            </div>
                          )}
                          {summary.aiSummary && (
                            <p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed transition-colors group-hover:text-foreground/80">
                              {summary.aiSummary}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
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
