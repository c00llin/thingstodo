import { useSyncStore } from '../sync/status'

export function OfflineBanner() {
  const status = useSyncStore((s) => s.status)

  if (status !== 'offline') return null

  return (
    <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      You're offline. Changes will sync when you reconnect.
    </div>
  )
}
