import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { forceInvalidateViewQueries } from './queries'

const THRESHOLD = 80 // px to pull before triggering refresh
const MAX_PULL = 120 // cap the visual pull distance

export function usePullToRefresh(containerRef: RefObject<HTMLElement | null>) {
  const queryClient = useQueryClient()
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef<number | null>(null)
  const isPulling = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onTouchStart(e: TouchEvent) {
      // Only start pull tracking when scrolled to top
      if (el!.scrollTop > 0 || isRefreshing) return
      touchStartY.current = e.touches[0].clientY
      isPulling.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (touchStartY.current === null || isRefreshing) return
      const dy = e.touches[0].clientY - touchStartY.current
      if (dy <= 0) {
        // Scrolling up — cancel pull
        if (isPulling.current) {
          isPulling.current = false
          setPullDistance(0)
        }
        return
      }
      // Only activate after a small initial threshold to avoid false triggers
      if (!isPulling.current && dy > 10) {
        isPulling.current = true
      }
      if (isPulling.current) {
        // Dampen the pull (diminishing returns past threshold)
        const distance = Math.min(MAX_PULL, dy * 0.5)
        setPullDistance(distance)
        if (el!.scrollTop === 0) {
          e.preventDefault()
        }
      }
    }

    function onTouchEnd() {
      if (touchStartY.current === null) return
      if (pullDistance >= THRESHOLD && !isRefreshing) {
        setIsRefreshing(true)
        forceInvalidateViewQueries(queryClient, { refetchType: 'all' })
        // Also refresh projects/areas
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        queryClient.invalidateQueries({ queryKey: ['areas'] })
        setTimeout(() => {
          setIsRefreshing(false)
          setPullDistance(0)
        }, 800)
      } else {
        setPullDistance(0)
      }
      touchStartY.current = null
      isPulling.current = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef, queryClient, pullDistance, isRefreshing])

  return { pullDistance, isRefreshing }
}
