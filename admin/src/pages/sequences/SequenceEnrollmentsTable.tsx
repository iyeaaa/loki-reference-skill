import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Mail,
  MousePointer,
  Pause,
  StopCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CompanyMetricsModal } from "@/components/CompanyMetricsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useEnrollmentMetrics,
  useEnrollmentStepExecutions,
  useSequenceEnrollments,
  useSequenceSteps,
} from "@/lib/api/hooks/sequences";
import type { EnrollmentStatus } from "@/lib/api/types/sequence";

// StepExecutionDetails - 스텝 실행 상세 정보 표시
function StepExecutionDetails({
  sequenceId,
  enrollmentId,
}: {
  sequenceId: string;
  enrollmentId: string;
}) {
  const { t } = useTranslation();
  const {
    data: executions,
    isLoading,
    error,
  } = useEnrollmentStepExecutions(sequenceId, enrollmentId, true);

  console.log("StepExecutionDetails Debug:", {
    sequenceId,
    enrollmentId,
    executions,
    isLoading,
    error,
  });

  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t("sequences.enrollments.stepExecutions.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        에러: {error instanceof Error ? error.message : "알 수 없는 에러"}
      </div>
    );
  }

  if (!executions || executions.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {t("sequences.enrollments.stepExecutions.noSteps")}
        <div className="text-xs mt-2">
          (sequenceId: {sequenceId}, enrollmentId: {enrollmentId})
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    if (status === "sent") {
      return <Badge className="bg-green-600">발송완료</Badge>;
    }
    if (status === "pending") {
      return <Badge variant="secondary">대기</Badge>;
    }
    if (status === "failed") {
      return <Badge variant="destructive">실패</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="p-4 bg-muted/30">
      <h4 className="text-sm font-semibold mb-3">📋 스텝별 발송 일정</h4>
      <div className="space-y-2">
        {executions.map((execution) => (
          <div
            key={execution.id}
            className="flex items-center justify-between p-3 bg-background border rounded-lg text-sm"
          >
            <div className="flex-1">
              <div className="font-medium mb-1">
                스텝 {execution.stepOrder}: {execution.emailSubject}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  예정: {formatDate(execution.scheduledAt)}
                </span>
                {execution.executedAt && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    발송: {formatDate(execution.executedAt)}
                  </span>
                )}
              </div>
              {execution.errorMessage && (
                <div className="text-xs text-red-600 mt-1">
                  {execution.errorMessage}
                </div>
              )}
            </div>
            <div>{getStatusBadge(execution.status)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// EnrollmentOpenStatus - 실제 오픈 상태를 표시하는 컴포넌트
function EnrollmentOpenStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation();
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId);

  if (isLoading) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("sequences.enrollments.loading")}
      </span>
    );
  }

  if (!metricsData?.data) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const { emailsSent, emailsOpened } = metricsData.data;

  if (emailsSent === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  if (emailsOpened > 0) {
    return (
      <div className="flex items-center gap-1 text-sm text-green-600">
        <Eye className="w-3 h-3" />
        <span className="font-medium">
          {t("sequences.enrollments.open.opened")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600">
      <Eye className="w-3 h-3" />
      <span className="font-medium">
        {t("sequences.enrollments.open.notOpened")}
      </span>
    </div>
  );
}

// EnrollmentDeliveryStatus - 발송완료 상태를 표시하는 컴포넌트
function EnrollmentDeliveryStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation();
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId);

  if (isLoading) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("sequences.enrollments.loading")}
      </span>
    );
  }

  if (!metricsData?.data) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const { emailsSent, emailsDelivered, emailsBounced, emailsFailed } =
    metricsData.data;

  if (emailsSent === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  // 발송 실패 (bounced, failed, spam, dropped)
  if (emailsBounced > 0 || (emailsFailed && emailsFailed > 0)) {
    return (
      <div className="flex items-center gap-1 text-sm text-red-600">
        <XCircle className="w-3 h-3" />
        <span className="font-medium">
          {t("sequences.enrollments.delivery.failed")}
        </span>
      </div>
    );
  }

  // 전달 완료
  if (emailsDelivered > 0) {
    return (
      <div className="flex items-center gap-1 text-sm text-green-600">
        <CheckCircle className="w-3 h-3" />
        <span className="font-medium">
          {t("sequences.enrollments.delivery.completed")}
        </span>
      </div>
    );
  }

  // 발송 중 (전달 대기)
  return (
    <div className="flex items-center gap-1 text-sm text-blue-600">
      <Mail className="w-3 h-3" />
      <span className="font-medium">
        {t("sequences.enrollments.delivery.sending")}
      </span>
    </div>
  );
}

