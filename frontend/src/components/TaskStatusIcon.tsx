import { Check, Minus, X } from 'lucide-react'
import type { TaskStatus } from '../api/types'

interface TaskStatusIconProps {
  status: TaskStatus
}

export function TaskStatusIcon({ status }: TaskStatusIconProps) {
  if (status === 'canceled') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-500 bg-red-500">
        <Minus size={12} className="text-white" />
      </div>
    )
  }
  if (status === 'wont_do') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-500 bg-red-500">
        <X size={12} className="text-white" />
      </div>
    )
  }
  if (status === 'completed') {
    return (
      <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-red-500 bg-red-500">
        <Check size={12} className="text-white" />
      </div>
    )
  }
  return null
}
