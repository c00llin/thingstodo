import { api } from './client'
import type {
  TaskSchedule,
  CreateTaskScheduleRequest,
  UpdateTaskScheduleRequest,
  SimpleReorderItem,
} from './types'

export function listSchedules(taskId: string) {
  return api.get<{ items: TaskSchedule[] }>(`/tasks/${taskId}/schedules`)
}

export function createSchedule(taskId: string, data: CreateTaskScheduleRequest) {
  return api.post<TaskSchedule>(`/tasks/${taskId}/schedules`, data)
}

export function updateSchedule(id: string, data: UpdateTaskScheduleRequest) {
  return api.patch<TaskSchedule>(`/schedules/${id}`, data)
}

export function deleteSchedule(id: string) {
  return api.delete<void>(`/schedules/${id}`)
}

export function reorderSchedules(taskId: string, items: SimpleReorderItem[]) {
  return api.patch<void>(`/tasks/${taskId}/schedules/reorder`, items)
}
