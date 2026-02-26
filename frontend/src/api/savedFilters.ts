import { api } from './client'
import type { SavedFilter, CreateSavedFilterRequest } from './types'

export function listSavedFilters(view: string) {
  return api.get<{ saved_filters: SavedFilter[] }>(`/saved-filters?view=${encodeURIComponent(view)}`)
}

export function createSavedFilter(data: CreateSavedFilterRequest) {
  return api.post<SavedFilter>('/saved-filters', data)
}

export function deleteSavedFilter(id: string) {
  return api.delete<void>(`/saved-filters/${id}`)
}
