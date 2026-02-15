import { type ReactNode, useState, useCallback } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { updateTask } from '../api/tasks'
import { useQueryClient } from '@tanstack/react-query'
import type { Task } from '../api/types'
import { TaskItemDragOverlay } from './TaskItemDragOverlay'

interface AppDndContextProps {
  children: ReactNode
  tasks?: Task[]
}

export function AppDndContext({ children, tasks = [] }: AppDndContextProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id)
      setActiveTask(task ?? null)
    },
    [tasks],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null)
      const { active, over } = event
      if (!over) return

      const overId = String(over.id)
      const taskId = String(active.id)

      // Cross-container drops to sidebar targets
      if (overId === 'sidebar-today') {
        const today = new Date().toISOString().split('T')[0]
        updateTask(taskId, { when_date: today })
        queryClient.invalidateQueries({ queryKey: ['views'] })
      } else if (overId === 'sidebar-someday') {
        updateTask(taskId, { when_date: null })
        queryClient.invalidateQueries({ queryKey: ['views'] })
      } else if (overId === 'sidebar-inbox') {
        updateTask(taskId, { project_id: null, area_id: null, when_date: null })
        queryClient.invalidateQueries({ queryKey: ['views'] })
      } else if (overId.startsWith('sidebar-project-')) {
        const projectId = overId.replace('sidebar-project-', '')
        updateTask(taskId, { project_id: projectId })
        queryClient.invalidateQueries({ queryKey: ['views'] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      } else if (overId.startsWith('sidebar-area-')) {
        const areaId = overId.replace('sidebar-area-', '')
        updateTask(taskId, { area_id: areaId })
        queryClient.invalidateQueries({ queryKey: ['views'] })
        queryClient.invalidateQueries({ queryKey: ['areas'] })
      }
    },
    [queryClient],
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskItemDragOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
