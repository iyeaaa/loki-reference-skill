import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  RefreshCw,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { DateRange } from "react-day-picker"
import { useTranslation } from "react-i18next"
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
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip as UITooltip,
} from "@/components/ui/tooltip"
import { useTrialDashboardStats } from "@/lib/api/hooks/dashboard"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"

const UPGRADE_URL = "https://rinda.ai/contact"

const PRESET_RANGES = [
  { key: "7d", label: "last7days", days: 7 },
  { key: "14d", label: "last14days", days: 14 },
  { key: "30d", label: "last30days", days: 30 },
  { key: "90d", label: "last90days", days: 90 },
] as const

// 이메일 퍼널 단계별 의미론적 색상
const METRICS = [
  { key: "sent", label: "sent", color: "#64748b" },
  { key: "opened", label: "opened", color: "#0ea5e9" },
  { key: "clicked", label: "clicked", color: "#f59e0b" },
  { key: "replied", label: "replied", color: "#22c55e" },
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

export default function DashboardV2Page() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userName = currentUser?.username || t("dashboard.user")

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (localStorage.getItem("dashboard-date-range")) {
      const saved = JSON.parse(localStorage.getItem("dashboard-date-range") || "{}")
      return {
        from: new Date(saved.from),
        to: new Date(saved.to),
      }
    }
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    return { from: thirtyDaysAgo, to: today }
  })

  const [selectedCountries, setSelectedCountries] = useState<string[]>([])

  // Save date range to localStorage
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      localStorage.setItem("dashboard-date-range", JSON.stringify(dateRange))
    }
  }, [dateRange])

  // workspaceId: "all"이면 undefined로 전체 조회
  const workspaceId = selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id

  // 단일 최적화된 API 호출
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useTrialDashboardStats({
    workspaceId,
    startDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
    endDate: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
  })

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
      return [
        { country: t("dashboard.countries.usa"), count: 0, percentage: 0 },
        { country: t("dashboard.countries.germany"), count: 0, percentage: 0 },
        { country: t("dashboard.countries.japan"), count: 0, percentage: 0 },
        { country: t("dashboard.countries.uk"), count: 0, percentage: 0 },
        { country: t("dashboard.countries.france"), count: 0, percentage: 0 },
      ]
    }
    if (selectedCountries.length === 0) {
      return stats.countryStats
    }
    return stats.countryStats.filter((c) => selectedCountries.includes(c.country))
  }, [stats?.countryStats, selectedCountries, t])

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
      return t("dashboard.time.justNow")
    }
    if (diffMins < 60) {
      return t("dashboard.time.minutesAgo", { minutes: diffMins })
    }
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) {
      return t("dashboard.time.hoursAgo", { hours: diffHours })
    }
    const diffDays = Math.floor(diffHours / 24)
    return t("dashboard.time.daysAgo", { days: diffDays })
  }

  const getMetricColor = (type: string) => METRICS.find((m) => m.key === type)?.color || "#94a3b8"
  const getMetricLabel = (type: string) => {
    const metric = METRICS.find((m) => m.key === type)
    return metric ? t(`dashboard.metrics.${metric.label}`) : type
  }

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
      total: scheduled + sent,
      opened,
      clicked,
      replied,
      openRate: stats?.funnel?.openRate || 0,
      clickRate: stats?.funnel?.clickRate || 0,
      replyRate: stats?.funnel?.replyRate || 0,
      ctr: opened > 0 ? (clicked / opened) * 100 : 0,
    }
  }, [stats?.funnel])

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-2xl">{t("dashboard.welcome", { userName })}</h1>
            <p className="mt-1 text-muted-foreground text-sm">
              {t("dashboard.dashboard", {
                workspaceName: selectedWorkspace?.name || t("dashboard.allWorkspace"),
              })}
            </p>
          </div>
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
                  t("dashboard.selectPeriod")
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
                        {t(`dashboard.dateRange.${preset.label}`)}
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
                  {t("dashboard.region")} ({selectedCountries.length}/{availableCountries.length})
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                <DropdownMenuLabel>{t("dashboard.countryFilter")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={selectedCountries.length === availableCountries.length}
                  className="font-medium"
                  onCheckedChange={(checked) =>
                    setSelectedCountries(checked ? availableCountries : [])
                  }
                >
                  {t("dashboard.all")}
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
      </div>

      {/* KPI Cards */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: t("dashboard.metrics.sent"),
              value: totalStats.total,
              scheduled: totalStats.scheduled,
              color: "#64748b",
            },
            {
              label: t("dashboard.metrics.opened"),
              value: totalStats.opened,
              rate: totalStats.openRate,
              rateLabel: t("dashboard.rateLabel.totalSent"),
              color: "#0ea5e9",
            },
            {
              label: t("dashboard.metrics.clicked"),
              value: totalStats.clicked,
              rate: totalStats.clickRate,
              rateLabel: t("dashboard.rateLabel.totalSent"),
              ctr: totalStats.ctr,
              color: "#f59e0b",
            },
            {
              label: t("dashboard.metrics.replied"),
              value: totalStats.replied,
              rate: totalStats.replyRate,
              rateLabel: t("dashboard.rateLabel.totalSent"),
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
                      <span className="text-base text-muted-foreground">
                        {t("dashboard.count")}
                      </span>
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
                        +{stat.scheduled}
                        {t("dashboard.scheduledCount")}
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
                          <p className="font-medium">{t("dashboard.ctor.title")}</p>
                          <p className="text-muted-foreground text-xs">
                            {t("dashboard.ctor.description")}
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
              <h3 className="font-medium">{t("dashboard.charts.emailTrend.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.charts.emailTrend.description")}
              </p>
            </div>
            <div className="flex gap-4">
              {[
                {
                  key: "sent",
                  label: t("dashboard.metrics.sent"),
                  color: "#64748b",
                  dashed: false,
                },
                {
                  key: "opened",
                  label: t("dashboard.metrics.opened"),
                  color: "#0ea5e9",
                  dashed: true,
                },
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
                      domain={[0, "auto"]}
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
                        const label =
                          name === "sent"
                            ? t("dashboard.metrics.sent")
                            : t("dashboard.metrics.opened")
                        const color = name === "sent" ? "#64748b" : "#0ea5e9"
                        return [
                          <span key={name} style={{ color }}>
                            {label}:{" "}
                            <strong>
                              {value ?? 0}
                              {t("dashboard.countUnit")}
                            </strong>
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
              <h3 className="font-medium">{t("dashboard.charts.funnel.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.charts.funnel.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {METRICS.map((item) => (
                <div className="flex items-center gap-1" key={item.key}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground text-xs">
                    {t(`dashboard.metrics.${item.label}`)}
                  </span>
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
                      label:
                        totalStats.scheduled > 0
                          ? t("dashboard.funnel.sentWithScheduled")
                          : t("dashboard.metrics.sent"),
                      value: totalStats.total,
                      rate: 100,
                      color: "#64748b",
                      prevValue: null as number | null,
                    },
                    {
                      label: t("dashboard.metrics.opened"),
                      value: totalStats.opened,
                      rate: totalStats.openRate,
                      color: "#0ea5e9",
                      prevValue: totalStats.total,
                    },
                    {
                      label: t("dashboard.metrics.clicked"),
                      value: totalStats.clicked,
                      rate: totalStats.clickRate,
                      color: "#f59e0b",
                      prevValue: totalStats.opened,
                    },
                    {
                      label: t("dashboard.metrics.replied"),
                      value: totalStats.replied,
                      rate: totalStats.replyRate,
                      color: "#22c55e",
                      prevValue: totalStats.clicked,
                    },
                  ]
                  const defaultWidths = [100, 70, 45, 25]

                  return funnelData.map((item, index) => {
                    const topWidth = defaultWidths[index]
                    const bottomWidth =
                      index < funnelData.length - 1 ? defaultWidths[index + 1] : 15

                    const topLeft = (100 - topWidth) / 2
                    const topRight = 100 - topLeft
                    const bottomLeft = (100 - bottomWidth) / 2
                    const bottomRight = 100 - bottomLeft

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
                                <span className="font-medium text-sm text-white">{item.label}</span>
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
                                {item.label}: {formatNumber(item.value)}
                                {t("dashboard.countUnit")}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {t("dashboard.funnel.totalSentRate")} {formatPercent(item.rate)}
                              </p>
                              {dropOffRate !== null && dropOffRate > 0 && (
                                <p className="text-red-500 text-xs">
                                  {t("dashboard.funnel.dropOffRate")}: {dropOffRate.toFixed(1)}%
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
            <h3 className="font-medium">{t("dashboard.charts.country.title")}</h3>
            <p className="text-muted-foreground text-sm">
              {t("dashboard.charts.country.description")}
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
                      domain={[0, "auto"]}
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
                    <Tooltip
                      formatter={(value) => [value ?? 0, t("dashboard.charts.country.leads")]}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {filteredCountryStats.slice(0, 5).map((_, index) => (
                        <Cell
                          fill={["#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6"][index % 5]}
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
              <h3 className="font-medium">{t("dashboard.charts.hotLeads.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.charts.hotLeads.description")}
              </p>
            </div>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 text-xs">
              {stats?.hotLeads?.length || 0}
              {t("dashboard.people")}
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
                        companyName: t("dashboard.placeholder.companyName"),
                        email: "email@example.com",
                        openCount: 0,
                      },
                      {
                        id: "p2",
                        companyName: t("dashboard.placeholder.companyName"),
                        email: "email@example.com",
                        openCount: 0,
                      },
                      {
                        id: "p3",
                        companyName: t("dashboard.placeholder.companyName"),
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
                      {t("dashboard.charts.hotLeads.openCount", { count: lead.openCount })}
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
                    {t("dashboard.charts.hotLeads.viewDetails")}
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
              <h3 className="font-medium">{t("dashboard.charts.activity.title")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.charts.activity.description")}
              </p>
            </div>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 text-xs">
              {filteredActivity.length}
              {t("dashboard.items")}
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
                        companyName: t("dashboard.placeholder.companyName"),
                        email: "email@example.com",
                        timestamp: new Date().toISOString(),
                      },
                      {
                        id: "p2",
                        type: "opened",
                        companyName: t("dashboard.placeholder.companyName"),
                        email: "email@example.com",
                        timestamp: new Date().toISOString(),
                      },
                      {
                        id: "p3",
                        type: "clicked",
                        companyName: t("dashboard.placeholder.companyName"),
                        email: "email@example.com",
                        timestamp: new Date().toISOString(),
                      },
                      {
                        id: "p4",
                        type: "replied",
                        companyName: t("dashboard.placeholder.companyName"),
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
                      {filteredActivity.length > 0 ? formatRelativeTime(activity.timestamp) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <ul className="space-y-1 text-blue-700 text-sm">
          <li>• {t("dashboard.info.replyStop")}</li>
          <li>• {t("dashboard.info.hotLeadAlert")}</li>
        </ul>
      </div>
    </div>
  )
}
