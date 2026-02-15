import { api } from './client'
import type {
  ChecklistItem,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
} from './types'

export function listChecklist(taskId: string) {
  return api.get<{ items: ChecklistItem[] }>(`/tasks/${taskId}/checklist`)
}

export function createChecklistItem(taskId: string, data: CreateChecklistItemRequest) {
  return api.post<ChecklistItem>(`/tasks/${taskId}/checklist`, data)
}

export function updateChecklistItem(id: string, data: UpdateChecklistItemRequest) {
  return api.patch<ChecklistItem>(`/checklist/${id}`, data)
}

export function deleteChecklistItem(id: string) {
  return api.delete<void>(`/checklist/${id}`)
}
