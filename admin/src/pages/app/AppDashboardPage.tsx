import { format } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  Lock,
  Mail,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
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
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Tooltip as UITooltip,
} from "@/components/ui/tooltip"
import { useUnifiedDashboardStats } from "@/lib/api/hooks/dashboard"
import { useEmailAccountsByWorkspace } from "@/lib/api/hooks/email-accounts"
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import {
  useSequenceEnrollments,
  useSequenceLeads,
  useSequenceSteps,
  useSequencesByWorkspace,
} from "@/lib/api/hooks/sequences"
import { useWorkspaceSubscription } from "@/lib/api/hooks/workspaces"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { SequenceLeadsTable } from "@/pages/sequences/SequenceLeadsTable"
import { SequenceStepsList } from "@/pages/sequences/SequenceStepList"

const UPGRADE_URL = "https://rinda.ai/contact"

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

type JourneyStage = "setup" | "sending" | "open" | "reply" | "meeting" | "deal"

type UpgradeFeature = "meeting" | "deal" | "trial_expired" | null

export default function AppDashboardPage() {
  const [selectedStage, setSelectedStage] = useState<JourneyStage>("setup")
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState<UpgradeFeature>(null)

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    return { from: thirtyDaysAgo, to: today }
  })
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null)

  const { selectedWorkspace } = useWorkspace()

  // 현재 로그인한 사용자 정보
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])

  // workspaceId: "all"이면 undefined로 전체 조회
  const workspaceId = selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id

  // 온보딩 진행 상황 가져오기
  const { data: onboardingProgress } = useOnboardingProgress(workspaceId || "", !!workspaceId)

  // 워크스페이스 구독 정보 조회 (tier 확인용)
  const { data: subscriptionData, isLoading: isLoadingSubscription } = useWorkspaceSubscription(
    workspaceId || "",
    !!workspaceId,
  )

  // Tier 정보 캐싱 (깜박임 방지)
  const [cachedTier, setCachedTier] = useState<string | null>(() => {
    if (workspaceId) {
      return sessionStorage.getItem(`workspace_tier_${workspaceId}`)
    }
    return null
  })

  // 구독 정보가 로드되면 tier 캐시 업데이트
  useEffect(() => {
    if (!isLoadingSubscription && subscriptionData?.subscription?.tier && workspaceId) {
      const newTier = subscriptionData.subscription.tier
      setCachedTier(newTier)
      sessionStorage.setItem(`workspace_tier_${workspaceId}`, newTier)
    }
  }, [subscriptionData, isLoadingSubscription, workspaceId])

  // 실제 tier 또는 캐시된 tier 사용 (깜박임 방지)
  const tier = subscriptionData?.subscription?.tier || cachedTier || "trial"

  // Tier에 따라 기본 탭 설정
  const defaultTab = useMemo(() => {
    if (tier === "pro" || tier === "enterprise") {
      return "performance" // Pro/Enterprise는 영업 성과만
    }
    if (tier === "basic") {
      return "leads" // Basic은 바이어 목록부터
    }
    return "journey" // Trial은 여정부터
  }, [tier])

  const [activeTab, setActiveTab] = useState(defaultTab)

  // tier가 변경되면 activeTab도 변경 (로딩 완료 후에만)
  useEffect(() => {
    if (isLoadingSubscription) {
      return
    }

    // 현재 탭이 tier에 맞지 않으면 기본 탭으로 변경
    if (tier === "pro" || tier === "enterprise") {
      if (activeTab !== "performance") {
        setActiveTab("performance")
      }
    } else if (tier === "basic") {
      if (activeTab === "journey") {
        setActiveTab("leads")
      }
    }
  }, [tier, activeTab, isLoadingSubscription])

  // 바이어 목록, 이메일 캠페인 탭에서 사용할 시퀀스 목록
  const { data: sequences } = useSequencesByWorkspace(workspaceId || "", !!workspaceId)

  // 선택된 시퀀스 ID (사용자가 드롭다운에서 명시적으로 선택한 것만 사용)
  const activeSequenceId = selectedSequenceId

  // 선택된 시퀀스 정보
  const selectedSequence = sequences?.find((seq) => seq.id === activeSequenceId)

  // 시퀀스의 리드 정보 가져오기 (두 가지 방법 모두 시도)
  const { data: leadsData } = useSequenceLeads(activeSequenceId || "", 1, 1000, !!activeSequenceId)
  const { data: enrollmentsData } = useSequenceEnrollments(
    activeSequenceId || "",
    1,
    1000,
    !!activeSequenceId,
  )

  // 바이어 수: 캠페인이 선택되었을 때만 표시
  const leadsCount = activeSequenceId
    ? enrollmentsData?.total ||
      leadsData?.total ||
      onboardingProgress?.selectedLeadIds?.length ||
      selectedSequence?.enrollmentsCount ||
      0
    : 0

  // 워크스페이스의 이메일 계정 가져오기
  const { data: emailAccounts } = useEmailAccountsByWorkspace(workspaceId || "", !!workspaceId)

  // 이메일 계정: 워크스페이스의 첫 번째 이메일 또는 로그인한 사용자 이메일
  const emailAccount = emailAccounts?.[0]?.email || currentUser?.email || null

  // 시퀀스 스텝 정보 가져오기
  const { data: sequenceSteps } = useSequenceSteps(activeSequenceId || "", !!activeSequenceId)
  const stepsCount = sequenceSteps?.length || selectedSequence?.stepsCount || 0

  // 체험판 진행 일수 계산
  const trialDay = useMemo(() => {
    if (!onboardingProgress?.completedAt) {
      return 1
    }
    const startDate = new Date(onboardingProgress.completedAt)
    const today = new Date()
    const diffTime = today.getTime() - startDate.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1: 시작일을 Day 1로
    return Math.max(diffDays, 1) // 최소 1일, 최대 제한 없음
  }, [onboardingProgress?.completedAt])

  // 체험판 만료 여부 (14일 초과)
  const isTrialExpired = trialDay > 14

  // 워크스페이스 전체/선택에 따라 데이터 조회
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useUnifiedDashboardStats({
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

  const handleSequenceChange = (sequenceId: string) => {
    setSelectedSequenceId(sequenceId)
  }

  const handleStageClick = (stage: JourneyStage) => {
    // 단계 전환은 항상 수행 (데이터 볼 수 있도록)
    setSelectedStage(stage)

    // 체험판 만료 시 setup 단계 외에는 결제 안내 팝업 표시
    if (isTrialExpired && stage !== "setup") {
      setUpgradeFeature("trial_expired")
      setShowUpgradeModal(true)
    }
  }

  // Calculate totals and rates (with dummy data for testing)
  const totalStats = useMemo(() => {
    const scheduled = stats?.funnel?.scheduled || 0
    const sent = stats?.funnel?.sent || 0
    const opened = stats?.funnel?.opened || 0
    const clicked = stats?.funnel?.clicked || 0
    const replied = stats?.funnel?.replied || 0

    // 실제 데이터
    const effectiveScheduled =
      scheduled > 0 ? scheduled : leadsCount > 0 && sent === 0 ? leadsCount : 0
    const total = effectiveScheduled + sent

    return {
      scheduled: effectiveScheduled,
      sent,
      total,
      opened,
      clicked,
      replied,
      openRate: stats?.funnel?.openRate || 0,
      clickRate: stats?.funnel?.clickRate || 0,
      replyRate: stats?.funnel?.replyRate || 0,
      ctr: opened > 0 ? (clicked / opened) * 100 : 0,
      sendingProgress: total > 0 ? (sent / total) * 100 : 0,
    }
  }, [stats?.funnel, leadsCount])

  // workspaceId가 undefined면 전체 워크스페이스 조회 (더 이상 에러 표시 안함)

  return (
    <div className="space-y-4">
      <Tabs className="space-y-4" onValueChange={setActiveTab} value={activeTab}>
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <TabsList className="h-9 rounded-lg bg-muted p-1">
              {/* 여정 탭 - Trial만 */}
              {tier === "trial" && (
                <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="journey">
                  <MapPin className="h-3.5 w-3.5" />
                  여정
                </TabsTrigger>
              )}
              {/* 바이어 목록 탭 - Trial, Basic */}
              {(tier === "trial" || tier === "basic") && (
                <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="leads">
                  <Users className="h-3.5 w-3.5" />
                  바이어 목록
                </TabsTrigger>
              )}
              {/* 이메일 목록 탭 - Trial, Basic */}
              {(tier === "trial" || tier === "basic") && (
                <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="emails">
                  <Mail className="h-3.5 w-3.5" />
                  이메일 목록
                </TabsTrigger>
              )}
              {/* 영업 성과 탭 - 모든 tier */}
              <TabsTrigger className="h-7 gap-1.5 px-3 text-sm" value="performance">
                <TrendingUp className="h-3.5 w-3.5" />
                영업 성과
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

          {(activeTab === "journey" || activeTab === "performance") && (
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

              {/* Campaign Filter */}
              {sequences && sequences.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 gap-1.5 text-sm" size="sm" variant="outline">
                      <Mail className="h-3.5 w-3.5" />
                      <span className="max-w-[150px] truncate">
                        {selectedSequence?.name || "캠페인 선택"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[280px]">
                    <DropdownMenuLabel>캠페인 선택</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {sequences.map((sequence) => (
                      <DropdownMenuCheckboxItem
                        checked={activeSequenceId === sequence.id}
                        key={sequence.id}
                        onCheckedChange={() => handleSequenceChange(sequence.id)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{sequence.name}</span>
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            <span
                              className={cn(
                                "rounded-full px-1.5 py-0.5",
                                sequence.status === "active" && "bg-green-100 text-green-700",
                                sequence.status === "paused" && "bg-yellow-100 text-yellow-700",
                                sequence.status === "draft" && "bg-gray-100 text-gray-600",
                              )}
                            >
                              {sequence.status === "active"
                                ? "실행중"
                                : sequence.status === "paused"
                                  ? "일시정지"
                                  : "초안"}
                            </span>
                            {sequence.customerGroupName && (
                              <span>· {sequence.customerGroupName}</span>
                            )}
                          </div>
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        <TabsContent className="space-y-4" value="journey">
          {/* 여정 뷰 - 단계별 진행 상황 */}
          <div className="space-y-4">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="font-bold text-2xl">RINDA 무료 체험 중</h2>
                <p className="mt-1 text-muted-foreground text-sm">
                  린다가 대표님 대신 해외영업 하고 있어요
                </p>
              </div>
              <div className="flex flex-col items-end">
                <div
                  className={cn(
                    "font-semibold text-xl",
                    isTrialExpired ? "text-red-600" : "text-blue-600",
                  )}
                >
                  {isTrialExpired
                    ? `체험판 종료 (${trialDay - 14}일 경과)`
                    : `Day ${trialDay} · ${14 - trialDay}일 남았어요`}
                </div>
              </div>
            </div>

            {/* 가로 타임라인 */}
            <Card className="p-6">
              <div className="relative">
                {/* 연결선 */}
                <div className="absolute top-4 right-0 left-0 h-0.5 bg-gray-200" />
                <div
                  className="absolute top-4 left-0 h-0.5 bg-blue-600 transition-all duration-500"
                  style={{
                    width:
                      totalStats.replied > 0
                        ? "66.6%"
                        : totalStats.opened > 0
                          ? "50%"
                          : totalStats.sent > 0
                            ? "33.3%"
                            : "16.6%",
                  }}
                />

                {/* 단계들 */}
                <div className="relative flex items-start justify-between">
                  {/* 1. 설정완료 (완료) */}
                  <button
                    className="flex flex-1 flex-col items-center transition-transform hover:scale-105"
                    onClick={() => handleStageClick("setup")}
                    type="button"
                  >
                    <div
                      className={cn(
                        "mb-2 flex h-8 w-8 items-center justify-center rounded-full",
                        selectedStage === "setup"
                          ? "bg-blue-700 ring-2 ring-blue-300 ring-offset-2"
                          : "bg-blue-700",
                      )}
                    >
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-sm">설정완료</div>
                      <div className="mt-1 text-blue-700 text-xs">완료</div>
                    </div>
                  </button>

                  {/* 2. 발송시작 (진행중) */}
                  <button
                    className="flex flex-1 flex-col items-center transition-transform hover:scale-105"
                    onClick={() => handleStageClick("sending")}
                    type="button"
                  >
                    <div
                      className={cn(
                        "mb-2 flex h-8 w-8 items-center justify-center rounded-full",
                        selectedStage === "sending"
                          ? "bg-blue-600 ring-2 ring-blue-300 ring-offset-2"
                          : "bg-blue-500",
                      )}
                    >
                      <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-sm">발송시작</div>
                      <div className="mt-1 text-blue-600 text-xs">진행중</div>
                    </div>
                  </button>

                  {/* 3. 첫오픈 */}
                  <button
                    className="flex flex-1 flex-col items-center transition-transform hover:scale-105"
                    onClick={() => handleStageClick("open")}
                    type="button"
                  >
                    <div
                      className={cn(
                        "mb-2 flex h-8 w-8 items-center justify-center rounded-full",
                        totalStats.opened > 0
                          ? selectedStage === "open"
                            ? "bg-blue-700 ring-2 ring-blue-300 ring-offset-2"
                            : "bg-blue-700"
                          : selectedStage === "open"
                            ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100 ring-offset-2"
                            : "border-2 border-blue-200 bg-blue-50",
                      )}
                    >
                      {totalStats.opened > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <span className="font-medium text-blue-400 text-xs">3</span>
                      )}
                    </div>
                    <div className="text-center">
                      <div
                        className={cn(
                          "font-medium text-sm",
                          totalStats.opened > 0 ? "" : "text-blue-500",
                        )}
                      >
                        바이어가 열어봄
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-xs",
                          totalStats.opened > 0 ? "text-blue-700" : "text-blue-400",
                        )}
                      >
                        {totalStats.opened > 0 ? "완료" : "미진행"}
                      </div>
                    </div>
                  </button>

                  {/* 4. 첫답장 */}
                  <button
                    className="flex flex-1 flex-col items-center transition-transform hover:scale-105"
                    onClick={() => handleStageClick("reply")}
                    type="button"
                  >
                    <div
                      className={cn(
                        "mb-2 flex h-8 w-8 items-center justify-center rounded-full",
                        totalStats.replied > 0
                          ? selectedStage === "reply"
                            ? "bg-blue-700 ring-2 ring-blue-300 ring-offset-2"
                            : "bg-blue-700"
                          : selectedStage === "reply"
                            ? "border-blue-300 bg-blue-50 ring-2 ring-blue-100 ring-offset-2"
                            : "border-2 border-blue-200 bg-blue-50",
                      )}
                    >
                      {totalStats.replied > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <span className="font-medium text-blue-400 text-xs">4</span>
                      )}
                    </div>
                    <div className="text-center">
                      <div
                        className={cn(
                          "font-medium text-sm",
                          totalStats.replied > 0 ? "" : "text-blue-500",
                        )}
                      >
                        답장 도착
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-xs",
                          totalStats.replied > 0 ? "text-blue-700" : "text-blue-400",
                        )}
                      >
                        {totalStats.replied > 0 ? "완료" : "미진행"}
                      </div>
                    </div>
                  </button>

                  {/* 5. 미팅 (잠금) */}
                  <button
                    className="flex flex-1 flex-col items-center transition-transform hover:scale-105"
                    onClick={() => {
                      setUpgradeFeature("meeting")
                      setShowUpgradeModal(true)
                    }}
                    type="button"
                  >
                    <div className="relative mb-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 font-medium text-gray-500 text-sm">
                        미팅
                        <Lock className="h-3 w-3" />
                      </div>
                      <div className="mt-1 text-gray-400 text-xs">잠김</div>
                    </div>
                  </button>

                  {/* 6. 거래성사 (잠금) */}
                  <button
                    className="flex flex-1 flex-col items-center transition-transform hover:scale-105"
                    onClick={() => {
                      setUpgradeFeature("deal")
                      setShowUpgradeModal(true)
                    }}
                    type="button"
                  >
                    <div className="relative mb-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100">
                      <Lock className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 font-medium text-gray-500 text-sm">
                        거래성사
                        <Lock className="h-3 w-3" />
                      </div>
                      <div className="mt-1 text-gray-400 text-xs">잠김</div>
                    </div>
                  </button>
                </div>
              </div>
            </Card>

            {/* 선택된 단계 상세 정보 */}
            <div className="space-y-3">
              {/* 설정완료 */}
              {selectedStage === "setup" && (
                <>
                  <h3 className="font-semibold text-lg">완료된 설정</h3>
                  <Card>
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <CheckCircle2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">설정 완료</h4>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
                              완료
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground text-sm">
                            회사 프로필 및 캠페인 설정 완료
                          </p>
                        </div>
                      </div>

                      {/* 상세 정보 */}
                      <div className="mt-4 space-y-2 border-t pt-4">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          <span>회사 프로필 설정</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          <span>이메일 연동 ({emailAccount || "설정 필요"})</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          <span>바이어 {leadsCount}개 발굴</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          <span>이메일 시퀀스 {stepsCount}단계 생성</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* 발송시작 */}
              {selectedStage === "sending" && (
                <>
                  <h3 className="font-semibold text-lg">진행 중</h3>
                  <Card className="border-blue-200 bg-blue-50/50">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <div className="h-4 w-4 animate-pulse rounded-full bg-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">발송 시작</h4>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
                              진행 중
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground text-sm">
                            이메일 발송이 진행 중입니다
                          </p>
                        </div>
                      </div>

                      {/* 진행 상황 */}
                      <div className="mt-4 space-y-3 border-t pt-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>발송 진행률</span>
                            <span className="font-medium text-blue-600">
                              {totalStats.sent}건 / {totalStats.total}건 (
                              {Math.round(totalStats.sendingProgress)}%)
                            </span>
                          </div>
                          <Progress className="h-2" value={totalStats.sendingProgress} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-lg border bg-white p-3">
                            <div className="text-muted-foreground text-xs">발송 예정</div>
                            <div className="mt-1 font-semibold text-lg">
                              {totalStats.scheduled}건
                            </div>
                          </div>
                          <div className="rounded-lg border bg-white p-3">
                            <div className="text-muted-foreground text-xs">발송 완료</div>
                            <div className="mt-1 font-semibold text-lg">{totalStats.sent}건</div>
                          </div>
                        </div>
                        {totalStats.sent > 0 ? (
                          <p className="text-muted-foreground text-sm">
                            💡 첫 이메일 발송이 시작되었습니다. 24시간 내 30%의 오픈율을 기대할 수
                            있어요.
                          </p>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            💡 이메일 발송을 시작하면 여기에서 진행 상황을 확인할 수 있습니다.
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* 첫오픈 */}
              {selectedStage === "open" &&
                (totalStats.opened > 0 ? (
                  <>
                    <h3 className="font-semibold text-lg">완료된 단계</h3>
                    {/* 원래 완료 UI */}
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-lg">예정된 단계</h3>
                    <Card className="border-blue-200 bg-blue-50/50">
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <AlertCircle className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">첫 오픈</h4>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
                                미진행
                              </span>
                            </div>
                            <p className="mt-1 text-muted-foreground text-sm">
                              이메일 발송 후 바이어가 열어보면 여기에 표시됩니다
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </>
                ))}

              {/* 첫답장 */}
              {selectedStage === "reply" &&
                (totalStats.replied > 0 ? (
                  <>
                    <h3 className="font-semibold text-lg">완료된 단계</h3>
                    {/* 원래 완료 UI */}
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-lg">예정된 단계</h3>
                    <Card className="border-blue-200 bg-blue-50/50">
                      <div className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <AlertCircle className="h-6 w-6 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">첫 답장</h4>
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs">
                                미진행
                              </span>
                            </div>
                            <p className="mt-1 text-muted-foreground text-sm">
                              바이어가 답장하면 여기에 표시됩니다
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </>
                ))}

              {/* 미팅 (잠금) */}
              {selectedStage === "meeting" && (
                <>
                  <h3 className="font-semibold text-lg">🔒 프리미엄 기능</h3>
                  <Card className="border-amber-200 bg-amber-50/50">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          <Lock className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">미팅 관리</h4>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-xs">
                              프리미엄
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground text-sm">
                            상위 플랜에서 미팅 일정 관리 기능을 사용할 수 있습니다
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t pt-4">
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={() => window.open("https://rinda.ai/contact", "_blank")}
                        >
                          상담 문의
                        </Button>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* 거래성사 (잠금) */}
              {selectedStage === "deal" && (
                <>
                  <h3 className="font-semibold text-lg">🔒 프리미엄 기능</h3>
                  <Card className="border-amber-200 bg-amber-50/50">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                          <Lock className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">거래 성사 관리</h4>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-xs">
                              프리미엄
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground text-sm">
                            상위 플랜에서 거래 성사 추적 및 관리 기능을 사용할 수 있습니다
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 border-t pt-4">
                        <Button
                          className="w-full bg-amber-600 hover:bg-amber-700"
                          onClick={() => window.open("https://rinda.ai/contact", "_blank")}
                        >
                          상담 문의
                        </Button>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* 원래 미팅 코드 숨김 */}
              {false}

              {/* 원래 거래성사 코드 숨김 */}
              {false}
            </div>
          </div>
        </TabsContent>

        <TabsContent className="space-y-4" value="performance">
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
                      // 완만한 깔때기 모양 - 작은 화면에서도 텍스트 잘림 방지
                      const defaultWidths = [100, 80, 60, 45]

                      return funnelData.map((item, index) => {
                        const topWidth = defaultWidths[index]
                        const bottomWidth =
                          index < funnelData.length - 1 ? defaultWidths[index + 1] : 35

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

        {/* 업그레이드 팝업 */}
        <Dialog onOpenChange={setShowUpgradeModal} open={showUpgradeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                프리미엄 기능
              </DialogTitle>
              <DialogDescription>
                {upgradeFeature === "trial_expired"
                  ? "체험판이 종료되었습니다. 계속 사용하시려면 결제 후 이용해주세요."
                  : upgradeFeature === "meeting"
                    ? "미팅 일정 관리는 프리미엄 플랜에서 사용할 수 있습니다."
                    : upgradeFeature === "deal"
                      ? "거래 성사 추적 및 관리는 프리미엄 플랜에서 사용할 수 있습니다."
                      : "이 기능은 프리미엄 플랜에서 사용할 수 있습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="font-semibold text-sm">프리미엄 플랜 혜택</h4>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span>미팅 일정 관리 및 추적</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span>거래 성사 기록 및 분석</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span>영업 파이프라인 전체 관리</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <span>고급 분석 및 리포트</span>
                  </li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowUpgradeModal(false)} variant="outline">
                닫기
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  window.open("https://rinda.ai/contact", "_blank")
                  setShowUpgradeModal(false)
                }}
              >
                상담 문의
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <TabsContent className="space-y-4" value="leads">
          {activeSequenceId ? (
            <SequenceLeadsTable sequenceId={activeSequenceId} />
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
          {activeSequenceId ? (
            <SequenceStepsList isEdit={true} readOnly={false} sequenceId={activeSequenceId} />
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
