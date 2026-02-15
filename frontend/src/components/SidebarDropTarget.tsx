import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'

interface SidebarDropTargetProps {
  id: string
  children: ReactNode
}

export function SidebarDropTarget({ id, children }: SidebarDropTargetProps) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors ${
        isOver ? 'rounded-lg bg-red-100 dark:bg-red-900/40' : ''
      }`}
    >
      {children}
    </div>
  )
}
