// lib/page-shell/refresh-banner.tsx

import { Loader2 } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

export function RefreshBanner({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex items-center justify-center gap-2 bg-background/90 backdrop-blur-sm",
        "border-b border-border text-xs text-muted-foreground",
        "overflow-hidden transition-all duration-200 ease-in-out",
        visible ? "py-2 opacity-100" : "max-h-0 py-0 opacity-0"
      )}
      aria-live="polite"
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Refreshing…
    </div>
  )
}
