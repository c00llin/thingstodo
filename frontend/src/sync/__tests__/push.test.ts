import { beforeEach, describe, expect, test, vi } from 'vitest'
import { localDb } from '../../db/index'
import { pushChanges } from '../push'
import type { SyncQueueEntry } from '../../db/schema'

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    post: vi.fn(),
  },
}))

import { api } from '../../api/client'

const mockPost = vi.mocked(api.post)

async function clearDb() {
  await Promise.all(localDb.tables.map((t) => t.clear()))
}

async function addQueueEntry(
  overrides: Partial<Omit<SyncQueueEntry, 'id'>> = {},
): Promise<void> {
  const entry: Omit<SyncQueueEntry, 'id'> = {
    entity: 'task',
    entityId: 'task-abc',
    action: 'create',
    data: { title: 'Test task' },
    clientUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
  await localDb.syncQueue.add(entry as SyncQueueEntry)
}

describe('pushChanges', () => {
  beforeEach(async () => {
    await clearDb()
    vi.clearAllMocks()
  })

  test('returns 0 and does not call API when queue is empty', async () => {
    const count = await pushChanges('device-1')
    expect(count).toBe(0)
    expect(mockPost).not.toHaveBeenCalled()
  })

  test('sends queued entries and clears queue on success', async () => {
    await addQueueEntry({ entityId: 'task-1' })
    await addQueueEntry({ entityId: 'task-2', action: 'update' })

    mockPost.mockResolvedValueOnce({
      results: [
        { entityId: 'task-1', success: true },
        { entityId: 'task-2', success: true },
      ],
    })

    const count = await pushChanges('device-1')

    expect(count).toBe(2)
    expect(mockPost).toHaveBeenCalledWith('/sync/push', expect.objectContaining({
      device_id: 'device-1',
    }))

    const remaining = await localDb.syncQueue.toArray()
    expect(remaining).toHaveLength(0)
  })

  test('keeps failed entries in queue', async () => {
    await addQueueEntry({ entityId: 'task-ok' })
    await addQueueEntry({ entityId: 'task-fail' })

    mockPost.mockResolvedValueOnce({
      results: [
        { entityId: 'task-ok', success: true },
        { entityId: 'task-fail', success: false, error: 'conflict' },
      ],
    })

    const count = await pushChanges('device-1')

    expect(count).toBe(1)
    const remaining = await localDb.syncQueue.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].entityId).toBe('task-fail')
  })

  test('sends correct change payload shape', async () => {
    await addQueueEntry({
      entityId: 'task-xyz',
      entity: 'task',
      action: 'update',
      fields: ['title', 'status'],
      data: { title: 'Updated', status: 'completed' },
    })

    mockPost.mockResolvedValueOnce({
      results: [{ entityId: 'task-xyz', success: true }],
    })

    await pushChanges('my-device')

    const callArgs = mockPost.mock.calls[0]
    const body = callArgs[1] as { device_id: string; changes: unknown[] }
    expect(body.changes).toHaveLength(1)
    const change = body.changes[0] as Record<string, unknown>
    expect(change.entity).toBe('task')
    expect(change.entityId).toBe('task-xyz')
    expect(change.action).toBe('update')
    expect(change.fields).toEqual(['title', 'status'])
  })
})
