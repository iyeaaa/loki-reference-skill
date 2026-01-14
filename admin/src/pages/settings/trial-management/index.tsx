/**
 * Trial Management Dashboard
 * 체험판 유저 관리 대시보드
 */

import { format } from "date-fns"
import { AlertTriangle, ArrowDown, ArrowUp, RefreshCw } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOnboardingStepWorkspaces, useTrialAnalytics } from "@/lib/api/hooks/trial-analytics"
import type {
  CohortMode,
  OnboardingStep,
  WorkspaceEmailPerformance,
} from "@/lib/api/services/trial-analytics"
import { cn } from "@/lib/utils"

// ============================================================================
// Chart Configuration - 공통 스타일 설정
// ============================================================================

const CHART_COLORS = {
  primary: "hsl(221, 83%, 53%)", // blue-600
  secondary: "hsl(142, 76%, 36%)", // green-600
  tertiary: "hsl(38, 92%, 50%)", // amber-500
  muted: "hsl(215, 16%, 47%)", // slate-500
  grid: "hsl(214, 32%, 91%)", // slate-200
  text: "hsl(215, 25%, 27%)", // slate-700
  textMuted: "hsl(215, 16%, 47%)", // slate-500
}

const AXIS_STYLE = {
  fontSize: 12,
  fontFamily: "inherit",
  fill: CHART_COLORS.textMuted,
}

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  padding: "8px 12px",
  fontSize: "13px",
}

const ACTIVITY_COLORS: Record<string, string> = {
  오늘: "#22c55e",
  "1-3일": "#84cc16",
  "4-7일": "#eab308",
  "8-14일": "#f97316",
  "15-30일": "#ef4444",
  "30일+": "#991b1b",
}

const FUNNEL_COLORS = [
  "hsl(215, 16%, 47%)", // slate-500
  "hsl(199, 89%, 48%)", // sky-500
  "hsl(187, 85%, 43%)", // cyan-500
  "hsl(168, 76%, 42%)", // teal-500
  "hsl(45, 93%, 47%)", // amber-400
  "hsl(142, 76%, 36%)", // green-600
]

// ============================================================================
// Components
// ============================================================================

