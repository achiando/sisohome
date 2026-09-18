import { Badge } from "../badge"
import { RelatedItem } from "@workspace/ui/types/components"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronRight } from "lucide-react"

interface RelatedListProps {
  items: RelatedItem[]
  emptyMessage?: string
  className?: string
}

export function RelatedList({
  items,
  emptyMessage = "No related items.",
  className,
}: RelatedListProps) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    )
  }

  return (
    <div className={cn("divide-y divide-border/50", className)}>
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "flex items-center gap-3 px-1 py-2.5",
            item.onClick &&
              "cursor-pointer rounded-md px-2 transition-colors hover:bg-muted/50"
          )}
          onClick={item.onClick}
          role={item.onClick ? "button" : undefined}
          tabIndex={item.onClick ? 0 : undefined}
        >
          {item.icon && (
            <span className="shrink-0 text-muted-foreground">{item.icon}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {item.title}
            </p>
            {item.subtitle && (
              <p className="truncate text-xs text-muted-foreground">
                {item.subtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {item.meta && (
              <span className="text-xs text-muted-foreground">{item.meta}</span>
            )}
            {item.badge && (
              <Badge
                variant={item.badge.variant ?? "neutral"}
                className="text-xs"
              >
                {item.badge.label}
              </Badge>
            )}
            {item.onClick && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
