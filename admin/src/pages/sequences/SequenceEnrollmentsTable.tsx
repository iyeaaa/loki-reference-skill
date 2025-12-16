import type { LucideIcon } from "lucide-react"
import {
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Filter,
  Info,
  Mail,
  MousePointer,
  Pause,
  Search,
  StopCircle,
  X,
  XCircle,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useEnrollmentMetrics,
  useEnrollmentStepExecutions,
  useSequenceEnrollments,
  useSequenceSteps,
} from "@/lib/api/hooks/sequences"
import type { EnrollmentStatus } from "@/lib/api/types/sequence"

// StepExecutionDetails - 스텝 실행 상세 정보 표시
function StepExecutionDetails({
  sequenceId,
  enrollmentId,
}: {
  sequenceId: string
  enrollmentId: string
}) {
  const { t } = useTranslation()
  const {
    data: executions,
    isLoading,
    error,
  } = useEnrollmentStepExecutions(sequenceId, enrollmentId, true)

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        {t("sequences.enrollments.stepExecutions.loading")}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 text-sm">
        {t("sequences.enrollments.stepExecutions.error")}{" "}
        {error instanceof Error
          ? error.message
          : t("sequences.enrollments.stepExecutions.unknownError")}
      </div>
    )
  }

  if (!executions || executions.length === 0) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        {t("sequences.enrollments.stepExecutions.noSteps")}
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    if (status === "sent") {
      return (
        <Badge className="bg-green-600">
          {t("sequences.enrollments.stepExecutions.status.sent")}
        </Badge>
      )
    }
    if (status === "pending") {
      return (
        <Badge variant="secondary">
          {t("sequences.enrollments.stepExecutions.status.pending")}
        </Badge>
      )
    }
    if (status === "failed") {
      return (
        <Badge variant="destructive">
          {t("sequences.enrollments.stepExecutions.status.failed")}
        </Badge>
      )
    }
    return <Badge variant="outline">{status}</Badge>
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

  return (
    <div className="bg-muted/30 p-4">
      <h4 className="mb-3 font-semibold text-sm">
        {t("sequences.enrollments.stepExecutions.title")}
      </h4>
      <div className="space-y-2">
        {executions.map((execution) => (
          <div
            className="flex items-center justify-between rounded-lg border bg-background p-3 text-sm"
            key={execution.id}
          >
            <div className="flex-1">
              <div className="mb-1 font-medium">
                {t("sequences.enrollments.stepExecutions.step", {
                  order: execution.stepOrder,
                })}
                : {execution.emailSubject}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("sequences.enrollments.stepExecutions.scheduled")}{" "}
                  {formatDate(execution.scheduledAt)}
                </span>
                {execution.executedAt && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    {t("sequences.enrollments.stepExecutions.executed")}{" "}
                    {formatDate(execution.executedAt)}
                  </span>
                )}
              </div>
              {execution.errorMessage && (
                <div className="mt-1 text-red-600 text-xs">{execution.errorMessage}</div>
              )}
            </div>
            <div>{getStatusBadge(execution.status)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// EnrollmentOpenStatus - 실제 오픈 상태를 표시하는 컴포넌트
function EnrollmentOpenStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation()
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId)

  if (isLoading) {
    return (
      <span className="text-muted-foreground text-sm">{t("sequences.enrollments.loading")}</span>
    )
  }

  if (!metricsData?.data) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  const { emailsSent, emailsOpened } = metricsData.data

  if (emailsSent === 0) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  if (emailsOpened > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-sm">
        <Eye className="h-3 w-3" />
        <span className="font-medium">{t("sequences.enrollments.open.opened")}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-gray-600 text-sm">
      <Eye className="h-3 w-3" />
      <span className="font-medium">{t("sequences.enrollments.open.notOpened")}</span>
    </div>
  )
}

// EnrollmentDeliveryStatus - 발송완료 상태를 표시하는 컴포넌트
function EnrollmentDeliveryStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation()
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId)

  if (isLoading) {
    return (
      <span className="text-muted-foreground text-sm">{t("sequences.enrollments.loading")}</span>
    )
  }

  if (!metricsData?.data) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  const { emailsSent, emailsDelivered, emailsBounced, emailsFailed, emailHistory } =
    metricsData.data

  if (emailsSent === 0) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  // 발송 실패 (bounced, failed, spam, dropped)
  if (emailsBounced > 0 || (emailsFailed && emailsFailed > 0)) {
    // 실패한 이메일의 이유 찾기
    const failedEmail = emailHistory?.find(
      (email) => email.status === "bounced" || email.status === "failed" || email.status === "spam",
    )

    const failureReason =
      failedEmail?.bounceReason ||
      failedEmail?.errorMessage ||
      (failedEmail?.bounceType && `Bounce Type: ${failedEmail.bounceType}`) ||
      "이유 없음"

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-help items-center gap-1 text-red-600 text-sm decoration-dotted hover:underline">
            <XCircle className="h-3 w-3" />
            <span className="font-medium">{t("sequences.enrollments.delivery.failed")}</span>
            <Info className="h-3 w-3 opacity-70" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-medium text-sm">{t("sequences.enrollments.delivery.failureReason")}</p>
          <p className="text-muted-foreground text-xs">{failureReason}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  // 전달 완료
  if (emailsDelivered > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-sm">
        <CheckCircle className="h-3 w-3" />
        <span className="font-medium">{t("sequences.enrollments.delivery.completed")}</span>
      </div>
    )
  }

  // 발송 중 (전달 대기)
  return (
    <div className="flex items-center gap-1 text-blue-600 text-sm">
      <Mail className="h-3 w-3" />
      <span className="font-medium">{t("sequences.enrollments.delivery.sending")}</span>
    </div>
  )
}

