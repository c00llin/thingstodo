import { api } from './client'
import type { RepeatRule, CreateRepeatRuleRequest } from './types'

export function upsertRepeatRule(taskId: string, data: CreateRepeatRuleRequest) {
  return api.put<RepeatRule>(`/tasks/${taskId}/repeat`, data)
}

export function deleteRepeatRule(taskId: string) {
  return api.delete<void>(`/tasks/${taskId}/repeat`)
}
