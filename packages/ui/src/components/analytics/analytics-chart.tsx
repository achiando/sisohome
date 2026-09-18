// components/analytics/analytics-chart.tsx

"use client"

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { ArrowRight } from "lucide-react"
import { Button } from "../button"
import { cn } from "@workspace/ui/lib/utils"
import type { ChartDef } from "@workspace/ui/types/components"

// Sequential purple ramp — line/area/bar trends (single or ordered series)
const SEQUENTIAL_COLORS = [
  "var(--chart-4)", // primary purple first — most important series reads as "on brand"
  "var(--chart-2)",
  "var(--chart-5)",
  "var(--chart-1)",
  "var(--chart-3)",
]

// Categorical set — pies/donuts needing visually distinct segments
const CATEGORICAL_COLORS = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
]

interface AnalyticsChartProps {
  chart: ChartDef
  className?: string
  /** Override chart container height in px (default: 208) */
  chartHeight?: number
}

function resolveColor(
  series: ChartDef["series"][number],
  index: number,
  palette: string[] = SEQUENTIAL_COLORS
) {
  return series.color ?? palette[index % palette.length]
}

export function AnalyticsChart({
  chart,
  className,
  chartHeight = 208,
}: AnalyticsChartProps) {
  const {
    type,
    title,
    description,
    data,
    series,
    xKey = "name",
    onDrillDown,
  } = chart

  const sharedProps = {
    data,
    margin: { top: 4, right: 4, left: -16, bottom: 0 },
  }

  const axisProps = {
    tick: { fontSize: 11, fill: "var(--foreground)" },
    axisLine: false,
    tickLine: false,
  }

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "6px",
      fontSize: 12,
      color: "var(--foreground)",
    },
    labelStyle: {
      color: "var(--foreground)",
    },
  }

  function renderChart() {
    switch (type) {
      case "line":
        return (
          <LineChart {...sharedProps}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            {series.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
              />
            )}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={resolveColor(s, i)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        )

      case "area":
        return (
          <AreaChart {...sharedProps}>
            <defs>
              {series.map((s, i) => (
                <linearGradient
                  key={s.key}
                  id={`grad-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={resolveColor(s, i)}
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor={resolveColor(s, i)}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            {series.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
              />
            )}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={resolveColor(s, i)}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
              />
            ))}
          </AreaChart>
        )

      case "bar":
        return (
          <BarChart {...sharedProps} barCategoryGap="20%" barGap={4}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            {series.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
              />
            )}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={resolveColor(s, i)}
                radius={[3, 3, 0, 0]}
                maxBarSize={64}
              />
            ))}
          </BarChart>
        )

      case "stacked-bar":
        return (
          <BarChart {...sharedProps} barCategoryGap="20%">
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                fill={resolveColor(s, i, CATEGORICAL_COLORS)}
                stackId="stack"
                maxBarSize={64}
                radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        )

      case "pie": {
        const valueKey = series[0]?.key ?? "value"
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey={valueKey}
              nameKey="name"
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            {data.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: "var(--foreground)" }}
              />
            )}
          </PieChart>
        )
      }

      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-card p-5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
        {onDrillDown && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDrillDown}
            className="h-7 shrink-0 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            View detail
            <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Chart */}
      <div className="min-h-[208px]" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          {renderChart() as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
