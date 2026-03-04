import { useEffect, useRef, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { hasFilters } from '../lib/filter-tasks'
import { useCompleteTask, useDeleteTask, useUpdateTask, findTaskInViewCache } from './queries'

const VIEW_ROUTES = ['/inbox', '/today', '/upcoming', '/anytime', '/someday', '/logbook']

/** Timeout in ms for the second key in a sequence (g + key). */
const SEQUENCE_TIMEOUT = 500

/**
 * Hook for "g + <key>" navigation sequences.
 * If 'g' was pressed recently, the next key is matched against the map.
 */
function useKeySequences(sequences: Record<string, () => void>) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingRef = useRef(false)

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
        pendingRef.current = false
        return
      }

      if (pendingRef.current) {
        pendingRef.current = false
        clearTimeout(timerRef.current)
        const action = sequences[e.key]
        if (action) {
          e.preventDefault()
          action()
        }
        return
      }

      if (e.key === 'g') {
        pendingRef.current = true
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          pendingRef.current = false
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

  // Clear all filters — if already clear, close the filter bar
  useHotkeys('alt+x', (e) => {
    e.preventDefault()
    const filters = useFilterStore.getState()
    if (hasFilters(filters)) {
      filters.clearAll()
    } else {
      useAppStore.setState({ filterBarOpen: false })
    }
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

interface VisibleTask {
  taskId: string
  scheduleEntryId: string | null
}

function getVisibleTasks(): VisibleTask[] {
  const nodes = document.querySelectorAll<HTMLElement>('[data-task-id]:not([data-departing="true"])')
  return Array.from(nodes).map((el) => ({
    taskId: el.dataset.taskId!,
    scheduleEntryId: el.dataset.scheduleEntryId ?? null,
  }))
}

function scrollToTask(taskId: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

export function useTaskShortcuts() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectedScheduleEntryId = useAppStore((s) => s.selectedScheduleEntryId)
  const selectTask = useAppStore((s) => s.selectTask)
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandTask = useAppStore((s) => s.expandTask)
  const closeModal = useAppStore((s) => s.closeModal)
  const startEditingTask = useAppStore((s) => s.startEditingTask)
  const setPendingCompleteConfirmId = useAppStore((s) => s.setPendingCompleteConfirmId)
  const queryClient = useQueryClient()
  const completeTask = useCompleteTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

  const enabled = !!selectedTaskId

  // Space opens/closes modal for selected task
  useHotkeys('space', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (selectedTaskId) {
      if (expandedTaskId === selectedTaskId) {
        closeModal()
      } else {
        expandTask(selectedTaskId, selectedScheduleEntryId)
      }
    }
  }, { enabled })

  // Enter opens modal + focuses title for editing
  useHotkeys('enter', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (selectedTaskId) {
      expandTask(selectedTaskId, selectedScheduleEntryId)
      startEditingTask(selectedTaskId)
    }
  }, { enabled })

  // Cmd+Enter opens modal
  useHotkeys('meta+enter', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      expandTask(selectedTaskId, selectedScheduleEntryId)
    }
  }, { enabled })

  // Escape closes modal; if no modal, deselects
  useHotkeys('escape', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (expandedTaskId) {
      closeModal()
    } else if (selectedTaskId) {
      selectTask(null)
    }
  }, { enabled: !!expandedTaskId || !!selectedTaskId })

  // Arrow down — select next task (wraps around); if modal open, switch modal task
  useHotkeys('down', (e) => {
    if (isFocusInFilterBar()) return
    const tag = (document.activeElement as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    const tasks = getVisibleTasks()
    if (tasks.length === 0) return
    if (!selectedTaskId) {
      selectTask(tasks[0].taskId, tasks[0].scheduleEntryId)
      scrollToTask(tasks[0].taskId)
      return
    }
    const idx = tasks.findIndex((t) => t.taskId === selectedTaskId && t.scheduleEntryId === selectedScheduleEntryId)
    const next = tasks[((idx === -1 ? 0 : idx) + 1) % tasks.length]
    selectTask(next.taskId, next.scheduleEntryId)
    scrollToTask(next.taskId)
    // If modal is open, navigate modal to new task
    if (expandedTaskId) {
      expandTask(next.taskId, next.scheduleEntryId)
    }
  }, { enabled: true })

  // Arrow up — select previous task (wraps around); if modal open, switch modal task
  useHotkeys('up', (e) => {
    if (isFocusInFilterBar()) return
    const tag = (document.activeElement as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    const tasks = getVisibleTasks()
    if (tasks.length === 0) return
    if (!selectedTaskId) {
      const last = tasks[tasks.length - 1]
      selectTask(last.taskId, last.scheduleEntryId)
      scrollToTask(last.taskId)
      return
    }
    const idx = tasks.findIndex((t) => t.taskId === selectedTaskId && t.scheduleEntryId === selectedScheduleEntryId)
    const prev = tasks[((idx === -1 ? tasks.length - 1 : idx) - 1 + tasks.length) % tasks.length]
    selectTask(prev.taskId, prev.scheduleEntryId)
    scrollToTask(prev.taskId)
    // If modal is open, navigate modal to new task
    if (expandedTaskId) {
      expandTask(prev.taskId, prev.scheduleEntryId)
    }
  }, { enabled: true })

  // Complete task
  useHotkeys('alt+k', (e) => {
    e.preventDefault()
    if (selectedTaskId) {
      const cached = findTaskInViewCache(queryClient, selectedTaskId)
      if (cached?.has_actionable_schedules) {
        setPendingCompleteConfirmId(selectedTaskId)
      } else {
        completeTask.mutate(selectedTaskId)
      }
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
