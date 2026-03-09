import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys, invalidateViewQueries } from './queries'
import { useAppStore } from '../stores/app'

function dismissToast(toast: HTMLElement) {
  toast.style.animation = 'toast-out 0.2s ease-in forwards'
  setTimeout(() => toast.remove(), 200)
}

function showReminderToast(title: string, description: string, taskId?: string) {
  const container = document.getElementById('reminder-toast-container') ?? createToastContainer()
  const toast = document.createElement('div')
  toast.className = 'flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-800 cursor-pointer'
  toast.style.cssText = 'animation: toast-in 0.2s ease-out; max-width: 360px; width: 100%;'
  toast.innerHTML = `
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">${escapeHtml(title)}</div>
      ${description ? `<div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">${escapeHtml(description)}</div>` : ''}
    </div>
    <button class="shrink-0 mt-0.5 p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" aria-label="Dismiss">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    </button>
  `
  const closeBtn = toast.querySelector('button')!
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dismissToast(toast)
  })
  if (taskId) {
    toast.addEventListener('click', () => {
      useAppStore.getState().expandTask(taskId)
      dismissToast(toast)
    })
  }
  container.appendChild(toast)
}

function createToastContainer(): HTMLElement {
  const el = document.createElement('div')
  el.id = 'reminder-toast-container'
  el.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 items-end'
  document.body.appendChild(el)
  // Inject animation keyframes once
  if (!document.getElementById('toast-keyframes')) {
    const style = document.createElement('style')
    style.id = 'toast-keyframes'
    style.textContent = `
      @keyframes toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-8px); } }
    `
    document.head.appendChild(style)
  }
  return el
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

type SSEEventType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'project_updated'
  | 'area_updated'
  | 'tag_updated'
  | 'bulk_change'
  | 'saved_filter_changed'
  | 'reminder_fired'

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
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            invalidateViewQueries(queryClient, refetch)
            break

          case 'task_updated':
            if (payload.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.tasks.detail(payload.id),
                ...refetch,
              })
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            invalidateViewQueries(queryClient, refetch)
            break

          case 'task_deleted':
            if (payload.id) {
              queryClient.removeQueries({
                queryKey: queryKeys.tasks.detail(payload.id),
              })
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            invalidateViewQueries(queryClient, refetch)
            break

          case 'project_updated':
            if (payload.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.projects.detail(payload.id),
                ...refetch,
              })
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            invalidateViewQueries(queryClient, refetch)
            break

          case 'area_updated':
            if (payload.id) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.areas.detail(payload.id),
                ...refetch,
              })
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            invalidateViewQueries(queryClient, refetch)
            break

          case 'tag_updated':
            invalidateViewQueries(queryClient, refetch)
            break

          case 'bulk_change':
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.areas.all, ...refetch })
            queryClient.invalidateQueries({ queryKey: queryKeys.tags.all, ...refetch })
            invalidateViewQueries(queryClient, refetch)
            break

          case 'saved_filter_changed': {
            const view = (payload as { view?: string }).view
            if (view) {
              queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(view), ...refetch })
            }
            break
          }

          case 'reminder_fired': {
            const p = payload as { task_id?: string; task_title?: string; description?: string }
            if (p.task_title) {
              showReminderToast(p.task_title, p.description ?? '', p.task_id)
            }
            break
          }
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
        'saved_filter_changed',
        'reminder_fired',
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
