import { localDb } from '../db/index'
import { pushChanges } from './push'
import { pullChanges, fullSync } from './pull'
import { useSyncStore } from './status'
import { ApiError } from '../api/client'

const DEVICE_ID_KEY = 'thingstodo_device_id'
const SYNC_INTERVAL_MS = 30_000

let syncInterval: ReturnType<typeof setInterval> | null = null

export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    // Generate a random device ID
    deviceId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

export async function syncNow(): Promise<void> {
  const store = useSyncStore.getState()

  // Guard: no-op if already syncing
  if (store.status === 'syncing') return

  // Guard: no-op if offline
  if (!navigator.onLine) {
    store.setStatus('offline')
    return
  }

  store.setStatus('syncing')
  store.setError(null)

  const deviceId = getOrCreateDeviceId()

  try {
    // Push first, then pull
    const pushedCount = await pushChanges(deviceId)

    // Update pending count after push
    const remainingPending = await localDb.syncQueue.count()
    store.setPendingCount(remainingPending)

    // Pull changes from server
    try {
      await pullChanges()
    } catch (err) {
      // If cursor expired, fall back to full sync
      if (
        err instanceof ApiError &&
        (err.status === 410 || (err.message && err.message.includes('cursor_expired')))
      ) {
        await fullSync()
      } else {
        throw err
      }
    }

    store.setLastSync(new Date().toISOString())
    store.setStatus('idle')

    if (pushedCount > 0) {
      // Re-check pending after successful push
      const pending = await localDb.syncQueue.count()
      store.setPendingCount(pending)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    store.setError(message)
    store.setStatus('error')
  }
}

function handleOnline() {
  useSyncStore.getState().setStatus('idle')
  void syncNow()
}

function handleOffline() {
  useSyncStore.getState().setStatus('offline')
}

function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void syncNow()
  }
}

export function startSyncEngine(): void {
  if (syncInterval !== null) return // already running

  // Initial sync
  void syncNow()

  // 30-second interval
  syncInterval = setInterval(() => {
    void syncNow()
  }, SYNC_INTERVAL_MS)

  // Online/offline listeners
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Sync on tab visibility change
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Set initial offline status if needed
  if (!navigator.onLine) {
    useSyncStore.getState().setStatus('offline')
  }
}

export function stopSyncEngine(): void {
  if (syncInterval !== null) {
    clearInterval(syncInterval)
    syncInterval = null
  }

  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}
