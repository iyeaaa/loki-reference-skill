import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Mail,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip as UITooltip,
} from "@/components/ui/tooltip"
import { useTrialDashboardStats } from "@/lib/api/hooks/dashboard"
import { useSequencesByWorkspace } from "@/lib/api/hooks/sequences"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { cn } from "@/lib/utils"
import { SequenceEnrollmentsTable } from "@/pages/sequences/SequenceEnrollmentsTable"
import { SequenceStepsList } from "@/pages/sequences/SequenceStepList"
import { CampaignResumeCallout } from "./components/CampaignResumeCallout"

const UPGRADE_URL = "https://rinda.ai/contact"

type AppDashboardPageProps = {
  showCampaignCallout?: boolean
  calloutSequenceId?: string
  onCalloutComplete?: () => void
  onCalloutDismiss?: () => void
}

const PRESET_RANGES = [
  { key: "7d", label: "최근 7일", days: 7 },
  { key: "14d", label: "최근 14일", days: 14 },
  { key: "30d", label: "최근 30일", days: 30 },
  { key: "90d", label: "최근 90일", days: 90 },
] as const

// 이메일 퍼널 단계별 의미론적 색상
// 발송: 중립(회색) → 오픈: 관심(파랑) → 클릭: 참여(주황) → 답장: 전환(초록)
const METRICS = [
  { key: "sent", label: "발송", color: "#64748b" }, // slate - 중립적 시작점
  { key: "opened", label: "오픈", color: "#0ea5e9" }, // sky blue - 관심/인지
  { key: "clicked", label: "클릭", color: "#f59e0b" }, // amber - 적극적 참여
  { key: "replied", label: "답장", color: "#22c55e" }, // green - 전환/성공
] as const

const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const formatPercent = (value: number | undefined) => {
  if (value === undefined || value === null) {
    return "0.0%"
  }
  return `${value.toFixed(1)}%`
}

