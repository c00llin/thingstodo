import { api } from '../api/client'
import { localDb } from '../db/index'
import type { SyncQueueEntry } from '../db/schema'

interface ClientChange {
  entity: SyncQueueEntry['entity']
  entityId: string
  action: SyncQueueEntry['action']
  fields?: string[]
  data: Record<string, unknown>
  clientUpdatedAt: string
}

interface PushResult {
  entityId: string
  success: boolean
  error?: string
}

interface PushResponse {
  results: PushResult[]
}

export async function pushChanges(deviceId: string): Promise<number> {
  const entries = await localDb.syncQueue.orderBy('createdAt').toArray()

  if (entries.length === 0) return 0

  const changes: ClientChange[] = entries.map((entry: SyncQueueEntry) => ({
    entity: entry.entity,
    entityId: entry.entityId,
    action: entry.action,
    fields: entry.fields,
    data: entry.data,
    clientUpdatedAt: entry.clientUpdatedAt,
  }))

  const response = await api.post<PushResponse>('/sync/push', {
    device_id: deviceId,
    changes,
  })

  // Remove successfully pushed entries from queue
  const successfulIds = response.results
    .filter((r: PushResult) => r.success)
    .map((r: PushResult) => r.entityId)

  const idsToRemove = entries
    .filter((e: SyncQueueEntry) => successfulIds.includes(e.entityId))
    .map((e: SyncQueueEntry) => e.id!)
    .filter((id: number) => id !== undefined)

  if (idsToRemove.length > 0) {
    await localDb.syncQueue.bulkDelete(idsToRemove)
  }

  return successfulIds.length
}
