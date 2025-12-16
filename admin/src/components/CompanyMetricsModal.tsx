import {
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  MailOpen,
  MousePointer,
  Reply,
  TrendingUp,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"

type CompanyMetricsModalProps = {
  isOpen: boolean
  onClose: () => void
  isLoading?: boolean
  companyData?: {
    companyName: string
    emailAddress: string
    enrollmentId: string
    status: string
    enrolledAt: string
    currentStep: number
    totalSteps: number

    // 이메일 발송 통계
    emailsSent: number
    emailsDelivered: number
    emailsOpened: number
    emailsClicked: number
    emailsReplied: number
    emailsBounced: number

    // 성과 지표
    openRate: number
    clickRate: number
    replyRate: number
    bounceRate: number

    // 시간 통계
    firstEmailSentAt?: string
    lastEmailSentAt?: string
    avgTimeToOpen?: number
    avgTimeToReply?: number

    // 상세 이메일 이력
    emailHistory: Array<{
      stepOrder: number
      subject: string
      sentAt: string
      status:
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "replied"
        | "bounced"
        | "failed"
        | "spam"
      openCount: number
      clickCount: number
      deliveredAt?: string
      openedAt?: string
      clickedAt?: string
      repliedAt?: string
      bounceType?: string | null
      bounceReason?: string | null
      errorMessage?: string | null
    }>
  }
}

export function CompanyMetricsModal({
  isOpen,
  onClose,
  isLoading = false,
  companyData,
}: CompanyMetricsModalProps) {
  if (isLoading) {
    return (
      <Dialog onOpenChange={onClose} open={isOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>회사별 상세 지표</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">로딩 중...</div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!companyData) {
    return null
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })

  const formatPercentage = (rate: number) => `${rate.toFixed(1)}%`

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "진행 중", variant: "default" as const },
      paused: { label: "일시정지", variant: "secondary" as const },
      completed: { label: "완료", variant: "outline" as const },
      stopped: { label: "중지됨", variant: "destructive" as const },
      bounced: { label: "반송됨", variant: "destructive" as const },
      unsubscribed: { label: "구독취소", variant: "destructive" as const },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      variant: "outline" as const,
    }

    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getEmailStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Mail className="h-4 w-4 text-blue-600" />
      case "delivered":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "opened":
        return <MailOpen className="h-4 w-4 text-blue-600" />
      case "clicked":
        return <MousePointer className="h-4 w-4 text-purple-600" />
      case "replied":
        return <Reply className="h-4 w-4 text-green-600" />
      case "bounced":
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Mail className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div>
              <h2 className="font-bold text-xl">{companyData.companyName}</h2>
              <p className="text-muted-foreground text-sm">{companyData.emailAddress}</p>
            </div>
            {getStatusBadge(companyData.status)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">기본 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-sm">등록일</p>
                  <p className="font-medium">{formatDate(companyData.enrolledAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">현재 단계</p>
                  <p className="font-medium">
                    Step {companyData.currentStep}/{companyData.totalSteps}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">첫 발송</p>
                  <p className="font-medium">
                    {companyData.firstEmailSentAt
                      ? formatDate(companyData.firstEmailSentAt)
                      : "대기 중"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">마지막 발송</p>
                  <p className="font-medium">
                    {companyData.lastEmailSentAt ? formatDate(companyData.lastEmailSentAt) : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 발송 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                발송 통계
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="font-bold text-2xl text-blue-600">{companyData.emailsSent}</div>
                  <p className="text-muted-foreground text-sm">발송</p>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl text-green-600">
                    {companyData.emailsDelivered}
                  </div>
                  <p className="text-muted-foreground text-sm">전달</p>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl text-blue-600">{companyData.emailsOpened}</div>
                  <p className="text-muted-foreground text-sm">오픈</p>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl text-purple-600">
                    {companyData.emailsClicked}
                  </div>
                  <p className="text-muted-foreground text-sm">클릭</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 성과 지표 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">성과 지표</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>오픈률</span>
                      <span className="font-medium">{formatPercentage(companyData.openRate)}</span>
                    </div>
                    <Progress className="h-2" value={companyData.openRate} />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>클릭률</span>
                      <span className="font-medium">{formatPercentage(companyData.clickRate)}</span>
                    </div>
                    <Progress className="h-2" value={companyData.clickRate} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>답장률</span>
                      <span className="font-medium">{formatPercentage(companyData.replyRate)}</span>
                    </div>
                    <Progress className="h-2" value={companyData.replyRate} />
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>반송률</span>
                      <span className="font-medium text-red-600">
                        {formatPercentage(companyData.bounceRate)}
                      </span>
                    </div>
                    <Progress className="h-2" value={companyData.bounceRate} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 시간 통계 */}
          {(companyData.avgTimeToOpen || companyData.avgTimeToReply) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-5 w-5" />
                  시간 통계
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {companyData.avgTimeToOpen && (
                    <div className="text-center">
                      <div className="font-semibold text-blue-600 text-lg">
                        {Math.round(companyData.avgTimeToOpen)}분
                      </div>
                      <p className="text-muted-foreground text-sm">평균 오픈 시간</p>
                    </div>
                  )}
                  {companyData.avgTimeToReply && (
                    <div className="text-center">
                      <div className="font-semibold text-green-600 text-lg">
                        {Math.round(companyData.avgTimeToReply)}분
                      </div>
                      <p className="text-muted-foreground text-sm">평균 답장 시간</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 이메일 이력 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                이메일 발송 이력
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {companyData.emailHistory.map((email, index) => (
                  <div className="rounded-lg border p-4" key={index}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getEmailStatusIcon(email.status)}
                        <span className="font-medium">Step {email.stepOrder}</span>
                        <Badge className="text-xs" variant="outline">
                          {email.status}
                        </Badge>
                      </div>
                      <span className="text-muted-foreground text-sm">
                        {formatDate(email.sentAt)}
                      </span>
                    </div>
                    <p className="mb-3 text-muted-foreground text-sm">{email.subject}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <MailOpen className="h-3 w-3 text-blue-600" />
                        <span>{email.openCount}회 오픈</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MousePointer className="h-3 w-3 text-purple-600" />
                        <span>{email.clickCount}회 클릭</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Reply className="h-3 w-3 text-green-600" />
                        <span>
                          {email.repliedAt ? `${formatDate(email.repliedAt)} 답장` : "답장 없음"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
