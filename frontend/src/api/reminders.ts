import { api } from './client'
import type { Reminder, CreateReminderRequest } from './types'

export function listReminders(taskId: string) {
  return api.get<{ items: Reminder[] }>(`/tasks/${taskId}/reminders`)
}

export function createReminder(taskId: string, data: CreateReminderRequest) {
  return api.post<Reminder>(`/tasks/${taskId}/reminders`, data)
}

export function deleteReminder(id: string) {
  return api.delete<void>(`/reminders/${id}`)
}