// Custom Tooltip Component
function CustomTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string; payload?: Record<string, unknown> }>
  label?: string
  formatter?: (value: number, name: string, payload?: Record<string, unknown>) => string
}) {
  if (!(active && payload?.length)) {
    return null
  }

  return (
    <div
      style={{
        ...TOOLTIP_STYLE,
        backgroundColor: "hsl(var(--popover))",
        color: "hsl(var(--popover-foreground))",
      }}
    >
      {label && <p className="mb-1 font-medium text-xs">{label}</p>}
      {payload.map((entry, index) => (
        <p className="text-xs" key={index} style={{ color: entry.color }}>
          {entry.name}:{" "}
          {formatter ? formatter(entry.value, entry.name, entry.payload) : entry.value}
        </p>
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

// Step name mapping for display
const STEP_NAMES: Record<OnboardingStep, string> = {
  signup: "가입완료",
  onboarding: "설문+로그인",
  company_info: "회사정보 입력",
  lead_created: "리드 생성",
  email_connected: "이메일 연동",
  email_sent: "이메일 발송",
}

export function TrialManagementPage() {
  const [days, setDays] = useState(30)
  const [cohortMode, setCohortMode] = useState<CohortMode>("weekly")
  const [selectedStep, setSelectedStep] = useState<OnboardingStep | null>(null)
  const [emailPerfSortBy, setEmailPerfSortBy] =
    useState<keyof WorkspaceEmailPerformance>("emailsSent")
  const [emailPerfSortOrder, setEmailPerfSortOrder] = useState<"asc" | "desc">("desc")

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useTrialAnalytics({ days, cohortMode })

  const { data: stepWorkspaces, isLoading: stepWorkspacesLoading } =
    useOnboardingStepWorkspaces(selectedStep)

  // Sort email performance workspaces
  const sortedEmailPerf = useMemo(() => {
    const workspaces = analytics?.emailPerformance?.workspaces ?? []
    return [...workspaces].sort((a, b) => {
      const aVal = a[emailPerfSortBy] ?? 0
      const bVal = b[emailPerfSortBy] ?? 0
      if (typeof aVal === "number" && typeof bVal === "number") {
        return emailPerfSortOrder === "desc" ? bVal - aVal : aVal - bVal
      }
      return 0
    })
  }, [analytics?.emailPerformance?.workspaces, emailPerfSortBy, emailPerfSortOrder])

  // Toggle sort for email performance table
  const handleEmailPerfSort = (column: keyof WorkspaceEmailPerformance) => {
    if (emailPerfSortBy === column) {
      setEmailPerfSortOrder(emailPerfSortOrder === "desc" ? "asc" : "desc")
    } else {
      setEmailPerfSortBy(column)
      setEmailPerfSortOrder("desc")
    }
  }

  // Handle funnel bar click
  const handleFunnelClick = (step: string) => {
    const stepMap: Record<string, OnboardingStep> = {
      가입완료: "signup",
      "설문+로그인": "onboarding",
      "회사정보 입력": "company_info",
      "리드 생성": "lead_created",
      "이메일 연동": "email_connected",
      "이메일 발송": "email_sent",
    }
    const mappedStep = stepMap[step]
    if (mappedStep) {
      setSelectedStep(mappedStep)
    }
  }

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...new Array(4)].map((_, i) => (
            <Skeleton className="h-28" key={i} />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...new Array(4)].map((_, i) => (
            <Skeleton className="h-80" key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (analyticsError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="mb-4 h-12 w-12 text-yellow-500" />
        <h3 className="mb-2 font-semibold text-lg">데이터를 불러올 수 없습니다</h3>
        <p className="mb-4 text-muted-foreground text-sm">백엔드 서버가 실행 중인지 확인해주세요</p>
        <Button onClick={() => refetchAnalytics()} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          다시 시도
        </Button>
      </div>
    )
  }

  const summary = analytics?.summary

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <Select onValueChange={(v) => setDays(Number(v))} value={String(days)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">최근 7일</SelectItem>
            <SelectItem value="14">최근 14일</SelectItem>
            <SelectItem value="30">최근 30일</SelectItem>
            <SelectItem value="90">최근 90일</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => refetchAnalytics()} size="icon" variant="outline">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border p-3 text-center">
          <div className="font-bold text-xl">{summary?.total ?? 0}</div>
          <div className="text-sm">전체 체험판</div>
          <div className="text-muted-foreground text-xs">
            활성 {summary?.trialing ?? 0} / 만료 {summary?.pastDue ?? 0}
          </div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="font-bold text-xl">
            {summary?.total ? Math.round((summary.onboardingCompleted / summary.total) * 100) : 0}%
          </div>
          <div className="text-sm">온보딩 완료율</div>
          <div className="text-muted-foreground text-xs">
            {summary?.onboardingCompleted ?? 0}개 완료
          </div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="font-bold text-xl">
            {summary?.total ? Math.round((summary.hasSentEmail / summary.total) * 100) : 0}%
          </div>
          <div className="text-sm">캠페인 실행률</div>
          <div className="text-muted-foreground text-xs">{summary?.hasSentEmail ?? 0}개 발송</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="font-bold text-xl">
            {summary?.total ? Math.round((summary.hasReply / summary.total) * 100) : 0}%
          </div>
          <div className="text-sm">답장 획득률</div>
          <div className="text-muted-foreground text-xs">{summary?.hasReply ?? 0}개 답장 받음</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Signup Trend Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">가입 추이</CardTitle>
            <CardDescription>일별 체험판 가입 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart
                  data={analytics?.signupTrend || []}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="signupGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tick={AXIS_STYLE}
                    tickFormatter={(v) => v.slice(5)}
                    tickLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={AXIS_STYLE}
                    tickLine={false}
                    tickMargin={8}
                  />
                  <Tooltip content={<CustomTooltip formatter={(value) => `${value}명`} />} />
                  <Area
                    animationDuration={300}
                    dataKey="signups"
                    fill="url(#signupGradient)"
                    name="가입"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Onboarding Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">온보딩 퍼널</CardTitle>
            <CardDescription>단계별 전환율 (클릭하여 상세 보기)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart
                  data={analytics?.onboardingFunnel || []}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    allowDecimals={false}
                    axisLine={false}
                    tick={AXIS_STYLE}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    axisLine={false}
                    dataKey="step"
                    tick={AXIS_STYLE}
                    tickLine={false}
                    type="category"
                    width={90}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        formatter={(value, _name, payload) => {
                          const rate = (payload as { rate?: number })?.rate ?? 0
                          return `${value}명 (${rate}%) - 클릭하여 상세보기`
                        }}
                      />
                    }
                    cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.3 }}
                  />
                  <Bar
                    animationDuration={300}
                    dataKey="count"
                    name="완료"
                    onClick={(data) => {
                      const step = (data as unknown as { step?: string })?.step
                      if (step) {
                        handleFunnelClick(step)
                      }
                    }}
                    radius={[0, 4, 4, 0]}
                    style={{ cursor: "pointer" }}
                  >
                    {analytics?.onboardingFunnel?.map((_, index) => (
                      <Cell fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} key={index} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Performance Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">캠페인 이메일 성과</CardTitle>
          <CardDescription>체험판 워크스페이스별 이메일 발송 및 성과 지표</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border p-3 text-center">
              <div className="font-bold text-lg">
                {analytics?.emailPerformance?.summary.totalSent?.toLocaleString() ?? 0}
              </div>
              <div className="text-muted-foreground text-xs">총 발송</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="font-bold text-lg">
                {analytics?.emailPerformance?.summary.avgOpenRate ?? 0}%
              </div>
              <div className="text-muted-foreground text-xs">평균 오픈율</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="font-bold text-lg">
                {analytics?.emailPerformance?.summary.avgReplyRate ?? 0}%
              </div>
              <div className="text-muted-foreground text-xs">평균 답장율</div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="font-bold text-lg">
                {analytics?.emailPerformance?.summary.workspacesWithEmails ?? 0}
              </div>
              <div className="text-muted-foreground text-xs">발송 워크스페이스</div>
            </div>
          </div>

          {/* Performance Table */}
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-[120px]">회사명</TableHead>
                  <TableHead className="w-[140px]">담당자</TableHead>
                  <TableHead className="w-[80px]">가입일</TableHead>
                  <TableHead className="w-[100px]">최근접속</TableHead>
                  <TableHead className="w-[200px]">퍼널 상태</TableHead>
                  <TableHead
                    className="w-[70px] cursor-pointer text-right hover:bg-muted/50"
                    onClick={() => handleEmailPerfSort("emailsSent")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      발송
                      {emailPerfSortBy === "emailsSent" &&
                        (emailPerfSortOrder === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        ))}
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[80px] cursor-pointer text-right hover:bg-muted/50"
                    onClick={() => handleEmailPerfSort("openRate")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      오픈율
                      {emailPerfSortBy === "openRate" &&
                        (emailPerfSortOrder === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        ))}
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[80px] cursor-pointer text-right hover:bg-muted/50"
                    onClick={() => handleEmailPerfSort("replyRate")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      답장율
                      {emailPerfSortBy === "replyRate" &&
                        (emailPerfSortOrder === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUp className="h-3 w-3" />
                        ))}
                    </span>
                  </TableHead>
                  <TableHead
                    className="w-[60px]"
                    title="오픈율 기준: 좋음(≥30%), 보통(15-30%), 낮음(<15%)"
                  >
                    성과
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEmailPerf.length > 0 ? (
                  sortedEmailPerf.map((ws) => (
                    <TableRow key={ws.workspaceId}>
                      <TableCell className="font-medium">
                        {ws.companyName || <span className="text-muted-foreground">미입력</span>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{ws.ownerName}</div>
                        <div className="text-muted-foreground text-xs">{ws.ownerEmail}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(ws.signupDate), "MM/dd")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ws.lastLogin ? format(new Date(ws.lastLogin), "MM/dd HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            className={cn(
                              "px-1.5 py-0.5 text-xs",
                              ws.funnelStatus?.survey
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                            )}
                            variant="secondary"
                          >
                            설문+로그인
                          </Badge>
                          <Badge
                            className={cn(
                              "px-1.5 py-0.5 text-xs",
                              ws.funnelStatus?.companyInfo
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                            )}
                            variant="secondary"
                          >
                            회사정보 입력
                          </Badge>
                          <Badge
                            className={cn(
                              "px-1.5 py-0.5 text-xs",
                              ws.funnelStatus?.leadCreated
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                            )}
                            variant="secondary"
                          >
                            리드 생성
                          </Badge>
                          <Badge
                            className={cn(
                              "px-1.5 py-0.5 text-xs",
                              ws.funnelStatus?.emailConnected
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                            )}
                            variant="secondary"
                          >
                            이메일 연동
                          </Badge>
                          <Badge
                            className={cn(
                              "px-1.5 py-0.5 text-xs",
                              ws.funnelStatus?.emailSent
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800",
                            )}
                            variant="secondary"
                          >
                            이메일 발송
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{ws.emailsSent}</TableCell>
                      <TableCell className="text-right">{ws.openRate}%</TableCell>
                      <TableCell className="text-right">{ws.replyRate}%</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            ws.performanceLevel === "high" &&
                              "bg-green-100 text-green-700 dark:bg-green-900",
                            ws.performanceLevel === "medium" &&
                              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900",
                            ws.performanceLevel === "low" &&
                              "bg-red-100 text-red-700 dark:bg-red-900",
                            ws.performanceLevel === "none" &&
                              "bg-gray-100 text-gray-500 dark:bg-gray-800",
                          )}
                          variant="secondary"
                        >
                          {ws.performanceLevel === "high" && "좋음"}
                          {ws.performanceLevel === "medium" && "보통"}
                          {ws.performanceLevel === "low" && "낮음"}
                          {ws.performanceLevel === "none" && "-"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground" colSpan={9}>
                      데이터가 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cohort Analysis Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">코호트 분석</CardTitle>
              <CardDescription>
                {cohortMode === "daily" ? "일별" : "주별"} 가입자 퍼널 전환율
              </CardDescription>
            </div>
            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                className="h-7 px-3 text-xs"
                onClick={() => setCohortMode("daily")}
                size="sm"
                variant={cohortMode === "daily" ? "default" : "ghost"}
              >
                일별
              </Button>
              <Button
                className="h-7 px-3 text-xs"
                onClick={() => setCohortMode("weekly")}
                size="sm"
                variant={cohortMode === "weekly" ? "default" : "ghost"}
              >
                주별
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">
                    {cohortMode === "daily" ? "일자" : "주차"}
                  </TableHead>
                  <TableHead className="w-[60px] text-center">가입</TableHead>
                  <TableHead className="text-center">설문+로그인</TableHead>
                  <TableHead className="text-center">회사정보 입력</TableHead>
                  <TableHead className="text-center">리드 생성</TableHead>
                  <TableHead className="text-center">이메일 연동</TableHead>
                  <TableHead className="text-center">이메일 발송</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.cohortData?.length ? (
                  analytics.cohortData.map((cohort) => (
                    <TableRow key={cohort.periodStart}>
                      <TableCell className="font-medium">{cohort.period}</TableCell>
                      <TableCell className="text-center">{cohort.total}명</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-block min-w-[50px] rounded px-2 py-0.5 font-medium text-xs",
                            cohort.surveyLoginRate >= 50
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : cohort.surveyLoginRate >= 25
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {cohort.surveyLoginRate}% ({cohort.surveyLogin})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-block min-w-[50px] rounded px-2 py-0.5 font-medium text-xs",
                            cohort.companyInfoRate >= 50
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : cohort.companyInfoRate >= 25
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {cohort.companyInfoRate}% ({cohort.companyInfo})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-block min-w-[50px] rounded px-2 py-0.5 font-medium text-xs",
                            cohort.leadCreatedRate >= 50
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : cohort.leadCreatedRate >= 25
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {cohort.leadCreatedRate}% ({cohort.leadCreated})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-block min-w-[50px] rounded px-2 py-0.5 font-medium text-xs",
                            cohort.emailConnectedRate >= 50
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : cohort.emailConnectedRate >= 25
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {cohort.emailConnectedRate}% ({cohort.emailConnected})
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-block min-w-[50px] rounded px-2 py-0.5 font-medium text-xs",
                            cohort.emailSentRate >= 50
                              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              : cohort.emailSentRate >= 25
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                          )}
                        >
                          {cohort.emailSentRate}% ({cohort.emailSent})
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground" colSpan={7}>
                      데이터가 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Activity Distribution - Donut Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">활성도 분포</CardTitle>
          <CardDescription>마지막 접속 기준</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-60">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  animationDuration={300}
                  cx="50%"
                  cy="50%"
                  data={analytics?.activityDistribution || []}
                  dataKey="count"
                  innerRadius={50}
                  nameKey="period"
                  outerRadius={75}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {analytics?.activityDistribution?.map((entry) => (
                    <Cell fill={ACTIVITY_COLORS[entry.period] || "#94a3b8"} key={entry.period} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip formatter={(value) => `${value}명`} />} />
                <Legend
                  align="right"
                  iconSize={8}
                  iconType="circle"
                  layout="vertical"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: "11px", paddingLeft: "16px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Step Workspaces Modal */}
      <Dialog onOpenChange={(open) => !open && setSelectedStep(null)} open={selectedStep !== null}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {selectedStep ? STEP_NAMES[selectedStep] : ""} 단계 워크스페이스
            </DialogTitle>
            <DialogDescription>
              해당 단계까지 완료한 워크스페이스 목록입니다 ({stepWorkspaces?.length ?? 0}개)
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            {stepWorkspacesLoading ? (
              <div className="space-y-2 p-4">
                {[...new Array(5)].map((_, i) => (
                  <Skeleton className="h-16 w-full" key={i} />
                ))}
              </div>
            ) : stepWorkspaces?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">회사명</TableHead>
                    <TableHead className="w-[180px]">담당자</TableHead>
                    <TableHead className="w-[100px]">완료일시</TableHead>
                    <TableHead>퍼널 진행 상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stepWorkspaces.map((ws) => (
                    <TableRow key={ws.workspaceId}>
                      <TableCell className="font-medium">
                        {ws.companyName || <span className="text-muted-foreground">미입력</span>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{ws.ownerName}</div>
                        <div className="text-muted-foreground text-xs">{ws.ownerEmail}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ws.completedAt ? format(new Date(ws.completedAt), "MM/dd HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            className={
                              ws.funnelStatus?.survey
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                            }
                            variant="secondary"
                          >
                            설문+로그인
                          </Badge>
                          <Badge
                            className={
                              ws.funnelStatus?.companyInfo
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                            }
                            variant="secondary"
                          >
                            회사정보 입력
                          </Badge>
                          <Badge
                            className={
                              ws.funnelStatus?.leadCreated
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                            }
                            variant="secondary"
                          >
                            리드 생성
                          </Badge>
                          <Badge
                            className={
                              ws.funnelStatus?.emailConnected
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                            }
                            variant="secondary"
                          >
                            이메일 연동
                          </Badge>
                          <Badge
                            className={
                              ws.funnelStatus?.emailSent
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                            }
                            variant="secondary"
                          >
                            이메일 발송
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                해당 단계를 완료한 워크스페이스가 없습니다
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TrialManagementPage
