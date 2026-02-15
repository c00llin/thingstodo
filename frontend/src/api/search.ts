import { api } from './client'
import type { SearchResponse } from './types'

export function search(query: string, limit?: number) {
  const search = new URLSearchParams({ q: query })
  if (limit) search.set('limit', String(limit))
  return api.get<SearchResponse>(`/search?${search.toString()}`)
}
