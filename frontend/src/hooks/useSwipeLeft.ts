import { useRef, useCallback } from 'react'

const SWIPE_THRESHOLD = 50

/**
 * Returns touch event handlers that detect horizontal swipes.
 * A minimum distance of 50px is required, and the swipe must be
 * more horizontal than vertical to avoid triggering during scrolling.
 */
export function useSwipeLeft(onSwipeLeft: () => void) {
  const handlers = useSwipe({ onSwipeLeft })
  return handlers
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
}: {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}) {
  const startX = useRef(0)
  const startY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = Math.abs(e.changedTouches[0].clientY - startY.current)
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < dy) return
    if (dx < 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight])

  return { onTouchStart, onTouchEnd }
}
