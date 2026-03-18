export function SyncingOverlay({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-neutral-900">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
      <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">Syncing your tasks…</p>
    </div>
  )
}
