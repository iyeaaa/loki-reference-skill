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

interface CampaignOverviewProps {
  sequenceId: string
}

export function CampaignOverview({ sequenceId }: CampaignOverviewProps) {
  const { t } = useTranslation()
  const { data: sequence } = useSequence(sequenceId)
  const { data: metricsData } = useSequenceMetrics(sequenceId)
  const { data: steps = [] } = useSequenceSteps(sequenceId)

  if (!sequence) {
    return (
      <div className="flex items-center justify-center h-64">
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
                <p className="text-sm text-muted-foreground mt-2">{sequence.description}</p>
              )}
            </div>
            <Badge variant="secondary" className={cn("text-sm", getStatusColor(sequence.status))}>
              {t(`sequences.table.status.${sequence.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">
                  {t("sequences.campaignOverview.created")}
                </div>
                <div className="text-sm font-medium">
                  {new Date(sequence.createdAt).toLocaleDateString("ko-KR")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">
                  {t("sequences.campaignOverview.workspace")}
                </div>
                <div className="text-sm font-medium">{sequence.workspaceName || "-"}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">
                  {t("sequences.campaignOverview.creator")}
                </div>
                <div className="text-sm font-medium">{sequence.createdByUsername || "-"}</div>
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
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {t("sequences.campaignOverview.customerGroup")}
              </span>
              <span className="text-sm font-medium">{sequence.customerGroupName || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {t("sequences.campaignOverview.recipientCount")}
              </span>
              <span className="text-sm font-medium">
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
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {t("sequences.campaignOverview.totalSteps")}
              </span>
              <span className="text-sm font-medium">
                {steps.length}
                {t("sequences.campaignOverview.stepCount")}
              </span>
            </div>

            {steps.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                {steps.map((step, _index) => (
                  <div key={step.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold flex-shrink-0">
                      {step.stepOrder}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Clock className="h-3 w-3" />
                        {step.delayDays === 0
                          ? t("sequences.campaignOverview.immediately")
                          : t("sequences.campaignOverview.daysLater", { days: step.delayDays })}
                        {" · "}
                        {String(step.scheduledHour).padStart(2, "0")}:
                        {String(step.scheduledMinute).padStart(2, "0")}
                      </div>
                      <p className="text-sm font-medium truncate">{step.emailSubject}</p>
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
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {t("sequences.campaignOverview.overallProgress")}
                  </span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{metrics.totalSent || 0}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("sequences.campaignOverview.totalSent")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {metrics.totalSent > 0
                      ? Math.round(((metrics.opened || 0) / metrics.totalSent) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("sequences.campaignOverview.openRate")}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {metrics.opened > 0
                      ? Math.round(((metrics.replied || 0) / metrics.opened) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("sequences.campaignOverview.replyRate")}
                  </div>
                </div>
              </div>

              {/* 회신 시간 통계 */}
              {metrics.replied > 0 &&
                (metrics.avgTimeToReply !== undefined ||
                  metrics.minTimeToReply !== undefined ||
                  metrics.maxTimeToReply !== undefined) && (
                  <div className="pt-6 border-t mt-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950">
                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">회신 시간 통계</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {metrics.avgTimeToReply !== undefined && (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-1">
                              {formatReplyTime(metrics.avgTimeToReply)}
                            </div>
                            <div className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80">
                              평균 회신 시간
                            </div>
                          </div>
                        </div>
                      )}
                      {metrics.minTimeToReply !== undefined && (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-1 flex items-center justify-center gap-1">
                              <TrendingDown className="h-4 w-4" />
                              {formatReplyTime(metrics.minTimeToReply)}
                            </div>
                            <div className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80">
                              최단 회신 시간
                            </div>
                          </div>
                        </div>
                      )}
                      {metrics.maxTimeToReply !== undefined && (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                          <div className="text-center">
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mb-1 flex items-center justify-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              {formatReplyTime(metrics.maxTimeToReply)}
                            </div>
                            <div className="text-xs font-medium text-blue-600/80 dark:text-blue-400/80">
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
                  <div className="pt-6 border-t mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950">
                          <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          회신 내용 요약
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium">
                        {metrics.replySummaries.length}개
                      </Badge>
                    </div>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {metrics.replySummaries.map((summary, index) => (
                        <div
                          key={summary.originalEmailId}
                          className="group relative bg-gradient-to-r from-muted/30 to-muted/10 dark:from-muted/20 dark:to-muted/5 rounded-lg p-3 border border-border/50 hover:border-primary/30 dark:hover:border-primary/20 transition-all duration-200 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold shrink-0 bg-background"
                              >
                                #{index + 1}
                              </Badge>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span className="font-medium">
                                  {formatReplyTime(summary.replyTime)}
                                </span>
                              </div>
                            </div>
                            {summary.sentiment && (
                              <Badge
                                variant={
                                  summary.sentiment === "positive"
                                    ? "default"
                                    : summary.sentiment === "negative"
                                      ? "destructive"
                                      : "secondary"
                                }
                                className="text-xs font-medium shrink-0"
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
                                variant="outline"
                                className="text-xs font-medium bg-background/50"
                              >
                                의도: {summary.intent}
                              </Badge>
                            </div>
                          )}
                          {summary.aiSummary && (
                            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2 group-hover:text-foreground/80 transition-colors">
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
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`
  } else {
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor((minutes % 1440) / 60)
    return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`
  }
}
