import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useLocalViewCounts } from '../localQueries'
import { localDb } from '../../db'
import type { LocalTask } from '../../db/schema'

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function makeTask(overrides: Partial<LocalTask> = {}): LocalTask {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    title: 'Test task',
    status: 'open',
    notes: '',
    when_date: null,
    high_priority: false,
    deadline: null,
    project_id: 'project-1',
    area_id: null,
    heading_id: null,
    sort_order_today: 0,
    sort_order_project: 0,
    sort_order_heading: 0,
    completed_at: null,
    canceled_at: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    tags: [],
    checklist_count: 0,
    checklist_done: 0,
    has_notes: false,
    has_links: false,
    has_files: false,
    has_repeat_rule: false,
    has_reminders: false,
    first_reminder_type: null,
    first_reminder_value: null,
    first_reminder_exact_at: null,
    project_name: 'Project',
    area_name: null,
    first_schedule_time: null,
    first_schedule_end_time: null,
    first_schedule_completed: undefined,
    schedule_entry_id: null,
    past_schedule_count: undefined,
    has_actionable_schedules: undefined,
    all_today_schedules_completed: undefined,
    _syncStatus: 'synced',
    _localUpdatedAt: now,
    ...overrides,
  }
}

describe('useLocalViewCounts', () => {
  beforeEach(async () => {
    await localDb.tasks.clear()
  })

  afterEach(async () => {
    await localDb.tasks.clear()
  })

  it('reacts to review and overdue changes driven by non-indexed fields', async () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const tenDaysAgo = new Date(today)
    tenDaysAgo.setDate(today.getDate() - 10)

    await localDb.tasks.put(makeTask({
      updated_at: tenDaysAgo.toISOString(),
      deadline: formatLocalDate(yesterday),
    }))

    const { result } = renderHook(() => useLocalViewCounts(7, true))

    await waitFor(() => {
      expect(result.current).toMatchObject({
        inbox: 0,
        today: 1,
        overdue: 1,
        review: 1,
        anytime: 1,
        someday: 0,
        logbook: 0,
        trash: 0,
      })
    })

    await act(async () => {
      await localDb.tasks.update('task-1', { updated_at: new Date().toISOString() })
    })

    await waitFor(() => {
      expect(result.current?.review).toBe(0)
      expect(result.current?.overdue).toBe(1)
      expect(result.current?.today).toBe(1)
    })

    await act(async () => {
      await localDb.tasks.update('task-1', {
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
    })

    await waitFor(() => {
      expect(result.current).toMatchObject({
        today: 0,
        overdue: 0,
        review: 0,
        logbook: 1,
      })
    })
  })
})
