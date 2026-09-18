// components/analytics/metric-cards-grid.tsx

import { MetricCard } from "./metric-card"
import { cn } from "@workspace/ui/lib/utils"
import type { MetricCardDef } from "@workspace/ui/types/components"

interface MetricCardsGridProps {
  cards: MetricCardDef[]
  columns?: 2 | 3 | 4 | 5
  className?: string
}

const COL_CLASSES: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
}

export function MetricCardsGrid({
  cards,
  columns = 4,
  className,
}: MetricCardsGridProps) {
  const colClass = COL_CLASSES[columns] ?? COL_CLASSES[4]

  return (
    <div className={cn("grid gap-4", colClass, className)}>
      {cards.map((card) => (
        <MetricCard key={card.id} {...card} />
      ))}
    </div>
  )
}
