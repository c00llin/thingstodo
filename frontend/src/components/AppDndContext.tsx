import { type ReactNode, useState, useCallback } from 'react'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  closestCenter,
  type CollisionDetection,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Package } from 'lucide-react'
import { updateTask, reopenTask, reorderTasks } from '../api/tasks'
import { updateProject } from '../api/projects'
import { useQueryClient } from '@tanstack/react-query'
import { useProjects, useAreas, updateTaskInCache } from '../hooks/queries'
import type { Task, SortField } from '../api/types'

/** Optimistically reorder a task in all cached view data.
 *  Updates the sort field value on the task, then re-sorts any Task[] that contains it. */
function reorderTaskInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
  sortField: SortField,
  newPosition: number,
) {
  const getSortOrder = (t: Task, sf: SortField): number => {
    if (sf === 'sort_order_today') return t.sort_order_today
    if (sf === 'sort_order_project') return t.sort_order_project
    return t.sort_order_heading
  }

  const reorderArrays = (obj: unknown): unknown => {
    if (!obj || typeof obj !== 'object') return obj
    if (Array.isArray(obj)) {
      // Check if this is a Task[] containing our task
      const isTaskArray = obj.length > 0 && obj.some(
        (item) => item && typeof item === 'object' && 'id' in item && 'status' in item && item.id === taskId,
      )
      if (isTaskArray) {
        // Update the sort field on the moved task, then sort the array
        return [...obj]
          .map((t) => (t.id === taskId ? { ...t, [sortField]: newPosition } : t))
          .sort((a, b) => getSortOrder(a, sortField) - getSortOrder(b, sortField))
      }
      return obj.map(reorderArrays)
    }
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = reorderArrays(value)
    }
    return result
  }

  queryClient.setQueriesData<unknown>(
    { queryKey: ['views'] },
    (old: unknown) => old ? reorderArrays(old) : old,
  )
}
import { TaskItemDragOverlay } from './TaskItemDragOverlay'
import { SortableListRegistryProvider, useSortableListRegistry } from '../contexts/SortableListRegistry'
import { calculatePosition } from '../lib/sort-position'

// Prefer sidebar droppables when the pointer is over them, fall back to closestCenter for sortable reorder.
// When multiple sidebar targets match (e.g. project inside area), prefer the most specific one.
const sidebarFirstCollision: CollisionDetection = (args) => {
  const sidebarContainers = args.droppableContainers.filter((c) =>
    String(c.id).startsWith('sidebar-'),
  )
  if (sidebarContainers.length > 0) {
    const sidebarHits = pointerWithin({ ...args, droppableContainers: sidebarContainers })
    if (sidebarHits.length > 0) {
      // Prefer project/specific targets over area (area is a parent container)
      const projectHit = sidebarHits.find((c) => String(c.id).startsWith('sidebar-project-'))
      if (projectHit) return [projectHit]
      return [sidebarHits[0]]
    }
    // Rect intersection fallback for near-misses
    const sidebarRect = rectIntersection({ ...args, droppableContainers: sidebarContainers })
    if (sidebarRect.length > 0) {
      const projectHit = sidebarRect.find((c) => String(c.id).startsWith('sidebar-project-'))
      if (projectHit) return [projectHit]
      return [sidebarRect[0]]
    }
  }

  // Fall back to closestCenter for sortable reorder among non-sidebar items
  const sortableContainers = args.droppableContainers.filter(
    (c) => !String(c.id).startsWith('sidebar-'),
  )
  return closestCenter({ ...args, droppableContainers: sortableContainers })
}

interface AppDndContextProps {
  children: ReactNode
}

