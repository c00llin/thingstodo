import { useDroppable } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import { DEFAULT_DROP_CLASSES } from '../lib/tag-colors'

interface SidebarDropTargetProps {
  id: string
  children: ReactNode
  dropClasses?: string
}

export function SidebarDropTarget({ id, children, dropClasses }: SidebarDropTargetProps) {
  const { isOver, active, setNodeRef } = useDroppable({ id })
  const showHighlight = isOver && active != null

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg transition-colors ${
        showHighlight ? (dropClasses ?? DEFAULT_DROP_CLASSES) : ''
      }`}
    >
      {children}
    </div>
  )
}
