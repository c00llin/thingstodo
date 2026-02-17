import { api } from './client'
import type {
  Task,
  TaskDetail,
  CreateTaskRequest,
  UpdateTaskRequest,
  ReorderItem,
  TaskQueryParams,
} from './types'

export function listTasks(params?: TaskQueryParams) {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        search.set(key, String(value))
      }
    }
  }
  const qs = search.toString()
  return api.get<{ tasks: Task[] }>(`/tasks${qs ? `?${qs}` : ''}`)
}

export function getTask(id: string) {
  return api.get<TaskDetail>(`/tasks/${id}`)
}

export function createTask(data: CreateTaskRequest) {
  return api.post<Task>('/tasks', data)
}

export function updateTask(id: string, data: UpdateTaskRequest) {
  return api.patch<TaskDetail>(`/tasks/${id}`, data)
}

export function deleteTask(id: string) {
  return api.delete<void>(`/tasks/${id}`)
}

export function completeTask(id: string) {
  return api.patch<Task>(`/tasks/${id}/complete`, {})
}

export function cancelTask(id: string) {
  return api.patch<Task>(`/tasks/${id}/cancel`, {})
}

export function wontDoTask(id: string) {
  return api.patch<Task>(`/tasks/${id}/wontdo`, {})
}

export function reopenTask(id: string) {
  return api.patch<Task>(`/tasks/${id}/reopen`, {})
}

export function restoreTask(id: string) {
  return api.patch<Task>(`/tasks/${id}/restore`, {})
}

export function reorderTasks(items: ReorderItem[]) {
  return api.patch<{ ok: boolean }>('/tasks/reorder', { items })
}