// EnrollmentClickStatus - 실제 클릭 상태를 표시하는 컴포넌트
function EnrollmentClickStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation()
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId)

  if (isLoading) {
    return (
      <span className="text-muted-foreground text-sm">{t("sequences.enrollments.loading")}</span>
    )
  }

  if (!metricsData?.data) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  const { emailsSent, emailsClicked } = metricsData.data

  if (emailsSent === 0) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  if (emailsClicked > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-sm">
        <MousePointer className="h-3 w-3" />
        <span className="font-medium">{t("sequences.enrollments.click.clicked")}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-gray-600 text-sm">
      <MousePointer className="h-3 w-3" />
      <span className="font-medium">{t("sequences.enrollments.click.notClicked")}</span>
    </div>
  )
}

// EnrollmentReplyStatus - 실제 답장 상태를 표시하는 컴포넌트
function EnrollmentReplyStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation()
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId)

  if (isLoading) {
    return (
      <span className="text-muted-foreground text-sm">{t("sequences.enrollments.loading")}</span>
    )
  }

  if (!metricsData?.data) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  const { emailsSent, emailsReplied } = metricsData.data

  if (emailsSent === 0) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  if (emailsReplied > 0) {
    return (
      <div className="flex items-center gap-1 text-green-600 text-sm">
        <CheckCircle2 className="h-3 w-3" />
        <span className="font-medium">{t("sequences.enrollments.reply.replied")}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-gray-600 text-sm">
      <CheckCircle2 className="h-3 w-3" />
      <span className="font-medium">{t("sequences.enrollments.reply.notReplied")}</span>
    </div>
  )
}

type SequenceEnrollmentsTableProps = {
  sequenceId: string
}

