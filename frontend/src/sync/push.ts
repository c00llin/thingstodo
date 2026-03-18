import { api } from '../api/client'
import { localDb } from '../db/index'
import type { SyncQueueEntry } from '../db/schema'

interface ClientChange {
  entity: SyncQueueEntry['entity']
  entity_id: string
  action: SyncQueueEntry['action']
  fields?: string[]
  data: Record<string, unknown>
  client_updated_at: string
}

interface PushResult {
  entity_id: string
  status: string // 'applied' | 'conflict_resolved' | 'error'
  seq?: number
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
    entity_id: entry.entityId,
    action: entry.action,
    fields: entry.fields,
    data: entry.data,
    client_updated_at: entry.clientUpdatedAt,
  }))

  const response = await api.post<PushResponse>('/sync/push', {
    device_id: deviceId,
    changes,
  })

  // Remove successfully pushed entries from queue
  const successfulEntityIds = response.results
    .filter((r: PushResult) => r.status !== 'error')
    .map((r: PushResult) => r.entity_id)

  const idsToRemove = entries
    .filter((e: SyncQueueEntry) => successfulEntityIds.includes(e.entityId))
    .map((e: SyncQueueEntry) => e.id!)
    .filter((id: number) => id !== undefined)

  if (idsToRemove.length > 0) {
    await localDb.syncQueue.bulkDelete(idsToRemove)
  }

  return successfulEntityIds.length
}
