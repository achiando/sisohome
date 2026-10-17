'use client'

/**
 * Undo snackbar shown after a remove. Calls onUndo when the user clicks Undo,
 * and auto-dismisses after the timeout. Pure presentational.
 */

import { useEffect } from 'react'
import { Button } from '@workspace/ui/components/button'
import { Undo2 } from 'lucide-react'

export function UndoSnackbar({
  message,
  onUndo,
  onDismiss,
  timeoutMs = 8000,
}: {
  message: string
  onUndo: () => void
  onDismiss: () => void
  timeoutMs?: number
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, timeoutMs)
    return () => clearTimeout(t)
  }, [onDismiss, timeoutMs])

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
        <span className="text-sm">{message}</span>
        <Button
          variant="text"
          size="sm"
          className="h-9 gap-1.5 rounded-lg text-primary"
          onClick={onUndo}
        >
          <Undo2 className="size-4" />
          Undo
        </Button>
      </div>
    </div>
  )
}
