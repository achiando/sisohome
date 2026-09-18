// components/analytics/insight-panel.tsx

"use client"

import { Info, AlertTriangle, AlertOctagon, ArrowRight } from "lucide-react"
import { Button } from "../button"
import { cn } from "@workspace/ui/lib/utils"
import type { InsightPanel as InsightPanelDef } from "@workspace/ui/types/components"

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    containerClass:
      "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40",
    iconClass: "text-sky-600 dark:text-sky-400",
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
    badgeLabel: "Info",
  },
  warning: {
    icon: AlertTriangle,
    containerClass:
      "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
    iconClass: "text-amber-600 dark:text-amber-400",
    badgeClass:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    badgeLabel: "Warning",
  },
  critical: {
    icon: AlertOctagon,
    containerClass:
      "border-destructive/30 bg-destructive/5 dark:border-destructive/40",
    iconClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive",
    badgeLabel: "Critical",
  },
}

interface InsightPanelProps {
  panel: InsightPanelDef
}

export function InsightPanel({ panel }: InsightPanelProps) {
  const cfg = SEVERITY_CONFIG[panel.severity]
  const Icon = cfg.icon

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4",
        cfg.containerClass
      )}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.iconClass)} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                cfg.badgeClass
              )}
            >
              {cfg.badgeLabel}
            </span>
            {panel.affectedMetric && (
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                {panel.affectedMetric}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground">{panel.title}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {panel.explanation}
          </p>
        </div>
      </div>

      {/* Suggested action */}
      {panel.suggestedAction && (
        <div className="flex items-center justify-between gap-3 border-t border-current/10 pt-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Action: </span>
            {panel.suggestedAction}
          </p>
          {panel.onAction && (
            <Button
              size="sm"
              variant="outline"
              onClick={panel.onAction}
              className="h-6 shrink-0 gap-1 text-xs"
            >
              Go
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

interface InsightPanelsGroupProps {
  panels: InsightPanelDef[]
  title?: string
}

export function InsightPanelsGroup({
  panels,
  title = "Insights",
}: InsightPanelsGroupProps) {
  if (panels.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </span>
      {panels.map((panel) => (
        <InsightPanel key={panel.id} panel={panel} />
      ))}
    </div>
  )
}
