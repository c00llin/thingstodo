import { api } from './client'
import type { UserSettings } from './types'

export function getSettings() {
  return api.get<UserSettings>('/user/settings')
}

export function updateSettings(data: Partial<UserSettings>) {
  return api.patch<UserSettings>('/user/settings', data)
}
