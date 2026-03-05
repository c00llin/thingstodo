import { useRef, useCallback, useState } from 'react'

const SWIPE_THRESHOLD = 50
const LOCK_THRESHOLD = 10

/**
 * Horizontal swipe detection with real-time slide animation.
 * The element follows your finger and snaps back on release.
 * Fires callback if swipe exceeds threshold.
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
  const lastDx = useRef(0)
  const locked = useRef<'horizontal' | 'vertical' | null>(null)
  const active = useRef(false)
  const [offsetX, setOffsetX] = useState(0)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    startX.current = e.clientX
    startY.current = e.clientY
    lastDx.current = 0
    locked.current = null
    active.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !active.current) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current

    if (locked.current === null) {
      if (Math.abs(dx) >= LOCK_THRESHOLD || Math.abs(dy) >= LOCK_THRESHOLD) {
        locked.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
        if (locked.current === 'vertical') {
          active.current = false
          return
        }
      } else {
        return
      }
    }

    if (locked.current === 'vertical') return

    lastDx.current = dx
    setOffsetX(dx * 0.6)
  }, [])

  const finish = useCallback(() => {
    const dx = lastDx.current
    setOffsetX(0)
    locked.current = null
    active.current = false

    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    if (dx < 0) {
      onSwipeLeft?.()
    } else {
      onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !active.current) return
    // Update lastDx with final position
    lastDx.current = e.clientX - startX.current
    finish()
  }, [finish])

  const onPointerCancel = useCallback(() => {
    if (!active.current) return
    // Use last tracked position to decide if swipe succeeded
    finish()
  }, [finish])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    offsetX,
    style: {
      touchAction: 'pan-y',
      transform: offsetX ? `translateX(${offsetX}px)` : undefined,
      transition: offsetX ? 'none' : 'transform 0.3s ease-out',
    } as React.CSSProperties,
  }
}
