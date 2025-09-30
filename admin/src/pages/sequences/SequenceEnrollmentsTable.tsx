import { Calendar, CheckCircle2, Clock, Mail, Pause, StopCircle, XCircle } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSequenceEnrollments, useSequenceSteps } from "@/lib/api/hooks/sequences"
import type { EnrollmentStatus } from "@/lib/api/types/sequence"

interface SequenceEnrollmentsTableProps {
  sequenceId: string
}

export function SequenceEnrollmentsTable({ sequenceId }: SequenceEnrollmentsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const limit = 10

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useSequenceEnrollments(
    sequenceId,
    currentPage,
    limit,
    !!sequenceId
  )

  const { data: steps = [] } = useSequenceSteps(sequenceId, !!sequenceId)

  const totalSteps = steps.length

  if (enrollmentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>등록 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
        </CardContent>
      </Card>
    )
  }

  const enrollments = enrollmentsData?.enrollments || []
  const totalPages = enrollmentsData?.totalPages || 1

  const getStatusBadge = (status: EnrollmentStatus) => {
    const statusConfig: Record<
      EnrollmentStatus,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }
    > = {
      active: { label: "진행 중", variant: "default", icon: Clock },
      paused: { label: "일시정지", variant: "secondary", icon: Pause },
      completed: { label: "완료", variant: "outline", icon: CheckCircle2 },
      stopped: { label: "중지됨", variant: "destructive", icon: StopCircle },
      bounced: { label: "반송됨", variant: "destructive", icon: XCircle },
      unsubscribed: { label: "구독취소", variant: "destructive", icon: XCircle },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const getProgressPercentage = (currentStep: number, totalSteps: number) => {
    if (totalSteps === 0) return 0
    return Math.round((currentStep / totalSteps) * 100)
  }

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-"
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
          <span>등록 현황</span>
          <Badge variant="secondary">
            총 {enrollmentsData?.total || 0}명 등록
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {enrollments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            등록된 리드가 없습니다
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>회사명</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>진행도</TableHead>
                    <TableHead>등록일</TableHead>
                    <TableHead>첫 발송</TableHead>
                    <TableHead>마지막 발송</TableHead>
                    <TableHead>다음 발송 예정</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => {
                    const progress = getProgressPercentage(
                      enrollment.currentStepOrder,
                      totalSteps
                    )

                    return (
                      <TableRow key={enrollment.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span>{enrollment.leadCompanyName || "알 수 없음"}</span>
                            {enrollment.emailAccountAddress && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {enrollment.emailAccountAddress}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(enrollment.status)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2 min-w-[150px]">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Step {enrollment.currentStepOrder}/{totalSteps}
                              </span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {formatDate(enrollment.enrolledAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {enrollment.firstEmailSentAt ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3 h-3" />
                              {formatDate(enrollment.firstEmailSentAt)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">대기 중</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(enrollment.lastEmailSentAt)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {enrollment.status === "active" && enrollment.nextStepScheduledAt ? (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Clock className="w-3 h-3" />
                              {formatDate(enrollment.nextStepScheduledAt)}
                            </div>
                          ) : enrollment.status === "completed" ? (
                            <span className="text-muted-foreground">완료됨</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  페이지 {currentPage} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    이전
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    다음
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