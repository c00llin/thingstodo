import { useEffect, useRef, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate, useLocation } from 'react-router'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { hasFilters } from '../lib/filter-tasks'
import { useDeleteTask, useUpdateTask, useSavedFilters } from './queries'

/** Maps route pathname to the view name used for saved filters. */
const FILTERABLE_VIEWS: Record<string, string> = {
  '/today': 'today',
  '/upcoming': 'upcoming',
  '/anytime': 'anytime',
  '/someday': 'someday',
  '/logbook': 'logbook',
}

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

  // Alt+1 through Alt+6: toggle saved filters for the current view
  const { pathname } = useLocation()
  const currentViewName = FILTERABLE_VIEWS[pathname] ?? null
  const { data: savedFiltersData } = useSavedFilters(currentViewName ?? '')

  useHotkeys('alt+1,alt+2,alt+3,alt+4,alt+5,alt+6', (e) => {
    if (!currentViewName) return
    const filters = savedFiltersData?.saved_filters ?? []
    // On macOS, Alt+number produces special chars (e.g. ¡™£), so use e.code
    const match = e.code.match(/^Digit(\d)$/)
    if (!match) return
    const idx = parseInt(match[1], 10) - 1
    if (idx < 0 || idx >= filters.length) return
    e.preventDefault()
    const sf = filters[idx]
    const { activeFilterId, clearAll, applyFilterConfig } = useFilterStore.getState()
    if (sf.id === activeFilterId) {
      clearAll()
    } else {
      const config = JSON.parse(sf.config)
      applyFilterConfig(config, sf.id)
    }
  }, { enabled: !!currentViewName })

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
  const deleteTask = useDeleteTask()
  const hasMultiSelection = useAppStore((s) => s.selectedTaskIds.size > 0)

  const enabled = !!selectedTaskId

  // Space opens/closes modal for selected task
  useHotkeys('space', (e) => {
    if (isFocusInFilterBar()) return
    if (useAppStore.getState().selectedTaskIds.size > 1) return
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
    if (useAppStore.getState().selectedTaskIds.size > 1) return
    e.preventDefault()
    if (selectedTaskId) {
      expandTask(selectedTaskId, selectedScheduleEntryId)
      startEditingTask(selectedTaskId)
    }
  }, { enabled })

  // Alt+key shortcuts for detail fields — when a task is selected but modal is not open,
  // open the modal and activate the relevant field. Alt+H toggles priority inline.
  const inlineEnabled = enabled && !expandedTaskId && !hasMultiSelection
  const setDetailFocusField = useAppStore((s) => s.setDetailFocusField)
  const updateTask = useUpdateTask()

  function openAndFocus(field: Parameters<typeof setDetailFocusField>[0]) {
    if (!selectedTaskId) return
    expandTask(selectedTaskId, selectedScheduleEntryId)
    setDetailFocusField(field)
  }

  useHotkeys('alt+e', (e) => { e.preventDefault(); openAndFocus('title') }, { enabled: inlineEnabled })
  useHotkeys('alt+a', (e) => { e.preventDefault(); openAndFocus('area') }, { enabled: inlineEnabled })
  useHotkeys('alt+t', (e) => { e.preventDefault(); openAndFocus('tags') }, { enabled: inlineEnabled })
  useHotkeys('alt+w', (e) => { e.preventDefault(); openAndFocus('when') }, { enabled: inlineEnabled })
  useHotkeys('alt+d', (e) => { e.preventDefault(); openAndFocus('deadline') }, { enabled: inlineEnabled })
  useHotkeys('alt+n', (e) => { e.preventDefault(); openAndFocus('notes') }, { enabled: inlineEnabled })
  useHotkeys('alt+c', (e) => { e.preventDefault(); openAndFocus('checklist') }, { enabled: inlineEnabled })
  useHotkeys('alt+r', (e) => { e.preventDefault(); openAndFocus('reminder') }, { enabled: inlineEnabled })
  useHotkeys('alt+u', (e) => { e.preventDefault(); openAndFocus('link') }, { enabled: inlineEnabled })
  useHotkeys('alt+f', (e) => { e.preventDefault(); openAndFocus('file') }, { enabled: inlineEnabled })
  useHotkeys('alt+h', (e) => {
    e.preventDefault()
    if (!selectedTaskId) return
    import('../db/index').then(({ localDb }) => {
      localDb.tasks.get(selectedTaskId).then((task) => {
        if (task) {
          updateTask.mutate({ id: selectedTaskId, data: { high_priority: !task.high_priority } })
        }
      })
    })
  }, { enabled: inlineEnabled })

  // Escape closes modal; if multi-selected, clears selection first; if no modal, deselects
  useHotkeys('escape', (e) => {
    if (isFocusInFilterBar()) return
    // If a component already handled this Escape (e.g. closing a dropdown), don't also clear selection
    if (e.defaultPrevented) return
    e.preventDefault()
    const { selectedTaskIds, clearSelection } = useAppStore.getState()
    if (selectedTaskIds.size > 0) {
      clearSelection()
      return
    }
    if (expandedTaskId) {
      closeModal()
    } else if (selectedTaskId) {
      selectTask(null)
    }
  }, { enabled: !!expandedTaskId || !!selectedTaskId || hasMultiSelection })

  // Cmd+A selects all visible tasks in the current section (unless focused in input/textarea)
  useHotkeys('mod+a', (e) => {
    const active = document.activeElement
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) {
      return
    }
    e.preventDefault()
    const { selectionSection, selectedTaskId } = useAppStore.getState()
    let section = selectionSection
    if (!section && selectedTaskId) {
      const el = document.querySelector<HTMLElement>(`[data-task-id="${selectedTaskId}"]`)
      section = el?.dataset.taskSection ?? null
    }
    // If no section can be inferred, default to the section of the first visible task
    if (!section) {
      const firstEl = document.querySelector<HTMLElement>('[data-task-id][data-task-section]')
      section = firstEl?.dataset.taskSection ?? null
    }
    const selector = section
      ? `[data-task-section="${section}"][data-task-id]`
      : '[data-task-id]'
    const allTaskEls = document.querySelectorAll<HTMLElement>(selector)
    const ids = new Set<string>()
    allTaskEls.forEach((el) => {
      if (el.dataset.taskId) ids.add(el.dataset.taskId)
    })
    useAppStore.setState({ selectedTaskIds: ids, lastSelectedTaskId: null, selectionSection: section })
  })

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

  // Delete task (or bulk delete if multi-selected)
  const handleBulkDelete = useCallback(() => {
    const { selectedTaskIds } = useAppStore.getState()
    if (selectedTaskIds.size > 1) {
      useAppStore.setState({ departingTaskIds: new Set(selectedTaskIds) })
      import('../api/tasks').then(({ bulkAction }) => {
        bulkAction({ task_ids: Array.from(selectedTaskIds), action: 'delete' }).then(() => {
          const remaining = new Set(useAppStore.getState().selectedTaskIds)
          for (const id of selectedTaskIds) remaining.delete(id)
          useAppStore.setState({ selectedTaskIds: remaining })
          setTimeout(() => {
            useAppStore.setState({ departingTaskIds: new Set() })
            // Force invalidation will be handled by SSE or next interaction
            window.dispatchEvent(new Event('bulk-action-complete'))
          }, 800)
        })
      })
      return true
    }
    return false
  }, [])

  useHotkeys('delete', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (handleBulkDelete()) return
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId)
      selectTask(null)
    }
  }, { enabled: enabled || hasMultiSelection })

  useHotkeys('backspace', (e) => {
    if (isFocusInFilterBar()) return
    e.preventDefault()
    if (handleBulkDelete()) return
    if (selectedTaskId) {
      deleteTask.mutate(selectedTaskId)
      selectTask(null)
    }
  }, { enabled: enabled || hasMultiSelection })
}
