import { api } from './client'
import type {
  InboxView,
  TodayView,
  UpcomingView,
  AnytimeView,
  SomedayView,
  LogbookView,
  TrashView,
  ViewCounts,
} from './types'

export function getInbox() {
  return api.get<InboxView>('/views/inbox')
}

export function getToday() {
  return api.get<TodayView>('/views/today')
}

export function getUpcoming(params?: { from?: string; days?: number }) {
  const search = new URLSearchParams()
  if (params?.from) search.set('from', params.from)
  if (params?.days) search.set('days', String(params.days))
  const qs = search.toString()
  return api.get<UpcomingView>(`/views/upcoming${qs ? `?${qs}` : ''}`)
}

export function getAnytime() {
  return api.get<AnytimeView>('/views/anytime')
}

export function getSomeday() {
  return api.get<SomedayView>('/views/someday')
}

export function getLogbook(params?: { limit?: number; offset?: number }) {
  const search = new URLSearchParams()
  if (params?.limit) search.set('limit', String(params.limit))
  if (params?.offset) search.set('offset', String(params.offset))
  const qs = search.toString()
  return api.get<LogbookView>(`/views/logbook${qs ? `?${qs}` : ''}`)
}

export function getTrash(params?: { limit?: number; offset?: number }) {
  const search = new URLSearchParams()
  if (params?.limit) search.set('limit', String(params.limit))
  if (params?.offset) search.set('offset', String(params.offset))
  const qs = search.toString()
  return api.get<TrashView>(`/views/trash${qs ? `?${qs}` : ''}`)
}

export function getCounts() {
  return api.get<ViewCounts>('/views/counts')
}
