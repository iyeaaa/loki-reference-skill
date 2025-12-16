import React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  type PieLabelRenderProps,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { VisualizationSuggestion } from "@/lib/api/types/chatbot"

type VisualizationDisplayProps = {
  visualizations: VisualizationSuggestion[]
  data: unknown[]
}

// Color palette for charts
const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export const VisualizationDisplay = React.memo(function VisualizationDisplay({
  visualizations,
  data,
}: VisualizationDisplayProps) {
  if (!visualizations || visualizations.length === 0 || !data || data.length === 0) {
    return null
  }

  const renderChart = (viz: VisualizationSuggestion, _index: number) => {
    const chartData = data as Record<string, unknown>[]

    // Get all numeric columns for richer visualizations
    const firstRow = chartData[0] || {}
    const allNumericKeys = Object.keys(firstRow).filter(
      (key) => typeof firstRow[key] === "number" && key !== (viz.xAxis || "name"),
    )

    // Determine which keys to display
    const displayKeys = viz.yAxis
      ? [viz.yAxis]
      : allNumericKeys.length > 0 && allNumericKeys.length <= 5
        ? allNumericKeys
        : allNumericKeys.slice(0, 3) // Limit to 3 for clarity

    switch (viz.type) {
      case "bar":
        return (
          <ResponsiveContainer height={350} width="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid opacity={0.3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                axisLine={{ stroke: "hsl(var(--border))" }}
                dataKey={viz.xAxis || "name"}
                fontSize={11}
                stroke="hsl(var(--foreground))"
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                fontSize={11}
                stroke="hsl(var(--foreground))"
                tickFormatter={(value) => {
                  if (value >= 1_000_000) {
                    return `${(value / 1_000_000).toFixed(1)}M`
                  }
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)}K`
                  }
                  return value.toString()
                }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: unknown) => {
                  if (typeof value === "number") {
                    return value.toLocaleString()
                  }
                  return String(value)
                }}
              />
              {displayKeys.length > 1 && <Legend wrapperStyle={{ fontSize: "11px" }} />}
              {displayKeys.map((key, idx) => (
                <Bar
                  dataKey={key}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  key={key}
                  name={key}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case "line":
        return (
          <ResponsiveContainer height={350} width="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid opacity={0.3} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis
                axisLine={{ stroke: "hsl(var(--border))" }}
                dataKey={viz.xAxis || "name"}
                fontSize={11}
                stroke="hsl(var(--foreground))"
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                fontSize={11}
                stroke="hsl(var(--foreground))"
                tickFormatter={(value) => {
                  if (value >= 1_000_000) {
                    return `${(value / 1_000_000).toFixed(1)}M`
                  }
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)}K`
                  }
                  return value.toString()
                }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: unknown) => {
                  if (typeof value === "number") {
                    return value.toLocaleString()
                  }
                  return String(value)
                }}
              />
              {displayKeys.length > 1 && <Legend wrapperStyle={{ fontSize: "11px" }} />}
              {displayKeys.map((key, idx) => (
                <Line
                  activeDot={{ r: 5 }}
                  dataKey={key}
                  dot={{ fill: CHART_COLORS[idx % CHART_COLORS.length], r: 3 }}
                  key={key}
                  name={key}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case "pie":
        return (
          <ResponsiveContainer height={350} width="100%">
            <PieChart>
              <Pie
                cx="50%"
                cy="50%"
                data={chartData}
                dataKey={viz.yAxis || "value"}
                fill="#8884d8"
                innerRadius={60}
                label={(props: PieLabelRenderProps) => {
                  const percent = typeof props.percent === "number" ? props.percent : 0
                  return `${props.name}: ${(percent * 100).toFixed(1)}%`
                }}
                labelLine={true}
                outerRadius={100}
                paddingAngle={2}
              >
                {chartData.map((_, idx) => (
                  <Cell fill={CHART_COLORS[idx % CHART_COLORS.length]} key={`cell-${idx}`} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: unknown) => {
                  if (typeof value === "number") {
                    return value.toLocaleString()
                  }
                  return String(value)
                }}
              />
              <Legend height={36} verticalAlign="bottom" wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          </ResponsiveContainer>
        )

      case "metric": {
        // For single or multiple metrics, show card display
        const metricRow = chartData[0]
        const metricKeys = viz.yAxis ? [viz.yAxis] : displayKeys.slice(0, 3)

        return (
          <div className="grid grid-cols-1 gap-4 py-6 md:grid-cols-3">
            {metricKeys.map((key, idx) => {
              const value = metricRow?.[key]
              return (
                <div
                  className="flex flex-col items-center justify-center rounded-lg border border-border bg-muted/30 p-4"
                  key={key}
                >
                  <div
                    className="mb-2 font-bold text-4xl"
                    style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}
                  >
                    {typeof value === "number" ? value.toLocaleString() : String(value)}
                  </div>
                  <div className="text-center text-muted-foreground text-xs uppercase tracking-wide">
                    {key}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }

      case "table": {
        // Compact table view
        const columns = Object.keys(chartData[0] || {})
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  {columns.map((col) => (
                    <th className="px-3 py-2 text-left font-medium" key={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.slice(0, 10).map((row, idx) => (
                  <tr className="border-b last:border-0" key={idx}>
                    {columns.map((col) => (
                      <td className="px-3 py-2" key={col}>
                        {String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {chartData.length > 10 && (
              <div className="py-2 text-center text-muted-foreground text-xs">
                Showing 10 of {chartData.length} rows
              </div>
            )}
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      {visualizations.map((viz, index) => (
        <Card className="overflow-hidden border border-border bg-background/80" key={index}>
          <CardHeader className="pb-3">
            <CardTitle className="font-semibold text-sm">{viz.title}</CardTitle>
            {viz.description && (
              <CardDescription className="text-xs leading-relaxed">
                {viz.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="pb-4">{renderChart(viz, index)}</CardContent>
        </Card>
      ))}
    </div>
  )
})
