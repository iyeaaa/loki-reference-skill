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

interface VisualizationDisplayProps {
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
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey={viz.xAxis || "name"}
                stroke="hsl(var(--foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                stroke="hsl(var(--foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                  return value.toString()
                }}
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
                  key={key}
                  dataKey={key}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                  name={key}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case "line":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey={viz.xAxis || "name"}
                stroke="hsl(var(--foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                stroke="hsl(var(--foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                  return value.toString()
                }}
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
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS[idx % CHART_COLORS.length], r: 3 }}
                  activeDot={{ r: 5 }}
                  name={key}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={(props: PieLabelRenderProps) => {
                  const percent = typeof props.percent === "number" ? props.percent : 0
                  return `${props.name}: ${(percent * 100).toFixed(1)}%`
                }}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey={viz.yAxis || "value"}
                paddingAngle={2}
              >
                {chartData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
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
              <Legend wrapperStyle={{ fontSize: "11px" }} verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )

      case "metric": {
        // For single or multiple metrics, show card display
        const metricRow = chartData[0]
        const metricKeys = viz.yAxis ? [viz.yAxis] : displayKeys.slice(0, 3)

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6">
            {metricKeys.map((key, idx) => {
              const value = metricRow?.[key]
              return (
                <div
                  key={key}
                  className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg border border-border"
                >
                  <div
                    className="text-4xl font-bold mb-2"
                    style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}
                  >
                    {typeof value === "number" ? value.toLocaleString() : String(value)}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide text-center">
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
                    <th key={col} className="px-3 py-2 text-left font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chartData.slice(0, 10).map((row, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2">
                        {String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {chartData.length > 10 && (
              <div className="text-xs text-muted-foreground text-center py-2">
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
        <Card key={index} className="overflow-hidden border border-border bg-background/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{viz.title}</CardTitle>
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
