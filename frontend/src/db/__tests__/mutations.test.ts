import { beforeEach, describe, expect, test, vi } from 'vitest'
import { localDb } from '../index'
import {
  createTask,
  updateTask,
  completeTask,
  deleteTask,
} from '../mutations'

// Mock syncNow so tests don't try to call the API
vi.mock('../../sync/engine', () => ({
  syncNow: vi.fn().mockResolvedValue(undefined),
}))

async function clearDb() {
  await Promise.all(localDb.tables.map((t) => t.clear()))
}

describe('mutations', () => {
  beforeEach(async () => {
    await clearDb()
  })

  test('createTask writes to IndexedDB and queues sync', async () => {
    const id = await createTask({ title: 'Test task' })

    const task = await localDb.tasks.get(id)
    expect(task?.title).toBe('Test task')
    expect(task?._syncStatus).toBe('pending')

    const queue = await localDb.syncQueue.toArray()
    expect(queue).toHaveLength(1)
    expect(queue[0].entity).toBe('task')
    expect(queue[0].action).toBe('create')
    expect(queue[0].entityId).toBe(id)
  })

  test('updateTask merges fields and queues sync', async () => {
    const id = await createTask({ title: 'Original' })
    await updateTask(id, { title: 'Updated' })

    const task = await localDb.tasks.get(id)
    expect(task?.title).toBe('Updated')

    const queue = await localDb.syncQueue.toArray()
    expect(queue).toHaveLength(2) // create + update
    expect(queue[1].fields).toContain('title')
    expect(queue[1].action).toBe('update')
    expect(queue[1].entityId).toBe(id)
  })

  test('completeTask sets status and completed_at', async () => {
    const id = await createTask({ title: 'Todo' })
    await completeTask(id)

    const task = await localDb.tasks.get(id)
    expect(task?.status).toBe('completed')
    expect(task?.completed_at).toBeTruthy()
  })

  test('deleteTask soft-deletes with deleted_at', async () => {
    const id = await createTask({ title: 'To delete' })
    await deleteTask(id)

    const task = await localDb.tasks.get(id)
    // Task still in DB (soft delete)
    expect(task).toBeDefined()
    expect(task?.deleted_at).toBeTruthy()
  })

  test('updateTask on non-existent id is a no-op', async () => {
    await updateTask('nonexistent', { title: 'Ghost' })
    const queue = await localDb.syncQueue.toArray()
    expect(queue).toHaveLength(0)
  })

  test('createTask sets correct defaults', async () => {
    const id = await createTask({})
    const task = await localDb.tasks.get(id)
    expect(task?.title).toBe('')
    expect(task?.status).toBe('open')
    expect(task?.high_priority).toBe(false)
    expect(task?._syncStatus).toBe('pending')
  })
})
