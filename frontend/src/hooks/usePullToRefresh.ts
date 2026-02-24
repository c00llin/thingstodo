import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
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
  const pullDistanceRef = useRef(0)
  const isRefreshingRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { pullDistanceRef.current = pullDistance }, [pullDistance])
  useEffect(() => { isRefreshingRef.current = isRefreshing }, [isRefreshing])

  const doRefresh = useCallback(() => {
    setIsRefreshing(true)
    isRefreshingRef.current = true
    forceInvalidateViewQueries(queryClient, { refetchType: 'all' })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    queryClient.invalidateQueries({ queryKey: ['areas'] })
    setTimeout(() => {
      setIsRefreshing(false)
      isRefreshingRef.current = false
      setPullDistance(0)
      pullDistanceRef.current = 0
    }, 800)
  }, [queryClient])

  useEffect(() => {
    function getScrollTop() {
      return containerRef.current?.scrollTop ?? 0
    }

    function onTouchStart(e: TouchEvent) {
      if (getScrollTop() > 1 || isRefreshingRef.current) return
      touchStartY.current = e.touches[0].clientY
      isPulling.current = false
    }

    function onTouchMove(e: TouchEvent) {
      if (touchStartY.current === null || isRefreshingRef.current) return
      const dy = e.touches[0].clientY - touchStartY.current
      if (dy <= 0) {
        if (isPulling.current) {
          isPulling.current = false
          setPullDistance(0)
          pullDistanceRef.current = 0
        }
        return
      }
      if (!isPulling.current && dy > 10) {
        isPulling.current = true
      }
      if (isPulling.current) {
        e.preventDefault()
        const distance = Math.min(MAX_PULL, dy * 0.5)
        setPullDistance(distance)
        pullDistanceRef.current = distance
      }
    }

    function onTouchEnd() {
      if (touchStartY.current === null) return
      if (pullDistanceRef.current >= THRESHOLD && !isRefreshingRef.current) {
        doRefresh()
      } else {
        setPullDistance(0)
        pullDistanceRef.current = 0
      }
      touchStartY.current = null
      isPulling.current = false
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [containerRef, doRefresh])

  return { pullDistance, isRefreshing }
}
