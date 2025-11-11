import { BarChart3, Calendar, CheckCircle, Clock, Mail, Pause, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useSequences } from "@/lib/api/hooks/sequences"
import type { Sequence, SequenceStatus, SequencesParams } from "@/lib/api/types/sequence"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"

interface CampaignCardViewProps {
  searchQuery: string
  selectedStatuses: string[]
  onEditSequence: (sequence: Sequence) => void
}

export function CampaignCardView({
  searchQuery,
  selectedStatuses,
  onEditSequence,
}: CampaignCardViewProps) {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()

  const workspaceFilter =
    !selectedWorkspace || selectedWorkspace.id === "all" ? undefined : [selectedWorkspace.id]

  // Build params for API call
  const params: SequencesParams = {
    page: 1,
    limit: 100,
    status:
      selectedStatuses?.length === 1
        ? (selectedStatuses[0] as SequenceStatus)
        : selectedStatuses?.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
    workspaceIds: workspaceFilter,
  }

  const { data: sequencesData, isLoading } = useSequences(params)

  const sequences = sequencesData?.sequences || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-3 w-3" />
      case "paused":
        return <Pause className="h-3 w-3" />
      case "completed":
        return <CheckCircle className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (sequences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">캠페인이 없습니다</p>
        <p className="text-sm text-muted-foreground">
          "새 캠페인" 버튼을 눌러 첫 캠페인을 만들어보세요
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sequences.map((sequence) => {
        const isActive = ["active", "paused", "completed", "archived"].includes(sequence.status)
        const progress = isActive
          ? sequence.completedEnrollmentsCount && sequence.enrollmentsCount
            ? (sequence.completedEnrollmentsCount / sequence.enrollmentsCount) * 100
            : 0
          : 0

        return (
          <Card
            key={sequence.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onEditSequence(sequence)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-base line-clamp-1">{sequence.name}</h3>
                <Badge
                  variant="secondary"
                  className={cn("text-xs flex items-center gap-1", getStatusColor(sequence.status))}
                >
                  {getStatusIcon(sequence.status)}
                  {t(`sequences.table.status.${sequence.status}`)}
                </Badge>
              </div>
              {sequence.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{sequence.description}</p>
              )}
            </CardHeader>

            <CardContent className="pb-3">
              <div className="space-y-3">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">워크스페이스:</span>
                  </div>
                  <span className="font-medium truncate">{sequence.workspaceName}</span>

                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">고객그룹:</span>
                  </div>
                  <span className="font-medium truncate">{sequence.customerGroupName || "-"}</span>

                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">스텝 수:</span>
                  </div>
                  <span className="font-medium">{sequence.stepsCount || 0}개</span>
                </div>

                {/* Active Campaign Stats */}
                {isActive && (
                  <div className="pt-3 border-t space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">진행률</span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />

                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">발송</div>
                        <div className="text-sm font-semibold">
                          {sequence.enrollmentsCount || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">오픈</div>
                        <div className="text-sm font-semibold">-</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">회신</div>
                        <div className="text-sm font-semibold">-</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-3 border-t">
              <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(sequence.createdAt).toLocaleDateString("ko-KR")}
                </div>
                {isActive && (
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    <span className="font-medium text-foreground">
                      {sequence.stepsCount || 0}/{sequence.stepsCount || 0} 스텝
                    </span>
                  </div>
                )}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
