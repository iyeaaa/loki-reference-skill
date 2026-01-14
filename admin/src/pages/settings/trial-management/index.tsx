/**
 * Trial Management Dashboard
 * 체험판 유저 관리 대시보드
 */

import { format } from "date-fns"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
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
import { useCurrentUser } from "@/lib/api/hooks/auth"
import {
  useBulkAddExclusionsMutation,
  useClearAllExclusionsMutation,
  useExclusions,
  useOnboardingStepWorkspaces,
  useRemoveExclusionMutation,
  useTrialAnalytics,
} from "@/lib/api/hooks/trial-analytics"
import type {
  CohortMode,
  CohortWorkspacePreview,
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

// Heatmap color helper for cohort analysis
function getHeatmapStyle(rate: number): string {
  if (rate >= 80) {
    return "bg-green-500 text-black dark:bg-green-600"
  }
  if (rate >= 50) {
    return "bg-green-300 text-black dark:bg-green-700"
  }
  if (rate >= 30) {
    return "bg-yellow-300 text-black dark:bg-yellow-600"
  }
  if (rate > 0) {
    return "bg-orange-300 text-black dark:bg-orange-600"
  }
  return "bg-gray-200 text-black dark:bg-gray-700"
}

// Sortable Table Header Component
function SortableTableHead<T extends string>({
  column,
  label,
  currentSortBy,
  sortOrder,
  onSort,
  className,
  align = "left",
}: {
  column: T
  label: string
  currentSortBy: T
  sortOrder: "asc" | "desc"
  onSort: (column: T) => void
  className?: string
  align?: "left" | "right" | "center"
}) {
  const isActive = currentSortBy === column
  const alignClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""

  return (
    <TableHead
      className={cn("cursor-pointer select-none transition-colors hover:bg-muted/50", className)}
      onClick={() => onSort(column)}
    >
      <span className={cn("flex items-center gap-1", alignClass)}>
        {label}
        {isActive ? (
          sortOrder === "desc" ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUp className="h-3 w-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
        )}
      </span>
    </TableHead>
  )
}

// Cohort Cell Component with workspace preview
function CohortCell({
  rate,
  count,
  workspaces,
  period,
  step,
  onClick,
}: {
  rate: number
  count: number
  workspaces: CohortWorkspacePreview[]
  period: string
  step: string
  onClick: (period: string, step: string, workspaces: CohortWorkspacePreview[]) => void
}) {
  const previewWorkspaces = workspaces.slice(0, 3)
  const hasMore = workspaces.length > 3

  return (
    <TableCell
      className={cn(
        "cursor-pointer p-1 text-center transition-opacity hover:opacity-80",
        getHeatmapStyle(rate),
      )}
      onClick={() => onClick(period, step, workspaces)}
    >
      <div className="font-bold text-sm">{rate}%</div>
      <div className="text-sm opacity-80">({count})</div>
      {workspaces.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {previewWorkspaces.map((ws) => (
            <div
              className="truncate text-xs opacity-70"
              key={ws.workspaceId}
              title={ws.companyName || ws.ownerName}
            >
              {ws.companyName || ws.ownerName}
            </div>
          ))}
          {hasMore && <div className="text-xs opacity-50">+{workspaces.length - 3}개 더</div>}
        </div>
      )}
    </TableCell>
  )
}

