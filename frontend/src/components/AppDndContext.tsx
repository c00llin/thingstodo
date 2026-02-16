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
import { Package } from 'lucide-react'
import { updateTask } from '../api/tasks'
import { updateProject } from '../api/projects'
import { useQueryClient } from '@tanstack/react-query'
import { useProjects } from '../hooks/queries'
import type { Task } from '../api/types'
import { TaskItemDragOverlay } from './TaskItemDragOverlay'

interface AppDndContextProps {
  children: ReactNode
  tasks?: Task[]
}

export function AppDndContext({ children, tasks = [] }: AppDndContextProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null)
  const { data: projectsData } = useProjects()
  const projects = projectsData?.projects ?? []
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = String(event.active.id)
      if (activeId.startsWith('drag-project-')) {
        const projectId = activeId.replace('drag-project-', '')
        const project = projects.find((p) => p.id === projectId)
        setActiveProjectName(project?.title ?? null)
        return
      }
      const task = tasks.find((t) => t.id === event.active.id)
      setActiveTask(task ?? null)
    },
    [tasks, projects],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null)
      setActiveProjectName(null)
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)

      // Project drag-and-drop to areas
      if (activeId.startsWith('drag-project-')) {
        const projectId = activeId.replace('drag-project-', '')
        console.log('[DnD] project drop:', { projectId, overId })
        if (overId.startsWith('sidebar-area-')) {
          const areaId = overId.replace('sidebar-area-', '')
          updateProject(projectId, { area_id: areaId })
        } else if (overId.startsWith('sidebar-project-')) {
          const targetProjectId = overId.replace('sidebar-project-', '')
          const targetProject = projects.find((p) => p.id === targetProjectId)
          updateProject(projectId, { area_id: targetProject?.area_id ?? null })
        } else {
          // Dropped elsewhere — unassign from area
          updateProject(projectId, { area_id: null })
        }
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        queryClient.invalidateQueries({ queryKey: ['areas'] })
        return
      }

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
        {activeProjectName ? (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
            <Package size={14} className="text-neutral-400" />
            <span className="text-sm text-neutral-900 dark:text-neutral-100">{activeProjectName}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
