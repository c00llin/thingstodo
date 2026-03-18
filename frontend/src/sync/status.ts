import { create } from 'zustand'

interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error'
  lastSyncAt: string | null
  pendingCount: number
  error: string | null
  setStatus: (status: SyncState['status']) => void
  setLastSync: (at: string) => void
  setPendingCount: (count: number) => void
  setError: (error: string | null) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  error: null,
  setStatus: (status) => set({ status }),
  setLastSync: (at) => set({ lastSyncAt: at }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setError: (error) => set({ error }),
}))
