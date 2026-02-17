import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'

interface SidebarDropTargetProps {
  id: string
  children: ReactNode
}

export function SidebarDropTarget({ id, children }: SidebarDropTargetProps) {
  const { isOver, active, setNodeRef } = useDroppable({ id })
  const showHighlight = isOver && active != null

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-colors ${
        showHighlight
          ? '[&_a]:!bg-red-100 [&_a]:!text-red-700 [&_a]:!ring-2 [&_a]:!ring-red-300 dark:[&_a]:!bg-red-900/40 dark:[&_a]:!text-red-400 dark:[&_a]:!ring-red-700'
          : ''
      }`}
    >
      {children}
    </div>
  )
}
