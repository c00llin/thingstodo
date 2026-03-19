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

  // Remove successfully pushed entries and unrecoverable errors from queue.
  // "unsupported entity type" errors should not happen but are cleared
  // to prevent them from blocking the queue permanently.
  const processedEntityIds = new Set<string>()
  for (const r of response.results) {
    if (r.status !== 'error') {
      processedEntityIds.add(r.entity_id)
    } else if (r.error?.includes('unsupported entity type')) {
      processedEntityIds.add(r.entity_id)
    }
  }

  const idsToRemove = entries
    .filter((e: SyncQueueEntry) => processedEntityIds.has(e.entityId))
    .map((e: SyncQueueEntry) => e.id!)
    .filter((id: number) => id !== undefined)

  if (idsToRemove.length > 0) {
    await localDb.syncQueue.bulkDelete(idsToRemove)
  }

  return processedEntityIds.size
}
