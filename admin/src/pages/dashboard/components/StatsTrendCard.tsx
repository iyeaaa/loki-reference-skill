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

type TrendDataPoint = {
  date: string
  count: number
}

type StatsTrendCardProps = {
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
          <div className="flex w-[150px] flex-shrink-0 flex-col gap-2">
            <div className="mb-2 flex flex-row items-center gap-2">
              <CardTitle className="font-medium text-base">{title}</CardTitle>
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="mb-2 h-8 w-24" />
                <Skeleton className="h-4 w-16" />
              </>
            ) : (
              <div className="gap-1">
                <div className="font-bold text-2xl">
                  <AnimatedNumber decimals={decimals} value={totalCount} />
                  {suffix}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {periodCount > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  ) : periodCount < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : null}
                  <span
                    className={cn(
                      "font-medium text-xs",
                      periodCount > 0
                        ? "text-green-500"
                        : periodCount < 0
                          ? "text-red-500"
                          : "text-gray-500",
                    )}
                  >
                    {periodCount > 0 ? "+" : ""}
                    {periodCount > 0 ? (
                      <AnimatedNumber decimals={0} value={periodCount} />
                    ) : (
                      <span />
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 items-center justify-center">
            {isLoading ? (
              <Skeleton className="h-[12px] w-full" />
            ) : trendData.length === 0 ? (
              <div className="flex h-[120px] items-center justify-center text-muted-foreground text-sm">
                {/* 데이터가 없습니다 */}
              </div>
            ) : (
              <ResponsiveContainer height={120} width="100%">
                <AreaChart data={formattedData}>
                  <defs>
                    <linearGradient id={`color-${title}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    className="text-muted-foreground"
                    dataKey="dateFormatted"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
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
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] text-muted-foreground uppercase">
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
                    dataKey="count"
                    fill={`url(#color-${color})`}
                    fillOpacity={1}
                    stroke={color}
                    strokeWidth={2}
                    type="monotone"
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
