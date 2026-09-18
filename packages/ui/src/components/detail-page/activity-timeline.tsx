import { Avatar, AvatarFallback } from "../avatar"
import { Badge } from "../badge"
import { ActivityEvent } from "@workspace/ui/types/components/"
import { cn } from "@workspace/ui/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { MessageSquare, RefreshCw, Calendar, StickyNote } from "lucide-react"

interface ActivityTimelineProps {
  events: ActivityEvent[]
  className?: string
}

const typeIconMap = {
  message: MessageSquare,
  event: Calendar,
  update: RefreshCw,
  note: StickyNote,
}

export function ActivityTimeline({ events, className }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No activity yet.
      </div>
    )
  }

  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, i) => {
        const isLast = i === events.length - 1
        const Icon = event.icon
          ? null
          : (typeIconMap[event.type ?? "update"] ?? RefreshCw)

        const initials = event.actor
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)

        const timestamp =
          typeof event.timestamp === "string"
            ? event.timestamp
            : formatDistanceToNow(event.timestamp, { addSuffix: true })

        const getEventBadgeVariant = (type: string) => {
          switch (type) {
            case "message":
              return "info"
            case "event":
              return "success"
            case "update":
              return "warning"
            case "note":
              return "neutral"
            default:
              return "neutral"
          }
        }

        return (
          <div key={event.id} className="flex gap-3">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <Avatar size="sm" className="shrink-0">
                <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {!isLast && (
                <div className="mt-1 mb-1 min-h-[16px] w-px flex-1 bg-border/50" />
              )}
            </div>

            {/* Content */}
            <div className={cn("min-w-0 flex-1 pb-4", isLast && "pb-0")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {event.actor}
                </span>
                <Badge
                  variant={getEventBadgeVariant(event.type ?? "update")}
                  size="sm"
                >
                  {event.type ?? "update"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {event.action}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {timestamp}
                </span>
              </div>
              {event.detail && (
                <div className="mt-2">
                  <Badge variant="outline" className="px-3 py-2 text-xs">
                    {event.detail}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
