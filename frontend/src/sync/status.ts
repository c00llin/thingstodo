import { create } from 'zustand'

interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncAt: string | null
  pendingCount: number
  error: string | null
  failedCount: number
  setStatus: (status: SyncState['status']) => void
  setLastSync: (at: string) => void
  setPendingCount: (count: number) => void
  setError: (error: string | null, failedCount?: number) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  error: null,
  failedCount: 0,
  setStatus: (status) => set({ status }),
  setLastSync: (at) => set({ lastSyncAt: at }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setError: (error, failedCount = 0) => set({ error, failedCount }),
}))
