import { useEffect, useRef, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { useAppStore } from '../stores/app'
import { useCompleteTask, useCancelTask, useDeleteTask, useUpdateTask } from './queries'

const VIEW_ROUTES = ['/inbox', '/today', '/upcoming', '/anytime', '/someday', '/logbook']

/** Timeout in ms for the second key in a sequence (g + key). */
const SEQUENCE_TIMEOUT = 500

/** Whether a key sequence (g + …) is currently pending. */
let isSequencePending = false

/**
 * Hook for "g + <key>" navigation sequences.
 * If 'g' was pressed recently, the next key is matched against the map.
 */
function useKeySequences(sequences: Record<string, () => void>) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        isSequencePending = false
        return
      }

      if (isSequencePending) {
        isSequencePending = false
        clearTimeout(timerRef.current)
        const action = sequences[e.key]
        if (action) {
          e.preventDefault()
          action()
        }
        return
      }

      if (e.key === 'g') {
        isSequencePending = true
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          isSequencePending = false
        }, SEQUENCE_TIMEOUT)
      }
    },
    [sequences],
  )

  useEffect(() => {
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(timerRef.current)
    }
  }, [handler])
}

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const openQuickEntry = useAppStore((s) => s.openQuickEntry)
  const toggleShortcutsHelp = useAppStore((s) => s.toggleShortcutsHelp)

  // g + <key> navigation sequences
  useKeySequences({
    i: () => navigate('/inbox'),
    t: () => navigate('/today'),
    u: () => navigate('/upcoming'),
    a: () => navigate('/anytime'),
    s: () => navigate('/someday'),
    c: () => navigate('/logbook'),
  })

  // Quick entry
  useHotkeys('ctrl+space', (e) => {
    e.preventDefault()
    openQuickEntry()
  }, { enableOnFormTags: true })

  // New task (open quick entry empty)
  useHotkeys('q', (e) => {
    e.preventDefault()
    openQuickEntry()
  })

  // Focus search
  useHotkeys('alt+f', (e) => {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('[data-search-input]')
    input?.focus()
  })

  // Navigate to views Alt+1 through Alt+6
  useHotkeys(VIEW_ROUTES.map((_, i) => `alt+${i + 1}`).join(','), (e) => {
    e.preventDefault()
    const key = e.key
    const idx = parseInt(key, 10) - 1
    if (idx >= 0 && idx < VIEW_ROUTES.length) {
      navigate(VIEW_ROUTES[idx])
    }
  })

  // Help overlay — listen for '?' directly since shift+/ doesn't work on all layouts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) return
      if (e.key === '?') {
        e.preventDefault()
        toggleShortcutsHelp()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [toggleShortcutsHelp])
}

export function useTaskShortcuts() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectTask = useAppStore((s) => s.selectTask)
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandTask = useAppStore((s) => s.expandTask)
  const startEditingTask = useAppStore((s) => s.startEditingTask)
  const visibleTaskIds = useAppStore((s) => s.visibleTaskIds)
  const completeTask = useCompleteTask()
  const cancelTask = useCancelTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

  const enabled = !!selectedTaskId

  // Enter edits title
  useHotkeys('enter', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      startEditingTask(selectedTaskId)
    }
  }, { enabled })

  // Cmd+Enter opens detail
  useHotkeys('meta+enter', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      expandTask(selectedTaskId)
    }
  }, { enabled })

  // Escape closes detail and deselects
  useHotkeys('escape', (e) => {
    e.preventDefault()
    if (expandedTaskId) {
      expandTask(null)
    } else if (selectedTaskId) {
      selectTask(null)
    }
  }, { enabled: !!expandedTaskId || !!selectedTaskId })

  // Arrow down — select next task
  useHotkeys('down', (e) => {
    e.preventDefault()
    if (visibleTaskIds.length === 0) return
    if (!selectedTaskId) {
      selectTask(visibleTaskIds[0])
      return
    }
    const idx = visibleTaskIds.indexOf(selectedTaskId)
    if (idx < visibleTaskIds.length - 1) {
      selectTask(visibleTaskIds[idx + 1])
    }
  }, { enabled: visibleTaskIds.length > 0 })

  // Arrow up — select previous task
  useHotkeys('up', (e) => {
    e.preventDefault()
    if (visibleTaskIds.length === 0) return
    if (!selectedTaskId) {
      selectTask(visibleTaskIds[visibleTaskIds.length - 1])
      return
    }
    const idx = visibleTaskIds.indexOf(selectedTaskId)
    if (idx > 0) {
      selectTask(visibleTaskIds[idx - 1])
    }
  }, { enabled: visibleTaskIds.length > 0 })

  // Complete task
  useHotkeys('alt+k', (e) => {
    e.preventDefault()
    if (selectedTaskId) completeTask.mutate(selectedTaskId)
  }, { enabled })

  // Cancel task
  useHotkeys('alt+shift+k', (e) => {
    e.preventDefault()
    if (selectedTaskId) cancelTask.mutate(selectedTaskId)
  }, { enabled })

  // Move to Today
  useHotkeys('alt+t', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      const today = new Date().toISOString().split('T')[0]
      updateTask.mutate({ id: selectedTaskId, data: { when_date: today } })
    }
  }, { enabled })

  // Move to This Evening
  useHotkeys('alt+e', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      const today = new Date().toISOString().split('T')[0]
      updateTask.mutate({ id: selectedTaskId, data: { when_date: today, when_evening: true } })
    }
  }, { enabled })

  // Move to Someday
  useHotkeys('alt+shift+s', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      updateTask.mutate({ id: selectedTaskId, data: { when_date: 'someday' } })
    }
  }, { enabled })

  // Delete task
  useHotkeys('delete', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId)
      selectTask(null)
    }
  }, { enabled })

  useHotkeys('backspace', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId)
      selectTask(null)
    }
  }, { enabled })
}
