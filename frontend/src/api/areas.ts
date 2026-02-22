import { api } from './client'
import type { Area, AreaDetail, CreateAreaRequest, UpdateAreaRequest, SimpleReorderItem } from './types'

export function listAreas() {
  return api.get<{ areas: Area[] }>('/areas')
}

export function getArea(id: string) {
  return api.get<AreaDetail>(`/areas/${id}`)
}

export function createArea(data: CreateAreaRequest) {
  return api.post<Area>('/areas', data)
}

export function updateArea(id: string, data: UpdateAreaRequest) {
  return api.patch<Area>(`/areas/${id}`, data)
}

export function deleteArea(id: string) {
  return api.delete<void>(`/areas/${id}`)
}

export function reorderAreas(items: SimpleReorderItem[]) {
  return api.patch<{ ok: boolean }>('/areas/reorder', { items })
}