// EnrollmentClickStatus - 실제 클릭 상태를 표시하는 컴포넌트
function EnrollmentClickStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation();
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId);

  if (isLoading) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("sequences.enrollments.loading")}
      </span>
    );
  }

  if (!metricsData?.data) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const { emailsSent, emailsClicked } = metricsData.data;

  if (emailsSent === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  if (emailsClicked > 0) {
    return (
      <div className="flex items-center gap-1 text-sm text-green-600">
        <MousePointer className="w-3 h-3" />
        <span className="font-medium">
          {t("sequences.enrollments.click.clicked")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600">
      <MousePointer className="w-3 h-3" />
      <span className="font-medium">
        {t("sequences.enrollments.click.notClicked")}
      </span>
    </div>
  );
}

// EnrollmentReplyStatus - 실제 답장 상태를 표시하는 컴포넌트
function EnrollmentReplyStatus({ enrollmentId }: { enrollmentId: string }) {
  const { t } = useTranslation();
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId);

  if (isLoading) {
    return (
      <span className="text-sm text-muted-foreground">
        {t("sequences.enrollments.loading")}
      </span>
    );
  }

  if (!metricsData?.data) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const { emailsSent, emailsReplied } = metricsData.data;

  if (emailsSent === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  if (emailsReplied > 0) {
    return (
      <div className="flex items-center gap-1 text-sm text-green-600">
        <CheckCircle2 className="w-3 h-3" />
        <span className="font-medium">
          {t("sequences.enrollments.reply.replied")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-sm text-gray-600">
      <CheckCircle2 className="w-3 h-3" />
      <span className="font-medium">
        {t("sequences.enrollments.reply.notReplied")}
      </span>
    </div>
  );
}

// CompanyMetricsModalWithData - 실제 API 데이터를 사용하는 모달 컴포넌트
interface CompanyMetricsModalWithDataProps {
  isOpen: boolean;
  onClose: () => void;
  enrollmentId: string;
}

function CompanyMetricsModalWithData({
  isOpen,
  onClose,
  enrollmentId,
}: CompanyMetricsModalWithDataProps) {
  const { data: metricsData, isLoading } = useEnrollmentMetrics(enrollmentId);

  console.log("metricsData", metricsData);

  return (
    <CompanyMetricsModal
      isOpen={isOpen}
      onClose={onClose}
      companyData={metricsData?.data}
      isLoading={isLoading}
    />
  );
}

interface SequenceEnrollmentsTableProps {
  sequenceId: string;
}

export function SequenceEnrollmentsTable({
  sequenceId,
}: SequenceEnrollmentsTableProps) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<
    string | null
  >(null);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<
    string | null
  >(null);
  const limit = 10;

  const { data: enrollmentsData, isLoading: enrollmentsLoading } =
    useSequenceEnrollments(sequenceId, currentPage, limit, !!sequenceId);

  const { data: steps = [] } = useSequenceSteps(sequenceId, !!sequenceId);

  const totalSteps = steps.length;

  if (enrollmentsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("sequences.enrollments.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            {t("sequences.enrollments.loading")}
          </div>
        </CardContent>
      </Card>
    );
  }

  const enrollments = enrollmentsData?.enrollments || [];
  const totalPages = enrollmentsData?.totalPages || 1;

  const getStatusBadge = (status: EnrollmentStatus) => {
    const statusConfig: Record<
      EnrollmentStatus,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
        icon: LucideIcon;
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
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getProgressPercentage = (currentStep: number, totalSteps: number) => {
    if (totalSteps === 0) return 0;
    return Math.round((currentStep / totalSteps) * 100);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t("sequences.enrollments.title")}</span>
            <Badge variant="secondary">
              {t("sequences.enrollments.totalEnrolled", {
                count: enrollmentsData?.total || 0,
              })}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("sequences.enrollments.noEnrollments")}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t("sequences.enrollments.column.companyName")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.status")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.progress")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.sent")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.delivered")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.opened")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.clicked")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.replied")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.enrolledAt")}
                      </TableHead>
                      <TableHead>
                        {t("sequences.enrollments.column.viewDetails")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.map((enrollment) => {
                      const progress = getProgressPercentage(
                        enrollment.currentStepOrder,
                        totalSteps
                      );

                      // 실제 데이터 기반 간단한 상태 표시
                      const hasEmailsSent = enrollment.currentStepOrder > 0;

                      const handleViewDetails = () => {
                        setSelectedEnrollmentId(enrollment.id);
                        setShowMetricsModal(true);
                      };

                      const isExpanded = expandedEnrollmentId === enrollment.id;
                      const toggleExpand = () => {
                        setExpandedEnrollmentId(
                          isExpanded ? null : enrollment.id
                        );
                      };

                      return (
                        <>
                          <TableRow
                            key={enrollment.id}
                            className="hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col gap-1">
                                <span>
                                  {enrollment.leadCompanyName ||
                                    t(
                                      "sequences.enrollments.companyNameUnknown"
                                    )}
                                </span>
                                {enrollment.emailAccountAddress && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {enrollment.emailAccountAddress}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(enrollment.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2 min-w-[120px]">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {t("sequences.enrollments.progress.step", {
                                      current: enrollment.currentStepOrder,
                                      total: totalSteps,
                                    })}
                                  </span>
                                  <span className="font-medium">
                                    {progress}%
                                  </span>
                                </div>
                                <Progress value={progress} className="h-2" />
                              </div>
                            </TableCell>
                            <TableCell>
                              {hasEmailsSent ? (
                                <div className="flex items-center gap-1 text-sm text-blue-600">
                                  <Mail className="w-3 h-3" />
                                  <span className="font-medium">
                                    {t("sequences.enrollments.sent.count", {
                                      count: enrollment.currentStepOrder,
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {t("sequences.enrollments.sent.waiting")}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <EnrollmentDeliveryStatus
                                enrollmentId={enrollment.id}
                              />
                            </TableCell>
                            <TableCell>
                              <EnrollmentOpenStatus
                                enrollmentId={enrollment.id}
                              />
                            </TableCell>
                            <TableCell>
                              <EnrollmentClickStatus
                                enrollmentId={enrollment.id}
                              />
                            </TableCell>
                            <TableCell>
                              <EnrollmentReplyStatus
                                enrollmentId={enrollment.id}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm">
                                <Calendar className="w-3 h-3 text-muted-foreground" />
                                {formatDate(enrollment.enrolledAt)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={toggleExpand}
                                  className="flex items-center gap-1"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3" />
                                  )}
                                  스텝 일정
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleViewDetails}
                                  className="flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3" />
                                  {t("sequences.enrollments.viewDetailsButton")}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={9} className="p-0">
                                <StepExecutionDetails
                                  sequenceId={sequenceId}
                                  enrollmentId={enrollment.id}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {t("sequences.enrollments.pagination.page", {
                      current: currentPage,
                      total: totalPages,
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      {t("sequences.enrollments.pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
                      disabled={currentPage === totalPages}
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

      {/* 회사별 상세 지표 모달 */}
      {selectedEnrollmentId && (
        <CompanyMetricsModalWithData
          isOpen={showMetricsModal}
          onClose={() => {
            setShowMetricsModal(false);
            setSelectedEnrollmentId(null);
          }}
          enrollmentId={selectedEnrollmentId}
        />
      )}
    </>
  );
}
