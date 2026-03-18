import { localDb } from '../db/index'

// ChangeLogEntry shape from pull.ts (inline to avoid coupling)
interface ChangeLogEntry {
  entity: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  data: Record<string, unknown>
  serverSeq: number
}

export interface MissedReminder {
  reminderId: string
  taskId: string
  taskTitle: string
  firedAt: string
}

// Map of reminderId -> setTimeout handle for near-term scheduled reminders
const scheduledTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Check pulled changes for fired reminders that this device hasn't shown yet.
 * Returns an array of missed reminders to surface to the user.
 */
export async function checkMissedReminders(
  pulledChanges: ChangeLogEntry[],
): Promise<MissedReminder[]> {
  const firedChanges = pulledChanges.filter(
    (c) => c.entity === 'reminder' && (c.action as string) === 'fired',
  )
  if (firedChanges.length === 0) return []

  const missed: MissedReminder[] = []
  const now = new Date().toISOString()

  for (const change of firedChanges) {
    const reminderId = change.entityId

    // Already seen on this device?
    const existing = await localDb.seenReminders.get(reminderId)
    if (existing) continue

    const taskId = (change.data.task_id as string | undefined) ?? ''
    const firedAt = (change.data.fired_at as string | undefined) ?? now

    // Look up task title from local DB
    const task = taskId ? await localDb.tasks.get(taskId) : undefined
    const taskTitle = task?.title ?? 'Unknown Task'

    // Mark as seen
    await localDb.seenReminders.put({
      reminderId,
      taskId,
      firedAt,
      seenAt: now,
    })

    missed.push({ reminderId, taskId, taskTitle, firedAt })
  }

  return missed
}

/**
 * Schedule near-term exact reminders (due within 60 minutes) using setTimeout.
 * Fires a Notification API notification when the timer triggers.
 * Skips reminders already in seenReminders or already scheduled.
 */
export async function scheduleNearTermReminders(): Promise<void> {
  const allReminders = await localDb.reminders.toArray()
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 60 minutes

  for (const reminder of allReminders) {
    if (reminder.type !== 'exact' || !reminder.exact_at) continue

    const reminderId = reminder.id
    const fireTime = new Date(reminder.exact_at).getTime()
    const delay = fireTime - now

    // Only schedule if within window and in the future
    if (delay < 0 || delay > windowMs) continue

    // Already scheduled?
    if (scheduledTimers.has(reminderId)) continue

    // Already seen on this device?
    const seen = await localDb.seenReminders.get(reminderId)
    if (seen) continue

    const taskId = reminder.task_id
    const firedAt = reminder.exact_at

    const timer = setTimeout(async () => {
      scheduledTimers.delete(reminderId)

      // Check task is still open
      const task = taskId ? await localDb.tasks.get(taskId) : undefined
      if (!task || task.status !== 'open') return

      // Mark as seen
      const seenAt = new Date().toISOString()
      await localDb.seenReminders.put({
        reminderId,
        taskId,
        firedAt,
        seenAt,
      })

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(task.title, {
          body: 'Reminder',
          tag: reminderId,
        })
      }
    }, delay)

    scheduledTimers.set(reminderId, timer)
  }
}

/**
 * Clear all active near-term reminder timers (e.g. on logout or engine stop).
 */
export function clearScheduledReminders(): void {
  for (const timer of scheduledTimers.values()) {
    clearTimeout(timer)
  }
  scheduledTimers.clear()
}