export default function AppDashboardPage({
  showCampaignCallout = false,
  calloutSequenceId,
  onCalloutComplete,
  onCalloutDismiss,
}: AppDashboardPageProps = {}) {
  const [activeTab, setActiveTab] = useState("overview")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    return { from: thirtyDaysAgo, to: today }
  })
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // 바이어 목록, 이메일 캠페인 탭에서 사용할 첫 번째 시퀀스 ID
  const { data: sequences } = useSequencesByWorkspace(workspaceId, !!workspaceId)
  const firstSequenceId = sequences?.[0]?.id

  // 체험판은 시퀀스 1개만 있으므로 시퀀스 필터링 없이 워크스페이스 전체 데이터 조회
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useTrialDashboardStats(
    {
      workspaceId,
      // sequenceId 미전달 시 워크스페이스 전체 이메일 통계 조회
      startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    },
    !!workspaceId,
  )

  // Preset date range selection
  const selectPresetRange = (days: number) => {
    const today = new Date()
    const startDate = new Date()
    startDate.setDate(today.getDate() - days)
    setDateRange({ from: startDate, to: today })
  }

  const availableCountries = useMemo(
    () => stats?.countryStats?.map((c) => c.country) || [],
    [stats?.countryStats],
  )

  useMemo(() => {
    if (availableCountries.length > 0 && selectedCountries.length === 0) {
      setSelectedCountries(availableCountries)
    }
  }, [availableCountries, selectedCountries.length])

  const filteredDailyStats = useMemo(() => {
    if (!stats?.dailyStats || stats.dailyStats.length === 0) {
      // 플레이스홀더 데이터 생성 (최근 7일)
      const placeholderData = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        placeholderData.push({
          date: formatDate(date.toISOString()),
          sent: 0,
          opened: 0,
          clicked: 0,
        })
      }
      return placeholderData
    }

    return stats.dailyStats
      .filter((item) => {
        const itemDate = new Date(item.date)
        if (dateRange?.from && itemDate < dateRange.from) {
          return false
        }
        if (dateRange?.to && itemDate > dateRange.to) {
          return false
        }
        return true
      })
      .map((item) => ({
        ...item,
        date: formatDate(item.date),
      }))
  }, [stats?.dailyStats, dateRange])

  const filteredCountryStats = useMemo(() => {
    if (!stats?.countryStats || stats.countryStats.length === 0) {
      // 플레이스홀더 데이터 (예상 순위)
      return [
        { country: "미국", count: 0, percentage: 0 },
        { country: "독일", count: 0, percentage: 0 },
        { country: "일본", count: 0, percentage: 0 },
        { country: "영국", count: 0, percentage: 0 },
        { country: "프랑스", count: 0, percentage: 0 },
      ]
    }
    if (selectedCountries.length === 0) {
      return stats.countryStats
    }
    return stats.countryStats.filter((c) => selectedCountries.includes(c.country))
  }, [stats?.countryStats, selectedCountries])

  const filteredActivity = useMemo(() => {
    if (!stats?.recentActivity) {
      return []
    }
    return stats.recentActivity
  }, [stats?.recentActivity])

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date()
    const date = new Date(timestamp)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60_000)

    if (diffMins < 1) {
      return "방금"
    }
    if (diffMins < 60) {
      return `${diffMins}분 전`
    }
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) {
      return `${diffHours}시간 전`
    }
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}일 전`
  }

  const getMetricColor = (type: string) => METRICS.find((t) => t.key === type)?.color || "#94a3b8"
  const getMetricLabel = (type: string) => METRICS.find((t) => t.key === type)?.label || type

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country],
    )
  }

  // Calculate totals and rates
  const totalStats = useMemo(() => {
    const scheduled = stats?.funnel?.scheduled || 0
    const sent = stats?.funnel?.sent || 0
    const opened = stats?.funnel?.opened || 0
    const clicked = stats?.funnel?.clicked || 0
    const replied = stats?.funnel?.replied || 0
    return {
      scheduled,
      sent,
      total: scheduled + sent, // 발송 예정 + 발송 완료
      opened,
      clicked,
      replied,
      openRate: stats?.funnel?.openRate || 0,
      clickRate: stats?.funnel?.clickRate || 0,
      replyRate: stats?.funnel?.replyRate || 0,
      ctr: opened > 0 ? (clicked / opened) * 100 : 0, // Click-to-open rate
    }
  }, [stats?.funnel])

  if (!workspaceId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">워크스페이스를 선택해주세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Campaign Resume Callout */}
      {showCampaignCallout && calloutSequenceId && onCalloutComplete && onCalloutDismiss && (
        <CampaignResumeCallout
          onComplete={onCalloutComplete}
          onDismiss={onCalloutDismiss}
          sequenceId={calloutSequenceId}
        />
      )}

      <Tabs className="space-y-4" onValueChange={setActiveTab} value={activeTab}>
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <TabsList className="h-9 rounded-lg bg-muted p-1">
              <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="overview">
                <TrendingUp className="h-3.5 w-3.5" />
                한눈에 보기
              </TabsTrigger>
              <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="leads">
                <Users className="h-3.5 w-3.5" />
                바이어 목록
              </TabsTrigger>
              <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="emails">
                <Mail className="h-3.5 w-3.5" />
                이메일 캠페인
              </TabsTrigger>
            </TabsList>
            <Button
              className="h-8 w-8 p-0"
              disabled={isRefetching}
              onClick={() => refetch()}
              size="sm"
              variant="ghost"
            >
              <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
            </Button>
          </div>

          {activeTab === "overview" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Range Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button className="h-8 gap-1.5 text-sm" size="sm" variant="outline">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MM/dd", { locale: ko })} -{" "}
                          {format(dateRange.to, "MM/dd", { locale: ko })}
                        </>
                      ) : (
                        format(dateRange.from, "MM/dd", { locale: ko })
                      )
                    ) : (
                      "기간 선택"
                    )}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <div className="flex">
                    <div className="border-r p-2">
                      <div className="space-y-1">
                        {PRESET_RANGES.map((preset) => (
                          <Button
                            className="w-full justify-start text-xs"
                            key={preset.key}
                            onClick={() => selectPresetRange(preset.days)}
                            size="sm"
                            variant="ghost"
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Calendar
                      defaultMonth={dateRange?.from}
                      mode="range"
                      numberOfMonths={2}
                      onSelect={setDateRange}
                      selected={dateRange}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              {/* Region Filter */}
              {availableCountries.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 gap-1.5 text-sm" size="sm" variant="outline">
                      지역 ({selectedCountries.length}/{availableCountries.length})
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                    <DropdownMenuLabel>국가 필터</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={selectedCountries.length === availableCountries.length}
                      className="font-medium"
                      onCheckedChange={(checked) =>
                        setSelectedCountries(checked ? availableCountries : [])
                      }
                    >
                      전체
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {availableCountries.map((country) => (
                      <DropdownMenuCheckboxItem
                        checked={selectedCountries.includes(country)}
                        key={country}
                        onCheckedChange={() => toggleCountry(country)}
                      >
                        {country}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        <TabsContent className="space-y-4" value="overview">
          {/* KPI Cards */}
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                {
                  label: "발송",
                  value: totalStats.total,
                  scheduled: totalStats.scheduled,
                  color: "#64748b",
                },
                {
                  label: "오픈",
                  value: totalStats.opened,
                  rate: totalStats.openRate,
                  rateLabel: "전체 발송 대비",
                  color: "#0ea5e9",
                },
                {
                  label: "클릭",
                  value: totalStats.clicked,
                  rate: totalStats.clickRate,
                  rateLabel: "전체 발송 대비",
                  ctr: totalStats.ctr,
                  color: "#f59e0b",
                },
                {
                  label: "답장",
                  value: totalStats.replied,
                  rate: totalStats.replyRate,
                  rateLabel: "전체 발송 대비",
                  color: "#22c55e",
                },
              ].map((stat) => (
                <div className="rounded-lg border bg-background p-4" key={stat.label}>
                  {isLoading ? (
                    <Skeleton className="h-14 w-full" />
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: stat.color }}
                        />
                        <span className="text-muted-foreground text-sm">{stat.label}</span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-3xl tabular-nums">
                            {formatNumber(stat.value)}
                          </span>
                          <span className="text-base text-muted-foreground">회</span>
                        </div>
                        {stat.rate !== undefined && (
                          <div className="mt-0.5 text-muted-foreground text-sm">
                            {formatPercent(stat.rate)}{" "}
                            <span className="text-xs">({stat.rateLabel})</span>
                          </div>
                        )}
                      </div>
                      {"scheduled" in stat &&
                        typeof stat.scheduled === "number" &&
                        stat.scheduled > 0 && (
                          <div className="mt-1 text-amber-600 text-xs">
                            +{stat.scheduled}건 발송 예정
                          </div>
                        )}
                      {stat.ctr !== undefined && stat.ctr > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-muted-foreground text-xs">
                          <span>CTOR {stat.ctr.toFixed(1)}%</span>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground/70" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px]" side="top">
                              <p className="font-medium">오픈 대비 클릭률</p>
                              <p className="text-muted-foreground text-xs">
                                이메일을 연 사람 중 클릭한 비율
                              </p>
                            </TooltipContent>
                          </UITooltip>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </TooltipProvider>

          {/* Charts Grid */}
          <div className="grid grid-cols-12 gap-4">
            {/* Trend Chart */}
            <div className="col-span-12 rounded-lg border bg-background lg:col-span-8">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="font-medium">린다가 보낸 이메일</h3>
                  <p className="text-muted-foreground text-sm">
                    매일 린다가 발송하고 바이어가 열어본 현황이에요
                  </p>
                </div>
                <div className="flex gap-4">
                  {[
                    { key: "sent", label: "발송", color: "#64748b", dashed: false },
                    { key: "opened", label: "오픈", color: "#0ea5e9", dashed: true },
                  ].map((item) => (
                    <div className="flex items-center gap-1.5" key={item.key}>
                      <span
                        className="h-0.5 w-4"
                        style={{
                          backgroundColor: item.color,
                          ...(item.dashed && {
                            backgroundImage: `linear-gradient(to right, ${item.color} 50%, transparent 50%)`,
                            backgroundSize: "6px 100%",
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                      <span className="text-muted-foreground text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                {isLoading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <div className="[&_.recharts-wrapper]:!outline-none [&_svg]:!outline-none h-[220px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <AreaChart data={filteredDailyStats}>
                        <defs>
                          <linearGradient id="sentGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="openedGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          axisLine={false}
                          dataKey="date"
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          tickLine={false}
                        />
                        <YAxis
                          axisLine={false}
                          domain={[0, 10]}
                          tick={{ fontSize: 12, fill: "#6b7280" }}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                          formatter={(value, name) => {
                            const label = name === "sent" ? "발송" : "오픈"
                            const color = name === "sent" ? "#64748b" : "#0ea5e9"
                            return [
                              <span key={name} style={{ color }}>
                                {label}: <strong>{value ?? 0}건</strong>
                              </span>,
                              "",
                            ]
                          }}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Area
                          dataKey="sent"
                          dot={false}
                          fill="url(#sentGradient)"
                          stroke="#64748b"
                          strokeWidth={2}
                          type="monotone"
                        />
                        <Area
                          dataKey="opened"
                          dot={false}
                          fill="url(#openedGradient)"
                          stroke="#0ea5e9"
                          strokeDasharray="5 3"
                          strokeWidth={2}
                          type="monotone"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Funnel */}
            <div className="col-span-12 rounded-lg border bg-background lg:col-span-4">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="font-medium">린다의 영업 성과</h3>
                  <p className="text-muted-foreground text-sm">
                    발송부터 답장까지, 린다가 만든 성과예요
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "발송", color: "#64748b" },
                    { label: "오픈", color: "#0ea5e9" },
                    { label: "클릭", color: "#f59e0b" },
                    { label: "답장", color: "#22c55e" },
                  ].map((item) => (
                    <div className="flex items-center gap-1" key={item.label}>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground text-xs">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                {isLoading ? (
                  <div className="space-y-1">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton
                        className="mx-auto h-10"
                        key={i}
                        style={{ width: `${100 - (i - 1) * 20}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center overflow-hidden rounded-lg">
                    {(() => {
                      const funnelData = [
                        {
                          label: totalStats.scheduled > 0 ? "발송(예정 포함)" : "발송",
                          value: totalStats.total, // scheduled + sent
                          rate: 100,
                          color: "#64748b",
                          prevValue: null as number | null,
                        },
                        {
                          label: "오픈",
                          value: totalStats.opened,
                          rate: totalStats.openRate,
                          color: "#0ea5e9",
                          prevValue: totalStats.total,
                        },
                        {
                          label: "클릭",
                          value: totalStats.clicked,
                          rate: totalStats.clickRate,
                          color: "#f59e0b",
                          prevValue: totalStats.opened,
                        },
                        {
                          label: "답장",
                          value: totalStats.replied,
                          rate: totalStats.replyRate,
                          color: "#22c55e",
                          prevValue: totalStats.clicked,
                        },
                      ]
                      // 급격한 깔때기 모양 - 고정 비율 사용
                      const defaultWidths = [100, 70, 45, 25] // 급격한 기울기

                      return funnelData.map((item, index) => {
                        const topWidth = defaultWidths[index]
                        const bottomWidth =
                          index < funnelData.length - 1 ? defaultWidths[index + 1] : 15

                        // 사다리꼴 clip-path 계산
                        const topLeft = (100 - topWidth) / 2
                        const topRight = 100 - topLeft
                        const bottomLeft = (100 - bottomWidth) / 2
                        const bottomRight = 100 - bottomLeft

                        // 드롭오프율 계산 (이전 단계 대비 이탈율)
                        const dropOffRate =
                          item.prevValue && item.prevValue > 0
                            ? ((item.prevValue - item.value) / item.prevValue) * 100
                            : null

                        return (
                          <TooltipProvider key={item.label}>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="relative flex h-11 w-full cursor-pointer items-center justify-center transition-all hover:opacity-90"
                                  style={{
                                    backgroundColor: item.color,
                                    clipPath: `polygon(${topLeft}% 0%, ${topRight}% 0%, ${bottomRight}% 100%, ${bottomLeft}% 100%)`,
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-white">
                                      {item.label}
                                    </span>
                                    <span className="font-semibold text-white tabular-nums">
                                      {formatNumber(item.value)}
                                    </span>
                                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-white text-xs tabular-nums">
                                      {formatPercent(item.rate)}
                                    </span>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[220px]" side="right">
                                <div className="space-y-1">
                                  <p className="font-medium">
                                    {item.label}: {formatNumber(item.value)}건
                                  </p>
                                  <p className="text-muted-foreground text-xs">
                                    전체 발송 대비 {formatPercent(item.rate)}
                                  </p>
                                  {dropOffRate !== null && dropOffRate > 0 && (
                                    <p className="text-red-500 text-xs">
                                      이전 단계 대비 이탈률: {dropOffRate.toFixed(1)}%
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Country Distribution */}
            <div className="col-span-12 rounded-lg border bg-background md:col-span-6 lg:col-span-4">
              <div className="border-b px-4 py-3">
                <h3 className="font-medium">국가별 바이어</h3>
                <p className="text-muted-foreground text-sm">
                  린다가 연락한 바이어들의 국가 분포예요
                </p>
              </div>
              <div className="p-4">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton className="h-8 w-full" key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="[&_.recharts-wrapper]:!outline-none [&_svg]:!outline-none h-[160px]">
                    <ResponsiveContainer height="100%" width="100%">
                      <BarChart data={filteredCountryStats.slice(0, 5)} layout="vertical">
                        <XAxis
                          axisLine={false}
                          domain={[0, 10]}
                          tick={{ fontSize: 11, fill: "#6b7280" }}
                          tickLine={false}
                          type="number"
                        />
                        <YAxis
                          axisLine={false}
                          dataKey="country"
                          tick={{ fontSize: 12, fill: "#374151" }}
                          tickLine={false}
                          type="category"
                          width={80}
                        />
                        <Tooltip formatter={(value) => [value ?? 0, "잠재고객"]} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {filteredCountryStats.slice(0, 5).map((_, index) => (
                            <Cell
                              fill={
                                ["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6"][index % 5]
                              }
                              key={`cell-${index}`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Hot Leads */}
            <div className="col-span-12 rounded-lg border bg-background md:col-span-6 lg:col-span-4">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="font-medium">관심 보이는 바이어</h3>
                  <p className="text-muted-foreground text-sm">
                    이메일을 여러 번 열어봤어요 — 관심 신호!
                  </p>
                </div>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 text-xs">
                  {stats?.hotLeads?.length || 0}명
                </span>
              </div>
              <div className="p-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton className="h-12 w-full" key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(stats?.hotLeads && stats.hotLeads.length > 0
                      ? stats.hotLeads.slice(0, 4)
                      : [
                          {
                            id: "p1",
                            companyName: "회사명",
                            email: "email@example.com",
                            openCount: 0,
                          },
                          {
                            id: "p2",
                            companyName: "회사명",
                            email: "email@example.com",
                            openCount: 0,
                          },
                          {
                            id: "p3",
                            companyName: "회사명",
                            email: "email@example.com",
                            openCount: 0,
                          },
                        ]
                    ).map((lead, index) => (
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-2",
                          stats?.hotLeads?.length ? "hover:bg-muted/50" : "opacity-40",
                        )}
                        key={lead.id}
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-100 font-semibold text-orange-600 text-xs">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">{lead.companyName}</p>
                          <p className="truncate text-muted-foreground text-xs">{lead.email}</p>
                        </div>
                        <span
                          className={cn(
                            "rounded-md px-2 py-1 font-medium text-xs tabular-nums",
                            lead.openCount >= 30
                              ? "bg-red-100 text-red-700"
                              : lead.openCount >= 10
                                ? "bg-orange-100 text-orange-700"
                                : "bg-purple-100 text-purple-700",
                          )}
                        >
                          오픈 {lead.openCount}회
                        </span>
                      </div>
                    ))}
                    {stats?.hotLeads && stats.hotLeads.length > 0 && (
                      <Button
                        className="mt-2 w-full text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                        onClick={() => window.open(UPGRADE_URL, "_blank")}
                        size="sm"
                        variant="ghost"
                      >
                        상세 정보 확인하기
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Activity Log */}
            <div className="col-span-12 rounded-lg border bg-background lg:col-span-4">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h3 className="font-medium">린다가 하는 일</h3>
                  <p className="text-muted-foreground text-sm">
                    지금 이 순간에도 린다가 영업 중이에요
                  </p>
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 text-xs">
                  {filteredActivity.length}건
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto p-3">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton className="h-10 w-full" key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(filteredActivity.length > 0
                      ? filteredActivity.slice(0, 10)
                      : [
                          {
                            id: "p1",
                            type: "sent",
                            companyName: "회사명",
                            email: "email@example.com",
                            timestamp: new Date().toISOString(),
                          },
                          {
                            id: "p2",
                            type: "opened",
                            companyName: "회사명",
                            email: "email@example.com",
                            timestamp: new Date().toISOString(),
                          },
                          {
                            id: "p3",
                            type: "clicked",
                            companyName: "회사명",
                            email: "email@example.com",
                            timestamp: new Date().toISOString(),
                          },
                          {
                            id: "p4",
                            type: "replied",
                            companyName: "회사명",
                            email: "email@example.com",
                            timestamp: new Date().toISOString(),
                          },
                        ]
                    ).map((activity) => (
                      <div
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5",
                          filteredActivity.length > 0 ? "hover:bg-muted/50" : "opacity-40",
                        )}
                        key={activity.id}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: getMetricColor(activity.type) }}
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {activity.companyName || activity.email}
                        </span>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {getMetricLabel(activity.type)}
                        </span>
                        <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                          {filteredActivity.length > 0
                            ? formatRelativeTime(activity.timestamp)
                            : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent className="space-y-4" value="leads">
          {firstSequenceId ? (
            <SequenceEnrollmentsTable sequenceId={firstSequenceId} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-background py-16">
              <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">아직 바이어가 없어요</p>
              <p className="mt-1 text-muted-foreground/70 text-sm">
                캠페인을 시작하면 린다가 바이어를 찾아드릴게요!
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent className="space-y-4" value="emails">
          {firstSequenceId ? (
            <SequenceStepsList isEdit={true} readOnly={false} sequenceId={firstSequenceId} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border bg-background py-16">
              <Mail className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">아직 캠페인이 없어요</p>
              <p className="mt-1 text-muted-foreground/70 text-sm">
                첫 캠페인을 만들면 린다가 바로 영업을 시작해요!
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Info */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <ul className="space-y-1 text-blue-700 text-sm">
          <li>• 바이어가 답장하면 린다가 자동으로 발송을 멈춰요. 스팸 걱정 없이 안심하세요!</li>
          <li>
            • 바이어가 이메일을 10회 이상 열어보면 린다 팀이 직접 연락드려요. 영업 기회를 놓치지
            마세요!
          </li>
        </ul>
      </div>
    </div>
  )
}
