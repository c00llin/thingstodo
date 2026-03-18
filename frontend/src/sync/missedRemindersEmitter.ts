import type { MissedReminder } from './reminders'

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
