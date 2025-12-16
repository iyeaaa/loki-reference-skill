import { Activity, Mail, MessageSquare, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSequencesOverallStats } from "@/lib/api/hooks/sequences"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

export function SequencesDashboard() {
  const { selectedWorkspace } = useWorkspace()

  // "all" 워크스페이스가 선택된 경우 undefined를 전달하여 전체 통계 조회
  const workspaceId = selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id

  const { data, isLoading, isError } = useSequencesOverallStats(workspaceId)

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return null
  }

  const stats = data.data

  // 실행 중인 캠페인 수 (active + paused + completed + archived)
  const activeCampaignCount =
    stats.activeSequences +
    stats.pausedSequences +
    stats.completedSequences +
    stats.archivedSequences

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 실행된 캠페인 개수 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">실행된 캠페인</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{activeCampaignCount}</div>
            <p className="text-muted-foreground text-xs">
              활성 {stats.activeSequences} · 일시정지 {stats.pausedSequences}
            </p>
          </CardContent>
        </Card>

        {/* 총 발송 수 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">총 발송</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.totalDelivered.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">
              {stats.totalSent.toLocaleString()}건 발송 시도
            </p>
          </CardContent>
        </Card>

        {/* 총 오픈률 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">총 오픈률</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.openRate.toFixed(1)}%</div>
            <p className="text-muted-foreground text-xs">
              {stats.totalOpened.toLocaleString()}명이 오픈
            </p>
          </CardContent>
        </Card>

        {/* 총 회신률 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">총 회신률</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{stats.replyRate.toFixed(1)}%</div>
            <p className="text-muted-foreground text-xs">
              {stats.totalReplied.toLocaleString()}건 회신
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