export function SequenceEnrollmentsTable({ sequenceId }: SequenceEnrollmentsTableProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<{
    companyName?: string
    opened?: boolean
    clicked?: boolean
    replied?: boolean
    delivered?: boolean
  }>({})
  const limit = 10

  // 검색어 디바운싱 (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        companyName: searchQuery || undefined,
      }))
      setCurrentPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useSequenceEnrollments(
    sequenceId,
    currentPage,
    limit,
    !!sequenceId,
    filters,
  )

  const { data: steps = [] } = useSequenceSteps(sequenceId, !!sequenceId)

  const totalSteps = steps.length

  if (enrollmentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("sequences.enrollments.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            {t("sequences.enrollments.loading")}
          </div>
        </CardContent>
      </Card>
    )
  }

  const enrollments = enrollmentsData?.enrollments || []
  const totalPages = enrollmentsData?.totalPages || 1
  const hasActiveFilters =
    searchQuery.trim() !== "" || Object.values(filters).some((v) => v !== undefined && v !== "")

  const getStatusBadge = (status: EnrollmentStatus) => {
    const statusConfig: Record<
      EnrollmentStatus,
      {
        label: string
        variant: "default" | "secondary" | "destructive" | "outline"
        icon: LucideIcon
      }
    > = {
      active: {
        label: t("sequences.enrollments.status.active"),
        variant: "default",
        icon: Clock,
      },
      paused: {
        label: t("sequences.enrollments.status.paused"),
        variant: "secondary",
        icon: Pause,
      },
      completed: {
        label: t("sequences.enrollments.status.completed"),
        variant: "outline",
        icon: CheckCircle2,
      },
      stopped: {
        label: t("sequences.enrollments.status.stopped"),
        variant: "destructive",
        icon: StopCircle,
      },
      bounced: {
        label: t("sequences.enrollments.status.bounced"),
        variant: "destructive",
        icon: XCircle,
      },
      unsubscribed: {
        label: t("sequences.enrollments.status.unsubscribed"),
        variant: "destructive",
        icon: XCircle,
      },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <Badge className="flex w-fit items-center gap-1" variant={config.variant}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getProgressPercentage = (currentStep: number, totalSteps: number) => {
    if (totalSteps === 0) {
      return 0
    }
    return Math.round((currentStep / totalSteps) * 100)
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return "-"
    }
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("sequences.enrollments.title")}</span>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Badge variant="default">필터링: {enrollmentsData?.total || 0}개</Badge>
            )}
            {!hasActiveFilters && (
              <Badge variant="secondary">
                {t("sequences.enrollments.totalEnrolled", {
                  count: enrollmentsData?.total || 0,
                })}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 필터 UI */}
        <div className="mb-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="회사명 검색..."
                value={searchQuery}
              />
            </div>
            <Button
              className="flex items-center gap-2"
              onClick={() => setShowFilters(!showFilters)}
              size="default"
              variant={showFilters ? "default" : "outline"}
            >
              <Filter className="h-4 w-4" />
              필터
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2 rounded-md bg-muted/50 p-4">
              <Button
                onClick={() => {
                  setFilters({
                    ...filters,
                    opened: filters.opened === true ? undefined : true,
                  })
                  setCurrentPage(1)
                }}
                size="sm"
                variant={filters.opened === true ? "default" : "outline"}
              >
                오픈함
              </Button>
              <Button
                onClick={() => {
                  setFilters({
                    ...filters,
                    clicked: filters.clicked === true ? undefined : true,
                  })
                  setCurrentPage(1)
                }}
                size="sm"
                variant={filters.clicked === true ? "default" : "outline"}
              >
                클릭함
              </Button>
              <Button
                onClick={() => {
                  setFilters({
                    ...filters,
                    replied: filters.replied === true ? undefined : true,
                  })
                  setCurrentPage(1)
                }}
                size="sm"
                variant={filters.replied === true ? "default" : "outline"}
              >
                답장함
              </Button>
              <Button
                onClick={() => {
                  setFilters({
                    ...filters,
                    delivered: filters.delivered === true ? undefined : true,
                  })
                  setCurrentPage(1)
                }}
                size="sm"
                variant={filters.delivered === true ? "default" : "outline"}
              >
                발송완료
              </Button>
              {hasActiveFilters && (
                <Button
                  className="flex items-center gap-1"
                  onClick={() => {
                    setSearchQuery("")
                    setFilters({})
                    setCurrentPage(1)
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <X className="h-3 w-3" />
                  필터 초기화
                </Button>
              )}
            </div>
          )}
        </div>

        {enrollments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("sequences.enrollments.noEnrollments")}
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("sequences.enrollments.column.companyName")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.status")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.progress")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.sent")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.delivered")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.opened")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.clicked")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.replied")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.enrolledAt")}</TableHead>
                    <TableHead>{t("sequences.enrollments.column.viewDetails")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => {
                    const progress = getProgressPercentage(enrollment.currentStepOrder, totalSteps)

                    // 실제 데이터 기반 간단한 상태 표시
                    const hasEmailsSent = enrollment.currentStepOrder > 0

                    const isExpanded = expandedEnrollmentId === enrollment.id
                    const toggleExpand = () => {
                      setExpandedEnrollmentId(isExpanded ? null : enrollment.id)
                    }

                    return (
                      <>
                        <TableRow className="hover:bg-muted/50" key={enrollment.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <span>
                                {enrollment.leadCompanyName ||
                                  t("sequences.enrollments.companyNameUnknown")}
                              </span>
                              {enrollment.leadEmail && (
                                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                  <Mail className="h-3 w-3" />
                                  {enrollment.leadEmail}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                          <TableCell>
                            <div className="flex min-w-[120px] flex-col gap-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                  {t("sequences.enrollments.progress.step", {
                                    current: enrollment.currentStepOrder,
                                    total: totalSteps,
                                  })}
                                </span>
                                <span className="font-medium">{progress}%</span>
                              </div>
                              <Progress className="h-2" value={progress} />
                            </div>
                          </TableCell>
                          <TableCell>
                            {hasEmailsSent ? (
                              <div className="flex items-center gap-1 text-blue-600 text-sm">
                                <Mail className="h-3 w-3" />
                                <span className="font-medium">
                                  {t("sequences.enrollments.sent.count", {
                                    count: enrollment.currentStepOrder,
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {t("sequences.enrollments.sent.waiting")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <EnrollmentDeliveryStatus enrollmentId={enrollment.id} />
                          </TableCell>
                          <TableCell>
                            <EnrollmentOpenStatus enrollmentId={enrollment.id} />
                          </TableCell>
                          <TableCell>
                            <EnrollmentClickStatus enrollmentId={enrollment.id} />
                          </TableCell>
                          <TableCell>
                            <EnrollmentReplyStatus enrollmentId={enrollment.id} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(enrollment.enrolledAt)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              className="flex items-center gap-1"
                              onClick={toggleExpand}
                              size="sm"
                              variant="outline"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {t("sequences.enrollments.stepSchedule")}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell className="p-0" colSpan={10}>
                              <StepExecutionDetails
                                enrollmentId={enrollment.id}
                                sequenceId={sequenceId}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  {t("sequences.enrollments.pagination.page", {
                    current: currentPage,
                    total: totalPages,
                  })}
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    size="sm"
                    variant="outline"
                  >
                    {t("sequences.enrollments.pagination.previous")}
                  </Button>
                  <Button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    size="sm"
                    variant="outline"
                  >
                    {t("sequences.enrollments.pagination.next")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
