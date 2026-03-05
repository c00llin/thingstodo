import { useRef, useCallback } from 'react'

const SWIPE_THRESHOLD = 50

/**
 * Returns pointer event handlers that detect horizontal swipes.
 * A minimum distance of 50px is required, and the swipe must be
 * more horizontal than vertical to avoid triggering during scrolling.
 *
 * Uses pointer events (not touch events) to work alongside dnd-kit's
 * PointerSensor which can suppress touch events on sortable nodes.
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
  const tracking = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    startX.current = e.clientX
    startY.current = e.clientY
    tracking.current = true
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!tracking.current) return
    tracking.current = false
    const dx = e.clientX - startX.current
    const dy = Math.abs(e.clientY - startY.current)
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < dy) return
    if (dx < 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight])

  const onPointerCancel = useCallback(() => {
    tracking.current = false
  }, [])

  return { onPointerDown, onPointerUp, onPointerCancel }
}
