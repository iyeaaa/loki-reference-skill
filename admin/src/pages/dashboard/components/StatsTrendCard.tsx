import { format, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface TrendDataPoint {
  date: string
  count: number
}

interface StatsTrendCardProps {
  title: string
  icon: LucideIcon

  totalCount: number
  periodCount: number
  suffix?: string
  decimals?: number

  trendData: TrendDataPoint[]
  color?: string
  yAxisLabel?: string
  formatValue?: (value: number) => string

  isLoading?: boolean
  className?: string
}

export function StatsTrendCard({
  title,
  icon: Icon,
  totalCount,
  periodCount,
  suffix = "",
  decimals = 0,
  trendData,
  color = "#3b82f6",
  yAxisLabel,
  formatValue = (value: number) => value.toString(),
  isLoading = false,
  className,
}: StatsTrendCardProps) {
  const formattedData = trendData.map((point) => ({
    ...point,
    dateFormatted: format(parseISO(point.date), "MM/dd", { locale: ko }),
  }))

  return (
    <Card className={className}>
      <CardContent className="pt-8">
        <div className="flex flex-row justify-between gap-4">
          <div className="flex flex-col gap-2 w-[150px] flex-shrink-0">
            <div className="flex flex-row items-center mb-2 gap-2">
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-16" />
              </>
            ) : (
              <div className="gap-1">
                <div className="text-2xl font-bold">
                  <AnimatedNumber value={totalCount} decimals={decimals} />
                  {suffix}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {periodCount > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : periodCount < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : null}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      periodCount > 0
                        ? "text-green-500"
                        : periodCount < 0
                          ? "text-red-500"
                          : "text-gray-500",
                    )}
                  >
                    {periodCount > 0 ? "+" : ""}
                    {periodCount > 0 ? (
                      <AnimatedNumber value={periodCount} decimals={0} />
                    ) : (
                      <span></span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-[12px] w-full" />
            ) : trendData.length === 0 ? (
              <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
                {/* 데이터가 없습니다 */}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={formattedData}>
                  <defs>
                    <linearGradient id={`color-${title}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dateFormatted"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    label={
                      yAxisLabel
                        ? {
                            value: yAxisLabel,
                            angle: -90,
                            position: "insideLeft",
                            style: { fontSize: 12, fill: "currentColor" },
                          }
                        : undefined
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {payload[0].payload.date}
                                </span>
                                <span className="font-bold text-muted-foreground">
                                  {formatValue(payload[0].value as number)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={color}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#color-${color})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
