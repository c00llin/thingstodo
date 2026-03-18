import { CloudOff, RefreshCw, AlertCircle, Check, Upload } from 'lucide-react'
import { useSyncStore } from '../sync/status'
import { syncNow } from '../sync/engine'

export function SyncStatus() {
  const { status, pendingCount, error } = useSyncStore()

  function handleClick() {
    void syncNow()
  }

  let icon: React.ReactNode
  let label: string
  let title: string

  if (status === 'syncing') {
    icon = <RefreshCw size={14} className="animate-spin" />
    label = 'Syncing…'
    title = 'Syncing…'
  } else if (status === 'offline') {
    icon = <CloudOff size={14} />
    label = 'Offline'
    title = 'Offline — click to retry'
  } else if (status === 'error') {
    icon = <AlertCircle size={14} />
    label = 'Sync error'
    title = error ?? 'Sync error — click to retry'
  } else if (pendingCount > 0) {
    icon = <Upload size={14} />
    label = `${pendingCount} pending`
    title = `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending — click to sync`
  } else {
    icon = <Check size={14} />
    label = 'Synced'
    title = 'All changes synced'
  }

  const colorClass =
    status === 'offline'
      ? 'text-amber-500 dark:text-amber-400'
      : status === 'error'
        ? 'text-red-500 dark:text-red-400'
        : 'text-neutral-400 dark:text-neutral-500'

  return (
    <button
      onClick={handleClick}
      title={title}
      aria-label={label}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${colorClass}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
