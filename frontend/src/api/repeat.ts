import { api } from './client'
import type { RepeatRule, UpsertRepeatRuleRequest } from './types'

export function upsertRepeatRule(taskId: string, data: UpsertRepeatRuleRequest) {
  return api.put<RepeatRule>(`/tasks/${taskId}/repeat`, data)
}

export function deleteRepeatRule(taskId: string) {
  return api.delete<void>(`/tasks/${taskId}/repeat`)
}
