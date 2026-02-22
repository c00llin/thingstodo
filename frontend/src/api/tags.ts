import { api } from './client'
import type { Tag, Task, CreateTagRequest, UpdateTagRequest, SimpleReorderItem } from './types'

export function listTags() {
  return api.get<{ tags: Tag[] }>('/tags')
}

export function createTag(data: CreateTagRequest) {
  return api.post<Tag>('/tags', data)
}

export function updateTag(id: string, data: UpdateTagRequest) {
  return api.patch<Tag>(`/tags/${id}`, data)
}

export function deleteTag(id: string) {
  return api.delete<void>(`/tags/${id}`)
}

export function getTagTasks(id: string) {
  return api.get<{ tasks: Task[] }>(`/tags/${id}/tasks`)
}

export function reorderTags(items: SimpleReorderItem[]) {
  return api.patch<{ ok: boolean }>('/tags/reorder', { items })
}
