import { AlertTriangle } from 'lucide-react'

interface ConflictIndicatorProps {
  syncStatus?: 'synced' | 'pending' | 'conflict'
}

export function ConflictIndicator({ syncStatus }: ConflictIndicatorProps) {
  if (syncStatus !== 'conflict') return null

  return (
    <AlertTriangle
      size={14}
      className="text-amber-500 shrink-0"
      title="Updated on another device"
    />
  )
}