function AppDndContextInner({ children }: AppDndContextProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null)
  const { data: projectsData } = useProjects()
  const projects = projectsData?.projects ?? []
  const { data: areasData } = useAreas()
  const areas = areasData?.areas ?? []
  const queryClient = useQueryClient()
  const registry = useSortableListRegistry()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
      const task = event.active.data.current?.task as Task | undefined
      setActiveTask(task ?? null)
    },
    [projects],
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
        if (overId.startsWith('sidebar-area-')) {
          const areaId = overId.replace('sidebar-area-', '')
          updateProject(projectId, { area_id: areaId })
        } else if (overId.startsWith('sidebar-project-')) {
          const targetProjectId = overId.replace('sidebar-project-', '')
          const targetProject = projects.find((p) => p.id === targetProjectId)
          updateProject(projectId, { area_id: targetProject?.area_id ?? null })
        } else {
          updateProject(projectId, { area_id: null })
        }
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        queryClient.invalidateQueries({ queryKey: ['areas'] })
        return
      }

      // Sidebar drops (task → sidebar target)
      // Optimistic update first, then await API before invalidating to avoid refetch race
      if (overId.startsWith('sidebar-')) {
        const taskId = activeId
        const draggedTask = active.data.current?.task as Task | undefined
        const isCompleted = draggedTask?.status === 'completed'
        const sidebarDrop = async () => {
          // Reopen completed tasks when dropped on a sidebar target
          if (isCompleted) {
            updateTaskInCache(queryClient, taskId, {
              status: 'open',
              completed_at: null,
            } as Partial<Task>)
            await reopenTask(taskId)
          }
          if (overId === 'sidebar-today') {
            const today = new Date().toISOString().split('T')[0]
            updateTaskInCache(queryClient, taskId, { when_date: today } as Partial<Task>)
            await updateTask(taskId, { when_date: today })
            queryClient.invalidateQueries({ queryKey: ['views'] })
          } else if (overId === 'sidebar-anytime') {
            updateTaskInCache(queryClient, taskId, { when_date: null } as Partial<Task>)
            await updateTask(taskId, { when_date: null })
            queryClient.invalidateQueries({ queryKey: ['views'] })
          } else if (overId === 'sidebar-someday') {
            updateTaskInCache(queryClient, taskId, { when_date: 'someday' } as Partial<Task>)
            await updateTask(taskId, { when_date: 'someday' })
            queryClient.invalidateQueries({ queryKey: ['views'] })
          } else if (overId === 'sidebar-inbox') {
            updateTaskInCache(queryClient, taskId, {
              project_id: null, project_name: null,
              area_id: null, area_name: null,
              when_date: null,
            } as Partial<Task>)
            await updateTask(taskId, { project_id: null, area_id: null, when_date: null })
            queryClient.invalidateQueries({ queryKey: ['views'] })
          } else if (overId.startsWith('sidebar-project-')) {
            const projectId = overId.replace('sidebar-project-', '')
            const project = projects.find((p) => p.id === projectId)
            const projectArea = project?.area_id ? areas.find((a) => a.id === project.area_id) : null
            updateTaskInCache(queryClient, taskId, {
              project_id: projectId,
              project_name: project?.title ?? null,
              area_id: project?.area_id ?? null,
              area_name: projectArea?.title ?? null,
            } as Partial<Task>)
            await updateTask(taskId, { project_id: projectId, area_id: project?.area_id ?? null })
            queryClient.invalidateQueries({ queryKey: ['views'] })
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['areas'] })
          } else if (overId.startsWith('sidebar-area-')) {
            const areaId = overId.replace('sidebar-area-', '')
            const area = areas.find((a) => a.id === areaId)
            updateTaskInCache(queryClient, taskId, {
              project_id: null,
              project_name: null,
              area_id: areaId,
              area_name: area?.title ?? null,
            } as Partial<Task>)
            await updateTask(taskId, { project_id: null, area_id: areaId })
            queryClient.invalidateQueries({ queryKey: ['views'] })
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['areas'] })
          }
        }
        sidebarDrop()
        return
      }

      // Same-list reorder (task within sortable list)
      if (activeId === overId) return
      const sourceList = registry.getListForTask(activeId)
      const targetList = registry.getListForTask(overId)
      if (sourceList && targetList && sourceList.listId === targetList.listId) {
        const { tasks, sortField } = sourceList
        const oldIndex = tasks.findIndex((t) => t.id === activeId)
        const newIndex = tasks.findIndex((t) => t.id === overId)
        if (oldIndex === -1 || newIndex === -1) return

        const newPosition = calculatePosition(
          tasks.filter((t) => t.id !== activeId),
          newIndex,
          sortField,
        )
        // Optimistic: reorder the task array in cache immediately
        reorderTaskInCache(queryClient, activeId, sortField, newPosition)
        // Persist to backend, then reconcile
        reorderTasks([
          { id: activeId, sort_field: sortField, sort_order: newPosition },
        ]).then(() => {
          queryClient.invalidateQueries({ queryKey: ['views'] })
        })
      }
    },
    [queryClient, projects, areas, registry],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={sidebarFirstCollision}
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

export function AppDndContext({ children }: AppDndContextProps) {
  return (
    <SortableListRegistryProvider>
      <AppDndContextInner>{children}</AppDndContextInner>
    </SortableListRegistryProvider>
  )
}
