import { Mail, TrendingUp, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useCampaignNotifications,
  useDashboardStats,
  useEmailTrends,
  useLeadDiscoveryNotifications,
  useLeadTrends,
  useOpenRateTrends,
  useReplyNotifications,
} from "@/lib/api/hooks/dashboard"
import type { TrendDataPoint } from "@/lib/api/services/dashboard"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { DateRangePicker, type DateRangeValue } from "./components/DateRangePicker"
import {
  CampaignNotifications,
  LeadDiscoveryNotifications,
  ReplyNotifications,
} from "./components/NotificationCards"
import { StatsTrendCard } from "./components/StatsTrendCard"

export default function DashboardV2Page() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userName = currentUser?.username || "사용자"

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    if (localStorage.getItem("dashboard-date-range")) {
      const dateRange = JSON.parse(localStorage.getItem("dashboard-date-range") || "{}")
      return {
        from: new Date(dateRange.from),
        to: new Date(dateRange.to),
        preset: dateRange.preset,
      }
    }
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 6)
    from.setHours(0, 0, 0, 0)
    const dateRange = { from, to, preset: "last7days" }
    return dateRange
  })

  // Save date range to localStorage
  useEffect(() => {
    localStorage.setItem("dashboard-date-range", JSON.stringify(dateRange))
  }, [dateRange])

  const dateRangeParams = {
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
    workspaceId: selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id,
  }

  // Fetch data
  const { data: stats, isLoading: statsLoading } = useDashboardStats(dateRangeParams)
  const { data: leadTrends = [], isLoading: leadTrendsLoading } = useLeadTrends(dateRangeParams)
  const { data: emailTrends = [], isLoading: emailTrendsLoading } = useEmailTrends(dateRangeParams)
  const { data: openRateTrends = [], isLoading: openRateTrendsLoading } =
    useOpenRateTrends(dateRangeParams)

  const { data: leadDiscoveryNotifications = [], isLoading: leadDiscoveryLoading } =
    useLeadDiscoveryNotifications({ ...dateRangeParams, limit: 10 })
  const { data: campaignNotifications = [], isLoading: campaignLoading } = useCampaignNotifications(
    { ...dateRangeParams, limit: 10 },
  )
  const { data: replyNotifications = [], isLoading: replyLoading } = useReplyNotifications({
    ...dateRangeParams,
    limit: 10,
  })

  const fillDataPoint = (data: TrendDataPoint[]): TrendDataPoint[] => {
    const startDate = new Date(dateRange.from)
    const endDate = new Date(dateRange.to)
    const filledData: TrendDataPoint[] = []
    for (let curDate = startDate; curDate <= endDate; curDate.setDate(curDate.getDate() + 1)) {
      const dateStr = curDate.toISOString().split("T")[0]
      const existingData = data.find((point) => point.date === dateStr)
      if (existingData) {
        filledData.push(existingData)
      } else {
        filledData.push({ date: dateStr, count: 0 })
      }
    }
    return filledData
  }

  const filledLeadTrends = fillDataPoint(leadTrends)
  const filledEmailTrends = fillDataPoint(emailTrends)
  const filledOpenRateTrends = fillDataPoint(openRateTrends)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">{t("dashboard.welcome", { userName })}</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("dashboard.dashboard", {
              workspaceName: selectedWorkspace?.name || t("dashboard.allWorkspace"),
            })}
          </p>
        </div>
        <DateRangePicker onChange={setDateRange} value={dateRange} />
      </div>

      {/* Stats and Trend Cards Row */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <StatsTrendCard
          color="#3b82f6"
          icon={Users}
          isLoading={statsLoading && leadTrendsLoading}
          periodCount={stats?.leads.periodCount ?? 0}
          title={t("dashboard.stats.totalCustomers")}
          totalCount={stats?.leads.total ?? 0}
          trendData={filledLeadTrends}
        />
        <StatsTrendCard
          color="#10b981"
          icon={Mail}
          isLoading={statsLoading && emailTrendsLoading}
          periodCount={stats?.emails.periodCount ?? 0}
          title={t("dashboard.stats.totalEmails")}
          totalCount={stats?.emails.total ?? 0}
          trendData={filledEmailTrends}
        />
        <StatsTrendCard
          color="#f59e0b"
          icon={TrendingUp}
          isLoading={statsLoading && openRateTrendsLoading}
          periodCount={stats?.openRate.periodOpened ?? 0}
          suffix="%"
          title={t("dashboard.stats.openRate")}
          totalCount={stats?.openRate.rate ?? 0}
          trendData={filledOpenRateTrends}
        />
      </div>

      {/* Stats Cards Row */}
      {/* <div className="grid gap-4 md:grid-cols-3 mb-6">
        <StatsCard
          title={t("dashboard.stats.totalCustomers")}
          icon={Users}
          total={stats?.leads.total ?? 0}
          periodCount={stats?.leads.periodCount ?? 0}
          isLoading={statsLoading}
        />
        <StatsCard
          title={t("dashboard.stats.totalEmails")}
          icon={Mail}
          total={stats?.emails.total ?? 0}
          periodCount={stats?.emails.periodCount ?? 0}
          isLoading={statsLoading}
        />
        <StatsCard
          title={t("dashboard.stats.openRate")}
          icon={TrendingUp}
          total={stats?.openRate.rate ?? 0}
          periodCount={0}
          suffix="%"
          decimals={1}
          isLoading={statsLoading}
        />
      </div> */}

      {/* Trend Charts Row */}
      {/* <div className="grid gap-4 md:grid-cols-3 mb-6">
        <TrendChart
          title={t("dashboard.trends.leads.title")}
          description={t("dashboard.trends.leads.description")}
          data={leadTrends}
          isLoading={leadTrendsLoading}
          color="#3b82f6"
        />
        <TrendChart
          title={t("dashboard.trends.emails.title")}
          description={t("dashboard.trends.emails.description")}
          data={emailTrends}
          isLoading={emailTrendsLoading}
          color="#10b981"
        />
        <TrendChart
          title={t("dashboard.trends.openRate.title")}
          description={t("dashboard.trends.openRate.description")}
          data={openRateTrends}
          isLoading={openRateTrendsLoading}
          color="#f59e0b"
          formatValue={(value) => `${value}%`}
        />
      </div> */}

      {/* Notification Cards Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <LeadDiscoveryNotifications
          isLoading={leadDiscoveryLoading}
          notifications={leadDiscoveryNotifications}
        />
        <CampaignNotifications isLoading={campaignLoading} notifications={campaignNotifications} />
        <ReplyNotifications isLoading={replyLoading} notifications={replyNotifications} />
      </div>
    </div>
  )
}
