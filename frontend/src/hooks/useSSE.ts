import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queries'

type SSEEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'project_updated'
  | 'area_updated'
  | 'tag_updated'
  | 'bulk_change'

interface SSEPayload {
  id?: string
  type?: string
}

export function useSSE() {
  const queryClient = useQueryClient()
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    function connect() {
      const source = new EventSource('/api/events')
      sourceRef.current = source

      // Force immediate refetch even if data isn't stale yet (staleTime is 30s)
      const refetch = { refetchType: 'all' as const }

      function handleEvent(type: SSEEventType, e: MessageEvent) {
        let payload: SSEPayload = {}
        try {
          payload = JSON.parse(e.data)
        } catch {
          // ignore malformed data
        }

        switch (type) {
          case 'task_created':
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, ...refetch })
            break

          case 'task_updated':
            if (payload.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.tasks.detail(payload.id),
                ...refetch,
              })
            }
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, ...refetch })
            break

          case 'task_deleted':
            if (payload.id) {
              queryClient.removeQueries({
                queryKey: queryKeys.tasks.detail(payload.id),
              })
            }
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, ...refetch })
            break

          case 'project_updated':
            if (payload.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.projects.detail(payload.id),
                ...refetch,
              })
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            break

          case 'area_updated':
            if (payload.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.areas.detail(payload.id),
                ...refetch,
              })
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            break

          case 'tag_updated':
            queryClient.invalidateQueries({ queryKey: queryKeys.tags.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            break

          case 'bulk_change':
            queryClient.invalidateQueries({ queryKey: ['views'], ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.tags.all, ...refetch })
            break
        }
      }

      const eventTypes: SSEEventType[] = [
        'task_created',
        'task_updated',
        'task_deleted',
        'project_updated',
        'area_updated',
        'tag_updated',
        'bulk_change',
      ]

      for (const type of eventTypes) {
        source.addEventListener(type, (e) => handleEvent(type, e as MessageEvent))
      }

      source.onerror = () => {
        // EventSource auto-reconnects on error
      }
    }

    connect()

    function handleVisibility() {
      if (document.hidden) {
        sourceRef.current?.close()
        sourceRef.current = null
      } else {
        if (!sourceRef.current) {
          connect()
          // Refetch stale data when returning to tab
          queryClient.invalidateQueries()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      sourceRef.current?.close()
      sourceRef.current = null
    }
  }, [queryClient])
}
