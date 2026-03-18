import { localDb } from './index'

const CACHE_BUDGET_BYTES = 100 * 1024 * 1024 // 100MB

export async function getCachedAttachment(attachmentId: string): Promise<Blob | null> {
  const record = await localDb.cachedFiles.get(attachmentId)
  if (!record) return null

  // Update lastAccessedAt non-blocking
  localDb.cachedFiles
    .update(attachmentId, { lastAccessedAt: new Date().toISOString() })
    .catch(() => {
      // ignore update errors
    })

  return record.blob
}

export async function cacheAttachment(
  attachmentId: string,
  blob: Blob,
  mimeType: string,
): Promise<void> {
  await enforceBudget(blob.size)

  const now = new Date().toISOString()
  await localDb.cachedFiles.put({
    attachmentId,
    blob,
    mimeType,
    size: blob.size,
    cachedAt: now,
    lastAccessedAt: now,
  })
}

export async function isAttachmentCached(attachmentId: string): Promise<boolean> {
  const record = await localDb.cachedFiles.get(attachmentId)
  return record !== undefined
}

async function enforceBudget(incomingBytes: number): Promise<void> {
  // Get all cached files ordered by lastAccessedAt ascending (oldest first)
  const allFiles = await localDb.cachedFiles.orderBy('lastAccessedAt').toArray()

  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0)

  if (totalSize + incomingBytes <= CACHE_BUDGET_BYTES) return

  // Evict oldest-accessed files until we're within budget
  let freed = 0
  const toEvict: string[] = []
  for (const file of allFiles) {
    if (totalSize - freed + incomingBytes <= CACHE_BUDGET_BYTES) break
    toEvict.push(file.attachmentId)
    freed += file.size
  }

  if (toEvict.length > 0) {
    await localDb.cachedFiles.bulkDelete(toEvict)
  }
}

export async function clearAttachmentCache(): Promise<void> {
  await localDb.cachedFiles.clear()
}

export async function getCacheStats(): Promise<{ count: number; totalSizeMB: number }> {
  const allFiles = await localDb.cachedFiles.toArray()
  const totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0)
  return {
    count: allFiles.length,
    totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
  }
}
