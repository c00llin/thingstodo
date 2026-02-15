import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router'
import { useAppStore } from '../stores/app'
import { useCompleteTask, useCancelTask, useDeleteTask, useUpdateTask } from './queries'

const VIEW_ROUTES = ['/inbox', '/today', '/upcoming', '/anytime', '/someday', '/logbook']

export function useGlobalShortcuts() {
  const navigate = useNavigate()
  const openQuickEntry = useAppStore((s) => s.openQuickEntry)
  const toggleShortcutsHelp = useAppStore((s) => s.toggleShortcutsHelp)

  // Quick entry
  useHotkeys('ctrl+space', (e) => {
    e.preventDefault()
    openQuickEntry()
  }, { enableOnFormTags: true })

  // New task (focus the input in current view)
  useHotkeys('alt+n', (e) => {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('[data-new-task-input]')
    input?.focus()
  })

  // Focus search
  useHotkeys('alt+f', (e) => {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('[data-search-input]')
    input?.focus()
  })

  // Navigate to views Alt+1 through Alt+6
  for (let i = 0; i < VIEW_ROUTES.length; i++) {
    useHotkeys(`alt+${i + 1}`, (e) => {
      e.preventDefault()
      navigate(VIEW_ROUTES[i])
    })
  }

  // Help overlay
  useHotkeys('shift+/', () => {
    toggleShortcutsHelp()
  })
}

export function useTaskShortcuts() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectTask = useAppStore((s) => s.selectTask)
  const completeTask = useCompleteTask()
  const cancelTask = useCancelTask()
  const deleteTask = useDeleteTask()
  const updateTask = useUpdateTask()

  const enabled = !!selectedTaskId

  // Toggle detail
  useHotkeys('enter', (e) => {
    e.preventDefault()
    // Toggle is handled by clicking - Enter opens/closes
    if (selectedTaskId) {
      selectTask(null)
    }
  }, { enabled })

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
      updateTask.mutate({ id: selectedTaskId, data: { when_date: null } })
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
