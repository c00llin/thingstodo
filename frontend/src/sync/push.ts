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
  entity?: SyncQueueEntry['entity']
  entity_id: string
  status: string // 'applied' | 'conflict_resolved' | 'error'
  seq?: number
  error?: string
}

interface PushResponse {
  results: PushResult[]
}

export interface PushFailure {
  entity: SyncQueueEntry['entity'] | 'unknown'
  entityId: string
  error: string
  count: number
}

export interface PushSummary {
  processedCount: number
  failures: PushFailure[]
}

function summarizeFailures(results: PushResult[]): PushFailure[] {
  const grouped = new Map<string, PushFailure>()

  for (const result of results) {
    if (result.status !== 'error') continue

    const entity = result.entity ?? 'unknown'
    const entityId = result.entity_id
    const error = result.error ?? 'Unknown sync error'
    const key = `${entity}:${entityId}:${error}`
    const existing = grouped.get(key)

    if (existing) {
      existing.count += 1
      continue
    }

    grouped.set(key, {
      entity,
      entityId,
      error,
      count: 1,
    })
  }

  return [...grouped.values()]
}

export function formatPushFailures(failures: PushFailure[]): string | null {
  if (failures.length === 0) return null

  const failedChanges = failures.reduce((sum, failure) => sum + failure.count, 0)
  const lines = failures.slice(0, 3).map((failure) => {
    const repeated = failure.count > 1 ? ` (${failure.count}x)` : ''
    return `${failure.entity} ${failure.entityId}${repeated}: ${failure.error}`
  })

  if (failures.length > 3) {
    lines.push(`+${failures.length - 3} more`)
  }

  return `${failedChanges} sync change${failedChanges === 1 ? '' : 's'} failed.\n${lines.join('\n')}`
}

export async function pushChanges(deviceId: string): Promise<PushSummary> {
  const entries = await localDb.syncQueue.orderBy('createdAt').toArray()

  if (entries.length === 0) {
    return {
      processedCount: 0,
      failures: [],
    }
  }

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

  return {
    processedCount: processedEntityIds.size,
    failures: summarizeFailures(response.results),
  }
}
