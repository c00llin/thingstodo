import { beforeEach, describe, expect, test, vi } from 'vitest'
import { localDb } from '../../db/index'
import { pullChanges } from '../pull'
import type { SyncQueueEntry } from '../../db/schema'

// Mock the API client
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { api } from '../../api/client'

const mockGet = vi.mocked(api.get)

async function clearDb() {
  await Promise.all(localDb.tables.map((t) => t.clear()))
}

function makePullResponse(
  changes: Array<{
    entity: string
    entityId: string
    action: 'create' | 'update' | 'delete'
    data: Record<string, unknown>
    serverSeq: number
  }>,
  cursor = 42,
) {
  return { changes, cursor, has_more: false }
}

describe('pullChanges', () => {
  beforeEach(async () => {
    await clearDb()
    vi.clearAllMocks()
  })

  test('applies remote create changes to IndexedDB', async () => {
    mockGet.mockResolvedValueOnce(
      makePullResponse([
        {
          entity: 'task',
          entityId: 'remote-task-1',
          action: 'create',
          data: { title: 'Remote task', status: 'open' },
          serverSeq: 10,
        },
      ]),
    )

    await pullChanges()

    const task = await localDb.tasks.get('remote-task-1')
    expect(task).toBeDefined()
    expect(task?.title).toBe('Remote task')
    expect(task?._syncStatus).toBe('synced')
    expect(task?._serverSeq).toBe(10)
  })

  test('applies remote update changes to IndexedDB', async () => {
    // Seed an existing task
    await localDb.tasks.put({
      id: 'task-upd',
      title: 'Old title',
      status: 'open',
      _syncStatus: 'synced',
      _localUpdatedAt: new Date().toISOString(),
    } as Parameters<typeof localDb.tasks.put>[0])

    mockGet.mockResolvedValueOnce(
      makePullResponse([
        {
          entity: 'task',
          entityId: 'task-upd',
          action: 'update',
          data: { title: 'New title' },
          serverSeq: 20,
        },
      ]),
    )

    await pullChanges()

    const task = await localDb.tasks.get('task-upd')
    expect(task?.title).toBe('New title')
    expect(task?._syncStatus).toBe('synced')
  })

  test('applies remote delete changes to IndexedDB', async () => {
    await localDb.tasks.put({
      id: 'task-del',
      title: 'Will be deleted',
      status: 'open',
      _syncStatus: 'synced',
      _localUpdatedAt: new Date().toISOString(),
    } as Parameters<typeof localDb.tasks.put>[0])

    mockGet.mockResolvedValueOnce(
      makePullResponse([
        {
          entity: 'task',
          entityId: 'task-del',
          action: 'delete',
          data: {},
          serverSeq: 30,
        },
      ]),
    )

    await pullChanges()

    const task = await localDb.tasks.get('task-del')
    expect(task).toBeUndefined()
  })

  test('saves cursor to syncMeta after pull', async () => {
    mockGet.mockResolvedValueOnce(makePullResponse([], 99))

    await pullChanges()

    const meta = await localDb.syncMeta.get('cursor')
    expect(meta?.value).toBe(99)
  })

  test('skips entities with pending local changes', async () => {
    // Add a pending task to syncQueue
    const pendingEntry: Omit<SyncQueueEntry, 'id'> = {
      entity: 'task',
      entityId: 'task-local-pending',
      action: 'update',
      data: { title: 'Local pending' },
      fields: ['title'],
      clientUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    await localDb.syncQueue.add(pendingEntry as SyncQueueEntry)

    // Seed the local task with the local version
    await localDb.tasks.put({
      id: 'task-local-pending',
      title: 'Local pending',
      status: 'open',
      _syncStatus: 'pending',
      _localUpdatedAt: new Date().toISOString(),
    } as Parameters<typeof localDb.tasks.put>[0])

    // Server tries to overwrite with a different title
    mockGet.mockResolvedValueOnce(
      makePullResponse([
        {
          entity: 'task',
          entityId: 'task-local-pending',
          action: 'update',
          data: { title: 'Server override' },
          serverSeq: 50,
        },
      ]),
    )

    await pullChanges()

    // Local version should be preserved
    const task = await localDb.tasks.get('task-local-pending')
    expect(task?.title).toBe('Local pending')
    expect(task?._syncStatus).toBe('pending')
  })

  test('handles pagination by following has_more until exhausted', async () => {
    // First page
    mockGet.mockResolvedValueOnce({
      changes: [
        {
          entity: 'task',
          entityId: 'task-page-1',
          action: 'create',
          data: { title: 'Page 1 task', status: 'open' },
          serverSeq: 1,
        },
      ],
      cursor: 10,
      has_more: true,
    })
    // Second page (no more)
    mockGet.mockResolvedValueOnce({
      changes: [
        {
          entity: 'task',
          entityId: 'task-page-2',
          action: 'create',
          data: { title: 'Page 2 task', status: 'open' },
          serverSeq: 2,
        },
      ],
      cursor: 20,
      has_more: false,
    })

    await pullChanges()

    const t1 = await localDb.tasks.get('task-page-1')
    const t2 = await localDb.tasks.get('task-page-2')
    expect(t1).toBeDefined()
    expect(t2).toBeDefined()

    const meta = await localDb.syncMeta.get('cursor')
    expect(meta?.value).toBe(20)
  })

  test('uses stored cursor when pulling', async () => {
    await localDb.syncMeta.put({ key: 'cursor', value: 77 })

    mockGet.mockResolvedValueOnce(makePullResponse([], 80))

    await pullChanges()

    const [call] = mockGet.mock.calls
    expect(call[0]).toContain('since=77')
  })
})