export function TrialManagementPage() {
  const [days, setDays] = useState(30)
  const [cohortMode, setCohortMode] = useState<CohortMode>("weekly")
  const [selectedStep, setSelectedStep] = useState<OnboardingStep | null>(null)
  const [emailPerfSortBy, setEmailPerfSortBy] =
    useState<keyof WorkspaceEmailPerformance>("emailsSent")
  const [emailPerfSortOrder, setEmailPerfSortOrder] = useState<"asc" | "desc">("desc")
  const [emailPerfSearchTerm, setEmailPerfSearchTerm] = useState("")

  // Detail modal state for survey/company info
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedWorkspaceDetail, setSelectedWorkspaceDetail] =
    useState<WorkspaceEmailPerformance | null>(null)

  // Cohort cell detail modal state
  const [cohortModalOpen, setCohortModalOpen] = useState(false)
  const [selectedCohortCell, setSelectedCohortCell] = useState<{
    period: string
    step: string
    workspaces: CohortWorkspacePreview[]
  } | null>(null)

  // Exclusion state (now from API)
  const [excludeModalOpen, setExcludeModalOpen] = useState(false)
  const [excludeSearchTerm, setExcludeSearchTerm] = useState("")
  const [pendingExclusions, setPendingExclusions] = useState<Set<string>>(new Set())

  // Get current user for excludedBy field
  const { data: currentUser } = useCurrentUser()

  // Get exclusions from DB
  const { data: exclusions = [] } = useExclusions()

  // Exclusion mutations
  const bulkAddExclusionsMutation = useBulkAddExclusionsMutation()
  const removeExclusionMutation = useRemoveExclusionMutation()
  const clearAllExclusionsMutation = useClearAllExclusionsMutation()

  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
  } = useTrialAnalytics({ days, cohortMode })

  const { data: stepWorkspaces, isLoading: stepWorkspacesLoading } =
    useOnboardingStepWorkspaces(selectedStep)

  // Sort and filter email performance workspaces
  const sortedEmailPerf = useMemo(() => {
    let workspaces = analytics?.emailPerformance?.workspaces ?? []

    // Apply text search filter
    if (emailPerfSearchTerm.trim()) {
      const term = emailPerfSearchTerm.toLowerCase()
      workspaces = workspaces.filter(
        (ws) =>
          ws.companyName?.toLowerCase().includes(term) ||
          ws.ownerName.toLowerCase().includes(term) ||
          ws.ownerEmail.toLowerCase().includes(term),
      )
    }

    // Apply sorting
    return [...workspaces].sort((a, b) => {
      const aVal = a[emailPerfSortBy]
      const bVal = b[emailPerfSortBy]

      // Handle null/undefined
      if ((aVal === null || aVal === undefined) && (bVal === null || bVal === undefined)) {
        return 0
      }
      if (aVal === null || aVal === undefined) {
        return emailPerfSortOrder === "desc" ? 1 : -1
      }
      if (bVal === null || bVal === undefined) {
        return emailPerfSortOrder === "desc" ? -1 : 1
      }

      // Number comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return emailPerfSortOrder === "desc" ? bVal - aVal : aVal - bVal
      }

      // String comparison
      if (typeof aVal === "string" && typeof bVal === "string") {
        const comparison = aVal.localeCompare(bVal, "ko")
        return emailPerfSortOrder === "desc" ? -comparison : comparison
      }

      // Date comparison for signupDate and lastLogin
      if (emailPerfSortBy === "signupDate" || emailPerfSortBy === "lastLogin") {
        const aDate = aVal ? new Date(aVal as string).getTime() : 0
        const bDate = bVal ? new Date(bVal as string).getTime() : 0
        return emailPerfSortOrder === "desc" ? bDate - aDate : aDate - bDate
      }

      return 0
    })
  }, [
    analytics?.emailPerformance?.workspaces,
    emailPerfSortBy,
    emailPerfSortOrder,
    emailPerfSearchTerm,
  ])

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

  // Handle cohort cell click
  const handleCohortCellClick = (
    period: string,
    step: string,
    workspaces: CohortWorkspacePreview[],
  ) => {
    setSelectedCohortCell({ period, step, workspaces })
    setCohortModalOpen(true)
  }

  // Get excluded workspace IDs from API response
  const excludedIds = useMemo(() => exclusions.map((e) => e.workspaceId), [exclusions])

  // Open exclusion modal and initialize pending exclusions
  const handleOpenExcludeModal = () => {
    setPendingExclusions(new Set(excludedIds))
    setExcludeSearchTerm("")
    setExcludeModalOpen(true)
  }

  // Toggle workspace exclusion in pending state
  const togglePendingExclusion = (workspace: WorkspaceEmailPerformance) => {
    const newPending = new Set(pendingExclusions)
    if (newPending.has(workspace.workspaceId)) {
      newPending.delete(workspace.workspaceId)
    } else {
      newPending.add(workspace.workspaceId)
    }
    setPendingExclusions(newPending)
  }

  // Apply exclusions via API
  const handleApplyExclusions = async () => {
    if (!currentUser?.id) {
      toast.error("사용자 정보를 불러올 수 없습니다")
      return
    }

    // Find workspaces to add (in pending but not in current exclusions)
    const toAdd = [...pendingExclusions].filter((id) => !excludedIds.includes(id))
    // Find workspaces to remove (in current exclusions but not in pending)
    const toRemove = excludedIds.filter((id) => !pendingExclusions.has(id))

    try {
      // Add new exclusions
      if (toAdd.length > 0) {
        await bulkAddExclusionsMutation.mutateAsync({
          workspaceIds: toAdd,
          excludedBy: currentUser.id,
        })
      }

      // Remove exclusions
      for (const id of toRemove) {
        await removeExclusionMutation.mutateAsync(id)
      }

      toast.success("제외 설정이 저장되었습니다")
      setExcludeModalOpen(false)
    } catch {
      toast.error("제외 설정 저장에 실패했습니다")
    }
  }

  // Remove a single workspace from exclusion list
  const handleRemoveExclusion = async (id: string) => {
    try {
      await removeExclusionMutation.mutateAsync(id)
      toast.success("제외가 해제되었습니다")
    } catch {
      toast.error("제외 해제에 실패했습니다")
    }
  }

  // Clear all exclusions
  const handleClearAllExclusions = async () => {
    try {
      await clearAllExclusionsMutation.mutateAsync()
      toast.success("모든 제외 설정이 초기화되었습니다")
    } catch {
      toast.error("제외 초기화에 실패했습니다")
    }
  }

  // Filter workspaces for exclusion modal
  const filteredWorkspacesForExclusion = useMemo(() => {
    const workspaces = analytics?.emailPerformance?.workspaces ?? []
    if (!excludeSearchTerm.trim()) {
      return workspaces
    }
    const term = excludeSearchTerm.toLowerCase()
    return workspaces.filter(
      (ws) =>
        ws.companyName?.toLowerCase().includes(term) ||
        ws.ownerName.toLowerCase().includes(term) ||
        ws.ownerEmail.toLowerCase().includes(term),
    )
  }, [analytics?.emailPerformance?.workspaces, excludeSearchTerm])

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button onClick={handleOpenExcludeModal} size="sm" variant="outline">
            <Settings2 className="mr-2 h-4 w-4" />
            체험판 통계 제외 설정
            {exclusions.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {exclusions.length}
              </Badge>
            )}
          </Button>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Excluded Workspaces Info Banner */}
      {exclusions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
          <span className="text-amber-700 text-sm dark:text-amber-300">
            통계에서 제외된 워크스페이스 ({exclusions.length}개):
          </span>
          <div className="flex flex-wrap gap-1">
            {exclusions.slice(0, 5).map((ws) => (
              <Badge
                className="flex items-center gap-1 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200"
                key={ws.workspaceId}
                variant="secondary"
              >
                {ws.companyName || ws.ownerName}
                <button
                  className="ml-1 rounded-full p-0.5 hover:bg-amber-300 dark:hover:bg-amber-700"
                  disabled={removeExclusionMutation.isPending}
                  onClick={() => handleRemoveExclusion(ws.workspaceId)}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {exclusions.length > 5 && (
              <Badge
                className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                variant="secondary"
              >
                +{exclusions.length - 5}개 더
              </Badge>
            )}
          </div>
          <Button
            className="ml-auto text-amber-700 dark:text-amber-300"
            disabled={clearAllExclusionsMutation.isPending}
            onClick={handleClearAllExclusions}
            size="sm"
            variant="ghost"
          >
            전체 해제
          </Button>
        </div>
      )}

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
            <CardDescription>일별 신규 가입자 수 · 체험 기간: 14일</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart
                  data={analytics?.signupTrend || []}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke={CHART_COLORS.grid}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="date"
                    tick={AXIS_STYLE}
                    tickFormatter={(v) => {
                      const date = new Date(v)
                      const days = ["일", "월", "화", "수", "목", "금", "토"]
                      const mm = v.slice(5, 7)
                      const dd = v.slice(8, 10)
                      return `${mm}.${dd}(${days[date.getDay()]})`
                    }}
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
                  <Line
                    activeDot={{ r: 6 }}
                    animationDuration={300}
                    dataKey="signups"
                    dot={{ r: 4 }}
                    name="가입자 수"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    type="monotone"
                  />
                </LineChart>
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

          {/* Search Input */}
          <div className="relative w-64">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(e) => setEmailPerfSearchTerm(e.target.value)}
              placeholder="회사명, 담당자, 이메일 검색..."
              value={emailPerfSearchTerm}
            />
            {emailPerfSearchTerm && (
              <button
                className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
                onClick={() => setEmailPerfSearchTerm("")}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Performance Table */}
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <SortableTableHead
                    className="w-[120px]"
                    column="companyName"
                    currentSortBy={emailPerfSortBy}
                    label="회사명"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <SortableTableHead
                    className="w-[140px]"
                    column="ownerName"
                    currentSortBy={emailPerfSortBy}
                    label="담당자"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <SortableTableHead
                    className="w-[80px]"
                    column="signupDate"
                    currentSortBy={emailPerfSortBy}
                    label="가입일"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <SortableTableHead
                    className="w-[100px]"
                    column="lastLogin"
                    currentSortBy={emailPerfSortBy}
                    label="최근접속"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <TableHead className="w-[180px]">퍼널 상태</TableHead>
                  <SortableTableHead
                    align="right"
                    className="w-[70px]"
                    column="emailsSent"
                    currentSortBy={emailPerfSortBy}
                    label="발송"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <SortableTableHead
                    align="right"
                    className="w-[80px]"
                    column="openRate"
                    currentSortBy={emailPerfSortBy}
                    label="오픈율"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <SortableTableHead
                    align="right"
                    className="w-[80px]"
                    column="replyRate"
                    currentSortBy={emailPerfSortBy}
                    label="답장율"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <SortableTableHead
                    className="w-[70px]"
                    column="performanceLevel"
                    currentSortBy={emailPerfSortBy}
                    label="성과"
                    onSort={handleEmailPerfSort}
                    sortOrder={emailPerfSortOrder}
                  />
                  <TableHead className="w-[160px]">설문/회사정보</TableHead>
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
                            회사
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
                            리드
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
                            연동
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
                            발송
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{ws.emailsSent}</TableCell>
                      <TableCell className="text-right">{ws.openRate}%</TableCell>
                      <TableCell className="text-right">{ws.replyRate}%</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "px-2 py-0.5 text-xs",
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
                      <TableCell className="max-w-[160px]">
                        {ws.surveyData || ws.companyDescription ? (
                          <button
                            className="w-full cursor-pointer rounded p-1 text-left transition-colors hover:bg-muted/50"
                            onClick={() => {
                              setSelectedWorkspaceDetail(ws)
                              setDetailModalOpen(true)
                            }}
                            type="button"
                          >
                            <div className="line-clamp-3 space-y-0.5 text-sm">
                              {ws.surveyData && (
                                <div className="text-blue-600 dark:text-blue-400">
                                  <span className="font-medium">업종:</span>{" "}
                                  {ws.surveyData.industry}
                                  {ws.surveyData.target && (
                                    <span className="ml-1">
                                      <span className="font-medium">타겟:</span>{" "}
                                      {ws.surveyData.target}
                                    </span>
                                  )}
                                </div>
                              )}
                              {ws.companyDescription && (
                                <div className="text-gray-600 dark:text-gray-400">
                                  {ws.companyDescription}
                                </div>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              상세보기
                            </div>
                          </button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground" colSpan={10}>
                      {emailPerfSearchTerm ? "검색 결과가 없습니다" : "데이터가 없습니다"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Results count */}
          {(analytics?.emailPerformance?.workspaces?.length ?? 0) > 0 && (
            <div className="text-muted-foreground text-xs">
              {emailPerfSearchTerm ? (
                <>
                  검색 결과: {sortedEmailPerf.length}개 /{" "}
                  {analytics?.emailPerformance?.workspaces?.length}개
                </>
              ) : (
                <>총 {analytics?.emailPerformance?.workspaces?.length}개</>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cohort Analysis Table - Heatmap Style */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">코호트 분석</CardTitle>
              <CardDescription>
                {cohortMode === "daily" ? "일별" : "주별"} 가입자 퍼널 전환율
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {/* Legend */}
              <div className="hidden items-center gap-2 text-sm md:flex">
                <span className="text-muted-foreground">전환율:</span>
                <span className="rounded bg-green-500 px-1.5 py-0.5 text-black">80%+</span>
                <span className="rounded bg-green-300 px-1.5 py-0.5 text-black">50-79%</span>
                <span className="rounded bg-yellow-300 px-1.5 py-0.5 text-black">30-49%</span>
                <span className="rounded bg-orange-300 px-1.5 py-0.5 text-black">1-29%</span>
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-black">0%</span>
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] bg-muted/50">
                    {cohortMode === "daily" ? "일자" : "주차"}
                  </TableHead>
                  <TableHead className="w-[50px] bg-muted/50 text-center">가입</TableHead>
                  <TableHead className="w-[90px] bg-muted/50 text-center">설문</TableHead>
                  <TableHead className="w-[90px] bg-muted/50 text-center">회사</TableHead>
                  <TableHead className="w-[90px] bg-muted/50 text-center">리드</TableHead>
                  <TableHead className="w-[90px] bg-muted/50 text-center">연동</TableHead>
                  <TableHead className="w-[90px] bg-muted/50 text-center">발송</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics?.cohortData?.length ? (
                  analytics.cohortData.map((cohort) => (
                    <TableRow className="hover:bg-transparent" key={cohort.periodStart}>
                      <TableCell className="bg-muted/30 font-medium">{cohort.period}</TableCell>
                      <TableCell
                        className="cursor-pointer bg-muted/30 text-center font-semibold transition-opacity hover:opacity-80"
                        onClick={() =>
                          handleCohortCellClick(
                            cohort.period,
                            "전체 가입",
                            cohort.workspaces?.all || [],
                          )
                        }
                      >
                        {cohort.total}
                      </TableCell>
                      <CohortCell
                        count={cohort.surveyLogin}
                        onClick={handleCohortCellClick}
                        period={cohort.period}
                        rate={cohort.surveyLoginRate}
                        step="설문+로그인"
                        workspaces={cohort.workspaces?.surveyLogin || []}
                      />
                      <CohortCell
                        count={cohort.companyInfo}
                        onClick={handleCohortCellClick}
                        period={cohort.period}
                        rate={cohort.companyInfoRate}
                        step="회사정보"
                        workspaces={cohort.workspaces?.companyInfo || []}
                      />
                      <CohortCell
                        count={cohort.leadCreated}
                        onClick={handleCohortCellClick}
                        period={cohort.period}
                        rate={cohort.leadCreatedRate}
                        step="리드 생성"
                        workspaces={cohort.workspaces?.leadCreated || []}
                      />
                      <CohortCell
                        count={cohort.emailConnected}
                        onClick={handleCohortCellClick}
                        period={cohort.period}
                        rate={cohort.emailConnectedRate}
                        step="이메일 연동"
                        workspaces={cohort.workspaces?.emailConnected || []}
                      />
                      <CohortCell
                        count={cohort.emailSent}
                        onClick={handleCohortCellClick}
                        period={cohort.period}
                        rate={cohort.emailSentRate}
                        step="이메일 발송"
                        workspaces={cohort.workspaces?.emailSent || []}
                      />
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
          <CardTitle className="text-lg">활성도 분포</CardTitle>
          <CardDescription className="text-sm">마지막 접속 기준</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer height="100%" width="100%">
              <PieChart>
                <Pie
                  animationDuration={300}
                  cx="40%"
                  cy="50%"
                  data={analytics?.activityDistribution || []}
                  dataKey="count"
                  innerRadius={60}
                  label={({ cx, cy, midAngle, outerRadius, value, name }) => {
                    if (!(value && midAngle && name)) {
                      return null
                    }
                    const RADIAN = Math.PI / 180
                    const radius = (outerRadius as number) + 25
                    const x = (cx as number) + radius * Math.cos(-midAngle * RADIAN)
                    const y = (cy as number) + radius * Math.sin(-midAngle * RADIAN)
                    return (
                      <text
                        dominantBaseline="central"
                        fill={ACTIVITY_COLORS[name as string] || "#64748b"}
                        fontSize={12}
                        fontWeight={600}
                        textAnchor={x > (cx as number) ? "start" : "end"}
                        x={x}
                        y={y}
                      >
                        {name} {value}명
                      </text>
                    )
                  }}
                  labelLine={{
                    stroke: "#94a3b8",
                    strokeWidth: 1,
                  }}
                  nameKey="period"
                  outerRadius={85}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {analytics?.activityDistribution?.map((entry) => (
                    <Cell fill={ACTIVITY_COLORS[entry.period] || "#94a3b8"} key={entry.period} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip formatter={(value) => `${value}명`} />} />
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

      {/* Exclusion Settings Modal */}
      <Dialog onOpenChange={setExcludeModalOpen} open={excludeModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>체험판 통계 제외 설정</DialogTitle>
            <DialogDescription>
              선택한 워크스페이스는 모든 체험판 통계에서 제외됩니다. 테스트 계정이나 내부 사용자를
              제외할 때 유용합니다. 모든 관리자에게 동일하게 적용됩니다.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="py-2">
            <Input
              onChange={(e) => setExcludeSearchTerm(e.target.value)}
              placeholder="회사명, 담당자명, 이메일로 검색..."
              value={excludeSearchTerm}
            />
          </div>

          {/* Workspace List with Checkboxes */}
          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-[50px]">제외</TableHead>
                  <TableHead>회사명</TableHead>
                  <TableHead>담당자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkspacesForExclusion.length > 0 ? (
                  filteredWorkspacesForExclusion.map((ws) => (
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      key={ws.workspaceId}
                      onClick={() => togglePendingExclusion(ws)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={pendingExclusions.has(ws.workspaceId)}
                          onCheckedChange={() => togglePendingExclusion(ws)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {ws.companyName || <span className="text-muted-foreground">미입력</span>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{ws.ownerName}</div>
                        <div className="text-muted-foreground text-xs">{ws.ownerEmail}</div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center text-muted-foreground" colSpan={3}>
                      {excludeSearchTerm ? "검색 결과가 없습니다" : "워크스페이스가 없습니다"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Selected Count */}
          <div className="text-muted-foreground text-sm">
            {pendingExclusions.size}개 선택됨
            {pendingExclusions.size !== exclusions.length && (
              <span className="ml-2 text-amber-600">
                (현재 저장된 제외 목록: {exclusions.length}개)
              </span>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setExcludeModalOpen(false)} variant="outline">
              취소
            </Button>
            <Button
              disabled={bulkAddExclusionsMutation.isPending || removeExclusionMutation.isPending}
              onClick={handleApplyExclusions}
            >
              {bulkAddExclusionsMutation.isPending || removeExclusionMutation.isPending
                ? "저장 중..."
                : "적용하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Survey/Company Info Detail Modal */}
      <Dialog onOpenChange={setDetailModalOpen} open={detailModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedWorkspaceDetail?.companyName || "회사명 미입력"} - 설문/회사정보
            </DialogTitle>
            <DialogDescription>
              {selectedWorkspaceDetail?.ownerName} ({selectedWorkspaceDetail?.ownerEmail})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 설문 데이터 */}
            {selectedWorkspaceDetail?.surveyData && (
              <div className="rounded-lg border bg-blue-50 p-4 dark:bg-blue-950">
                <h4 className="mb-3 font-semibold text-blue-800 dark:text-blue-200">설문 응답</h4>
                <div className="space-y-2 text-sm">
                  {selectedWorkspaceDetail.surveyData.industry && (
                    <div className="flex gap-2">
                      <span className="w-16 font-medium text-blue-700 dark:text-blue-300">
                        업종:
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {selectedWorkspaceDetail.surveyData.industry}
                      </span>
                    </div>
                  )}
                  {selectedWorkspaceDetail.surveyData.target && (
                    <div className="flex gap-2">
                      <span className="w-16 font-medium text-blue-700 dark:text-blue-300">
                        타겟:
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {selectedWorkspaceDetail.surveyData.target}
                      </span>
                    </div>
                  )}
                  {selectedWorkspaceDetail.surveyData.country && (
                    <div className="flex gap-2">
                      <span className="w-16 font-medium text-blue-700 dark:text-blue-300">
                        국가:
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {selectedWorkspaceDetail.surveyData.country}
                      </span>
                    </div>
                  )}
                  {selectedWorkspaceDetail.surveyData.experience && (
                    <div className="flex gap-2">
                      <span className="w-16 font-medium text-blue-700 dark:text-blue-300">
                        경험:
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {selectedWorkspaceDetail.surveyData.experience}
                      </span>
                    </div>
                  )}
                  {selectedWorkspaceDetail.surveyData.lang && (
                    <div className="flex gap-2">
                      <span className="w-16 font-medium text-blue-700 dark:text-blue-300">
                        언어:
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {selectedWorkspaceDetail.surveyData.lang}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 회사 소개 */}
            {selectedWorkspaceDetail?.companyDescription && (
              <div className="rounded-lg border bg-gray-50 p-4 dark:bg-gray-900">
                <h4 className="mb-3 font-semibold text-gray-800 dark:text-gray-200">회사 소개</h4>
                <p className="whitespace-pre-wrap text-gray-600 text-sm dark:text-gray-400">
                  {selectedWorkspaceDetail.companyDescription}
                </p>
              </div>
            )}

            {/* 데이터 없음 */}
            {!(
              selectedWorkspaceDetail?.surveyData || selectedWorkspaceDetail?.companyDescription
            ) && (
              <div className="py-8 text-center text-muted-foreground">등록된 정보가 없습니다</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cohort Cell Detail Modal */}
      <Dialog onOpenChange={setCohortModalOpen} open={cohortModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {selectedCohortCell?.period} - {selectedCohortCell?.step}
            </DialogTitle>
            <DialogDescription>
              해당 기간 {selectedCohortCell?.step} 완료 워크스페이스 (
              {selectedCohortCell?.workspaces.length ?? 0}개)
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {selectedCohortCell?.workspaces.length ? (
              <div className="space-y-2">
                {selectedCohortCell.workspaces.map((ws) => (
                  <div
                    className="flex items-center justify-between rounded-lg border p-3"
                    key={ws.workspaceId}
                  >
                    <div>
                      <div className="font-medium">
                        {ws.companyName || (
                          <span className="text-muted-foreground">회사명 미입력</span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-sm">{ws.ownerName}</div>
                    </div>
                  </div>
                ))}
              </div>
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
