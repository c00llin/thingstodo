import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInbox, useCreateTask, useCompleteTask, queryKeys } from '../queries'
import { mockInboxView } from '../../test/mocks/data'
import { localDb } from '../../db'

// Mock audio to avoid AudioContext errors in jsdom
vi.mock('../../lib/sounds', () => ({
  playCompleteSound: vi.fn(),
  playReviewSound: vi.fn(),
}))

// Mock sync engine to avoid network calls in tests
vi.mock('../../sync/engine', () => ({
  syncNow: vi.fn().mockResolvedValue(undefined),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { Wrapper, queryClient }
}

describe('useInbox', () => {
  it('fetches inbox data', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useInbox(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.tasks).toHaveLength(2)
    expect(result.current.data?.tasks[0].title).toBe('Buy groceries')
  })
})

describe('useCreateTask', () => {
  beforeEach(async () => {
    await localDb.tasks.clear()
    await localDb.syncQueue.clear()
  })

  it('writes task to local IndexedDB', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper })

    await act(async () => {
      result.current.mutate({ title: 'New task' })
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Verify task was written to IndexedDB
    const tasks = await localDb.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('New task')
    expect(tasks[0]._syncStatus).toBe('pending')
  })
})

describe('useCompleteTask', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await localDb.tasks.clear()
    await localDb.syncQueue.clear()
  })

  it('writes completed status to local IndexedDB', async () => {
    const { Wrapper } = createWrapper()

    // Seed a task in IndexedDB
    await localDb.tasks.put({
      id: 'task-1',
      title: 'Buy groceries',
      status: 'open',
      notes: '',
      when_date: null,
      high_priority: false,
      deadline: null,
      project_id: null,
      area_id: null,
      heading_id: null,
      sort_order_today: 0,
      sort_order_project: 0,
      sort_order_heading: 0,
      completed_at: null,
      canceled_at: null,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
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
      project_name: null,
      area_name: null,
      first_schedule_time: null,
      first_schedule_end_time: null,
      first_schedule_completed: undefined,
      schedule_entry_id: null,
      past_schedule_count: undefined,
      has_actionable_schedules: undefined,
      all_today_schedules_completed: undefined,
      _syncStatus: 'synced',
      _localUpdatedAt: '2026-01-01T00:00:00Z',
    })

    const { result } = renderHook(() => useCompleteTask(), { wrapper: Wrapper })

    await act(async () => {
      result.current.mutate('task-1')
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Verify task was marked completed in IndexedDB
    const task = await localDb.tasks.get('task-1')
    expect(task?.status).toBe('completed')
    expect(task?.completed_at).not.toBeNull()
    expect(task?._syncStatus).toBe('pending')
  })

  it('queues a sync entry for the completed task', async () => {
    const { Wrapper } = createWrapper()

    await localDb.tasks.put({
      id: 'task-2',
      title: 'Test task',
      status: 'open',
      notes: '',
      when_date: null,
      high_priority: false,
      deadline: null,
      project_id: null,
      area_id: null,
      heading_id: null,
      sort_order_today: 0,
      sort_order_project: 0,
      sort_order_heading: 0,
      completed_at: null,
      canceled_at: null,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
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
      project_name: null,
      area_name: null,
      first_schedule_time: null,
      first_schedule_end_time: null,
      first_schedule_completed: undefined,
      schedule_entry_id: null,
      past_schedule_count: undefined,
      has_actionable_schedules: undefined,
      all_today_schedules_completed: undefined,
      _syncStatus: 'synced',
      _localUpdatedAt: '2026-01-01T00:00:00Z',
    })

    const { result } = renderHook(() => useCompleteTask(), { wrapper: Wrapper })

    await act(async () => {
      result.current.mutate('task-2')
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // Verify a sync queue entry was created
    const queue = await localDb.syncQueue.toArray()
    const entry = queue.find((e) => e.entityId === 'task-2')
    expect(entry).toBeDefined()
    expect(entry?.entity).toBe('task')
    expect(entry?.action).toBe('update')
  })
})
