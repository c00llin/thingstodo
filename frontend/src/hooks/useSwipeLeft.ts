import { useRef, useCallback } from 'react'

const SWIPE_THRESHOLD = 50

/**
 * Returns props (event handlers + style) for horizontal swipe detection.
 * Uses pointer capture so we receive pointerup even if the finger
 * moves outside the element. Sets touch-action: pan-y so the browser
 * handles vertical scrolling while we handle horizontal swipes.
 */
export function useSwipeLeft(onSwipeLeft: () => void) {
  return useSwipe({ onSwipeLeft })
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

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    startX.current = e.clientX
    startY.current = e.clientY
    // Capture so we get pointerup even if finger leaves element
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    const dx = e.clientX - startX.current
    const dy = Math.abs(e.clientY - startY.current)
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < dy) return
    if (dx < 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight])

  return {
    onPointerDown,
    onPointerUp,
    style: { touchAction: 'pan-y' } as React.CSSProperties,
  }
}
