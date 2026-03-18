import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { MissedReminder } from '../sync/reminders'

// Simple event emitter for missed reminders — decouples sync engine from UI
type MissedRemindersListener = (reminders: MissedReminder[]) => void
const listeners = new Set<MissedRemindersListener>()

export function onMissedReminders(fn: MissedRemindersListener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitMissedReminders(reminders: MissedReminder[]): void {
  if (reminders.length === 0) return
  for (const fn of listeners) {
    fn(reminders)
  }
}

const MAX_VISIBLE = 5

export function MissedRemindersToast() {
  const navigate = useNavigate()
  const [items, setItems] = useState<MissedReminder[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const unsub = onMissedReminders((reminders) => {
      setItems((prev) => {
        // Deduplicate by reminderId
        const existingIds = new Set(prev.map((r) => r.reminderId))
        const newOnes = reminders.filter((r) => !existingIds.has(r.reminderId))
        return [...prev, ...newOnes]
      })
      setVisible(true)
    })
    return unsub
  }, [])

  if (!visible || items.length === 0) return null

  const shown = items.slice(0, MAX_VISIBLE)
  const overflow = items.length - MAX_VISIBLE

  function dismiss() {
    setVisible(false)
    setItems([])
  }

  function handleTaskClick(taskId: string) {
    dismiss()
    navigate(`/tasks/${taskId}`)
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-700">
        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {items.length === 1 ? 'Missed reminder' : `${items.length} missed reminders`}
        </span>
        <button
          onClick={dismiss}
          className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Task list */}
      <ul className="divide-y divide-neutral-100 dark:divide-neutral-700">
        {shown.map((r) => (
          <li key={r.reminderId}>
            <button
              onClick={() => handleTaskClick(r.taskId)}
              className="w-full px-4 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700/50"
            >
              <span className="block truncate font-medium">{r.taskTitle}</span>
              <span className="block truncate text-xs text-neutral-400 dark:text-neutral-500">
                {formatFiredAt(r.firedAt)}
              </span>
            </button>
          </li>
        ))}
        {overflow > 0 && (
          <li className="px-4 py-2 text-xs text-neutral-400 dark:text-neutral-500">
            +{overflow} more
          </li>
        )}
      </ul>
    </div>
  )
}

function formatFiredAt(firedAt: string): string {
  try {
    return new Date(firedAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return firedAt
  }
}
