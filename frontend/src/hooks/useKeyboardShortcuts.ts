import { useEffect, useRef, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { useCompleteTask, useDeleteTask, useUpdateTask } from './queries'

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
  const openCommandPalette = useAppStore((s) => s.openCommandPalette)
  const openSearch = useAppStore((s) => s.openSearch)
  const toggleFilterBar = useAppStore((s) => s.toggleFilterBar)

  // g + <key> navigation sequences
  useKeySequences({
    i: () => navigate('/inbox'),
    t: () => navigate('/today'),
    u: () => navigate('/upcoming'),
    a: () => navigate('/anytime'),
    s: () => navigate('/someday'),
    c: () => navigate('/logbook'),
    r: () => navigate('/trash'),
    n: () => openCommandPalette(),
    f: () => openSearch(),
    x: () => toggleFilterBar(),
  })

  // New task (open quick entry empty)
  useHotkeys('q', (e) => {
    e.preventDefault()
    openQuickEntry()
  })

  // Clear all filters
  useHotkeys('alt+x', (e) => {
    e.preventDefault()
    useFilterStore.getState().clearAll()
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

/** Returns true when focus is inside the filter bar or one of its portaled dropdowns. */
function isFocusInFilterBar(): boolean {
  return document.activeElement?.closest('[data-filter-bar]') !== null
}

function getVisibleTaskIds(): string[] {
  const nodes = document.querySelectorAll<HTMLElement>('[data-task-id]:not([data-departing="true"])')
  return Array.from(nodes).map((el) => el.dataset.taskId!)
}

function scrollToTask(taskId: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

export function useTaskShortcuts() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectTask = useAppStore((s) => s.selectTask)
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandTask = useAppStore((s) => s.expandTask)
  const startEditingTask = useAppStore((s) => s.startEditingTask)
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

  const enabled = !!selectedTaskId

  // Space toggles detail panel (keep task selected when closing)
  useHotkeys('space', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (selectedTaskId) {
      if (expandedTaskId === selectedTaskId) {
        useAppStore.setState({ expandedTaskId: null })
      } else {
        expandTask(selectedTaskId)
      }
    }
  }, { enabled })

  // Enter edits title
  useHotkeys('enter', (e) => {
    if (isFocusInFilterBar()) return
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
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (expandedTaskId) {
      expandTask(null)
    } else if (selectedTaskId) {
      selectTask(null)
    }
  }, { enabled: !!expandedTaskId || !!selectedTaskId })

  // Arrow down — select next task (wraps around)
  useHotkeys('down', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    const ids = getVisibleTaskIds()
    if (ids.length === 0) return
    if (!selectedTaskId) {
      selectTask(ids[0])
      scrollToTask(ids[0])
      return
    }
    const idx = ids.indexOf(selectedTaskId)
    const nextId = ids[(idx + 1) % ids.length]
    selectTask(nextId)
    scrollToTask(nextId)
  }, { enabled: true })

  // Arrow up — select previous task (wraps around)
  useHotkeys('up', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    const ids = getVisibleTaskIds()
    if (ids.length === 0) return
    if (!selectedTaskId) {
      selectTask(ids[ids.length - 1])
      scrollToTask(ids[ids.length - 1])
      return
    }
    const idx = ids.indexOf(selectedTaskId)
    const prevId = ids[(idx - 1 + ids.length) % ids.length]
    selectTask(prevId)
    scrollToTask(prevId)
  }, { enabled: true })

  // Complete task
  useHotkeys('alt+k', (e) => {
    e.preventDefault()
    if (selectedTaskId) completeTask.mutate(selectedTaskId)
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
  useHotkeys('alt+s', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      updateTask.mutate({ id: selectedTaskId, data: { when_date: 'someday' } })
    }
  }, { enabled })

  // Delete task
  useHotkeys('delete', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId)
      selectTask(null)
    }
  }, { enabled })

  useHotkeys('backspace', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId)
      selectTask(null)
    }
  }, { enabled })
}
