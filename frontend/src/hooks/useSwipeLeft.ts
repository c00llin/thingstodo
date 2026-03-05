import { useRef, useCallback, useState } from 'react'

const SWIPE_THRESHOLD = 50
const LOCK_THRESHOLD = 10 // px before we decide horizontal vs vertical

/**
 * Returns props (event handlers + style) for horizontal swipe detection
 * with real-time slide animation. The element slides with your finger
 * and snaps back or triggers the callback on release.
 *
 * Uses pointer capture and touch-action: pan-y so vertical scrolling
 * still works while we handle horizontal gestures.
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
  const locked = useRef<'horizontal' | 'vertical' | null>(null)
  const [offsetX, setOffsetX] = useState(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    startX.current = e.clientX
    startY.current = e.clientY
    locked.current = null
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    // Decide direction lock once we exceed threshold
    if (locked.current === null) {
      if (Math.abs(dx) >= LOCK_THRESHOLD || Math.abs(dy) >= LOCK_THRESHOLD) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      }
      return
    }

    if (locked.current === 'vertical') return

    // Apply resistance: diminish offset as it grows
    const resistance = 0.6
    setOffsetX(dx * resistance)
  }, [])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    const dx = e.clientX - startX.current
    const dy = Math.abs(e.clientY - startY.current)
    setOffsetX(0)
    locked.current = null

    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < dy) return
    if (dx < 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight])

  const onPointerCancel = useCallback(() => {
    setOffsetX(0)
    locked.current = null
  }, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    style: {
      touchAction: 'pan-y',
      transform: offsetX ? `translateX(${offsetX}px)` : undefined,
      transition: offsetX ? 'none' : 'transform 0.3s ease-out',
    } as React.CSSProperties,
  }
}
