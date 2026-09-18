import * as React from "react"

interface SwipeOptions {
  threshold?: number
  onSwipeDown?: () => void
  onSwipeUp?: () => void
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

export function useSwipe(options: SwipeOptions = {}) {
  const {
    threshold = 50,
    onSwipeDown,
    onSwipeUp,
    onSwipeLeft,
    onSwipeRight,
  } = options

  const touchStart = React.useRef<{ x: number; y: number } | null>(null)

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (touch) {
        touchStart.current = {
          x: touch.clientX,
          y: touch.clientY,
        }
      }
    },
    []
  )

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return

      const touch = e.changedTouches[0]
      if (!touch) return

      const touchEnd = {
        x: touch.clientX,
        y: touch.clientY,
      }

      const deltaX = touchEnd.x - touchStart.current.x
      const deltaY = touchEnd.y - touchStart.current.y

      const absDeltaX = Math.abs(deltaX)
      const absDeltaY = Math.abs(deltaY)

      // Determine if it's a horizontal or vertical swipe
      if (Math.max(absDeltaX, absDeltaY) > threshold) {
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          if (deltaX > 0 && onSwipeRight) {
            onSwipeRight()
          } else if (deltaX < 0 && onSwipeLeft) {
            onSwipeLeft()
          }
        } else {
          // Vertical swipe
          if (deltaY > 0 && onSwipeDown) {
            onSwipeDown()
          } else if (deltaY < 0 && onSwipeUp) {
            onSwipeUp()
          }
        }
      }

      touchStart.current = null
    },
    [threshold, onSwipeDown, onSwipeUp, onSwipeLeft, onSwipeRight]
  )

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  }
}
