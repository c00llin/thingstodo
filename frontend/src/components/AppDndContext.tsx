import { type ReactNode, useState, useCallback, useMemo } from 'react'
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
import { updateTask, reopenTask, restoreTask, deleteTask, completeTask, reorderTasks } from '../api/tasks'
import { updateProject, reorderProjects } from '../api/projects'
import { reorderAreas } from '../api/areas'
import { reorderTags } from '../api/tags'
import { useQueryClient } from '@tanstack/react-query'
import { useProjects, useAreas, useTags, updateTaskInCache, queryKeys } from '../hooks/queries'
import type { Task, Tag, Area, Project, SortField } from '../api/types'

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
  queryClient.setQueriesData<unknown>(
    { queryKey: ['projects'] },
    (old: unknown) => old ? reorderArrays(old) : old,
  )
  queryClient.setQueriesData<unknown>(
    { queryKey: ['areas'] },
    (old: unknown) => old ? reorderArrays(old) : old,
  )
}
/** Calculate a new sort_order position for an entity dropped at the given index. */
function calculateEntityPosition(
  items: { sort_order: number }[],
  targetIndex: number,
): number {
  if (items.length === 0) return 1024
  if (targetIndex === 0) return items[0].sort_order / 2
  if (targetIndex >= items.length) return items[items.length - 1].sort_order + 1024
  return (items[targetIndex - 1].sort_order + items[targetIndex].sort_order) / 2
}

import { TaskItemDragOverlay } from './TaskItemDragOverlay'
import { useAppStore } from '../stores/app'
import { SortableListRegistryProvider } from '../contexts/SortableListRegistry'
import { useSortableListRegistry } from '../contexts/useSortableListRegistry'
import { calculatePosition } from '../lib/sort-position'

// Prefer sidebar droppables when the pointer is over them, fall back to closestCenter for sortable reorder.
// When multiple sidebar targets match (e.g. project inside area), prefer the most specific one.
const sidebarFirstCollision: CollisionDetection = (args) => {
  const activeId = String(args.active.id)

  // Project sort drags: collide with same-prefix (reorder) + sidebar-area targets (reassign)
  if (activeId.startsWith('sort-project-')) {
    const sortContainers = args.droppableContainers.filter((c) =>
      String(c.id).startsWith('sort-project-'),
    )
    const areaContainers = args.droppableContainers.filter((c) =>
      String(c.id).startsWith('sidebar-area-'),
    )
    // Check if pointer is over an area target (area reassignment takes priority)
    if (areaContainers.length > 0) {
      const areaHits = pointerWithin({ ...args, droppableContainers: areaContainers })
      if (areaHits.length > 0) return [areaHits[0]]
    }
    return closestCenter({ ...args, droppableContainers: sortContainers })
  }

  // Other sort drags (areas, tags): only collide with same-prefix sort containers
  if (activeId.startsWith('sort-')) {
    const prefix = activeId.replace(/-[^-]+$/, '-') // e.g. "sort-area-"
    const sortContainers = args.droppableContainers.filter((c) =>
      String(c.id).startsWith(prefix),
    )
    return closestCenter({ ...args, droppableContainers: sortContainers })
  }

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
    (c) => !String(c.id).startsWith('sidebar-') && !String(c.id).startsWith('sort-'),
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
  const projects = useMemo(() => projectsData?.projects ?? [], [projectsData?.projects])
  const { data: areasData } = useAreas()
  const areas = useMemo(() => areasData?.areas ?? [], [areasData?.areas])
  const { data: tagsData } = useTags()
  const allTags = useMemo(() => tagsData?.tags ?? [], [tagsData?.tags])
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
      if (activeId.startsWith('sort-project-')) {
        const projectId = activeId.replace('sort-project-', '')
        const project = projects.find((p) => p.id === projectId)
        setActiveProjectName(project?.title ?? null)
        return
      }
      if (activeId.startsWith('sort-')) return // areas/tags: no overlay needed
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

      // Sidebar sort reorder: areas
      if (activeId.startsWith('sort-area-') && overId.startsWith('sort-area-')) {
        if (activeId === overId) return
        const movedId = activeId.replace('sort-area-', '')
        const overedId = overId.replace('sort-area-', '')
        const oldIndex = areas.findIndex((a) => a.id === movedId)
        const newIndex = areas.findIndex((a) => a.id === overedId)
        if (oldIndex === -1 || newIndex === -1) return
        const without = areas.filter((a) => a.id !== movedId)
        const newPos = calculateEntityPosition(without, newIndex)
        // Optimistic: reorder in cache
        queryClient.setQueriesData<{ areas: Area[] }>(
          { queryKey: queryKeys.areas.all },
          (old) => {
            if (!old) return old
            return { ...old, areas: old.areas.map((a) => a.id === movedId ? { ...a, sort_order: newPos } : a).sort((a, b) => a.sort_order - b.sort_order) }
          },
        )
        reorderAreas([{ id: movedId, sort_order: newPos }]).then(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })
        })
        return
      }

      // Sidebar sort reorder: tags
      if (activeId.startsWith('sort-tag-') && overId.startsWith('sort-tag-')) {
        if (activeId === overId) return
        const movedId = activeId.replace('sort-tag-', '')
        const overedId = overId.replace('sort-tag-', '')
        const rootTags = allTags.filter((t: Tag) => !t.parent_tag_id)
        const oldIndex = rootTags.findIndex((t: Tag) => t.id === movedId)
        const newIndex = rootTags.findIndex((t: Tag) => t.id === overedId)
        if (oldIndex === -1 || newIndex === -1) return
        const without = rootTags.filter((t: Tag) => t.id !== movedId)
        const newPos = calculateEntityPosition(without, newIndex)
        queryClient.setQueriesData<{ tags: Tag[] }>(
          { queryKey: queryKeys.tags.all },
          (old) => {
            if (!old) return old
            return { ...old, tags: old.tags.map((t) => t.id === movedId ? { ...t, sort_order: newPos } : t).sort((a, b) => a.sort_order - b.sort_order) }
          },
        )
        reorderTags([{ id: movedId, sort_order: newPos }]).then(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
        })
        return
      }

      // Sidebar sort: projects
      if (activeId.startsWith('sort-project-')) {
        const movedId = activeId.replace('sort-project-', '')

        // Reorder within same group
        if (overId.startsWith('sort-project-')) {
          if (activeId === overId) return
          const overedId = overId.replace('sort-project-', '')
          const movedProject = projects.find((p) => p.id === movedId)
          const groupProjects = projects.filter((p) => p.area_id === movedProject?.area_id)
          const oldIndex = groupProjects.findIndex((p) => p.id === movedId)
          const newIndex = groupProjects.findIndex((p) => p.id === overedId)
          if (oldIndex === -1 || newIndex === -1) return
          const without = groupProjects.filter((p) => p.id !== movedId)
          const newPos = calculateEntityPosition(without, newIndex)
          queryClient.setQueriesData<{ projects: Project[] }>(
            { queryKey: queryKeys.projects.all },
            (old) => {
              if (!old) return old
              return { ...old, projects: old.projects.map((p) => p.id === movedId ? { ...p, sort_order: newPos } : p).sort((a, b) => a.sort_order - b.sort_order) }
            },
          )
          reorderProjects([{ id: movedId, sort_order: newPos }]).then(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
          })
          return
        }

        // Reassign to area (dropped on area header)
        if (overId.startsWith('sidebar-area-')) {
          const newAreaId = overId.replace('sidebar-area-', '')
          // Cancel any in-flight project queries so they don't overwrite our optimistic area_id
          queryClient.cancelQueries({ queryKey: ['projects'] })
          queryClient.setQueriesData<{ projects: typeof projects }>(
            { queryKey: ['projects'] },
            (old) => old ? { ...old, projects: old.projects.map((p) => p.id === movedId ? { ...p, area_id: newAreaId } : p) } : old,
          )
          updateProject(movedId, { area_id: newAreaId }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            queryClient.invalidateQueries({ queryKey: ['areas'] })
          })
          return
        }

        return
      }

      // Sidebar drops (task → sidebar target)
      // Optimistic update first, then await API before invalidating to avoid refetch race
      if (overId.startsWith('sidebar-')) {
        const taskId = activeId
        const draggedTask = active.data.current?.task as Task | undefined
        const isTrashed = !!draggedTask?.deleted_at
        const needsReopen = draggedTask?.status !== 'open'

        // Drag TO Trash: soft-delete the task
        if (overId === 'sidebar-trash') {
          updateTaskInCache(queryClient, taskId, {
            deleted_at: new Date().toISOString(),
          } as Partial<Task>)
          useAppStore.getState().setDepartingTaskId(taskId)
          deleteTask(taskId).then(() => {
            setTimeout(() => {
              useAppStore.getState().setDepartingTaskId(null)
              queryClient.invalidateQueries({ queryKey: ['views'] })
              queryClient.invalidateQueries({ queryKey: ['projects'] })
              queryClient.invalidateQueries({ queryKey: ['areas'] })
              queryClient.invalidateQueries({ queryKey: ['tags'] })
            }, 800)
          })
          return
        }

        // Drag TO Completed: complete the task (restore first if trashed)
        if (overId === 'sidebar-completed') {
          const doComplete = async () => {
            if (isTrashed) {
              queryClient.setQueriesData<{ groups: { date: string; tasks: Task[] }[]; total: number }>(
                { queryKey: ['views', 'trash'] },
                (old) => {
                  if (!old) return old
                  return {
                    ...old,
                    total: old.total - 1,
                    groups: old.groups
                      .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== taskId) }))
                      .filter((g) => g.tasks.length > 0),
                  }
                },
              )
              updateTaskInCache(queryClient, taskId, { deleted_at: null } as Partial<Task>)
              await restoreTask(taskId)
            }
            updateTaskInCache(queryClient, taskId, {
              status: 'completed',
              completed_at: new Date().toISOString(),
            } as Partial<Task>)
            useAppStore.getState().setDepartingTaskId(taskId)
            await completeTask(taskId)
            setTimeout(() => {
              useAppStore.getState().setDepartingTaskId(null)
              queryClient.invalidateQueries({ queryKey: ['views'] })
              queryClient.invalidateQueries({ queryKey: ['projects'] })
              queryClient.invalidateQueries({ queryKey: ['areas'] })
              queryClient.invalidateQueries({ queryKey: ['tags'] })
            }, 800)
          }
          doComplete()
          return
        }

        // Drag TO Tag: just add the tag, don't restore/reopen
        if (overId.startsWith('sidebar-tag-')) {
          const tagId = overId.replace('sidebar-tag-', '')
          const existingTagIds = draggedTask?.tags?.map((t) => t.id) ?? []
          if (!existingTagIds.includes(tagId)) {
            const tag = allTags.find((t: Tag) => t.id === tagId)
            const newTagRef = { id: tagId, title: tag?.title ?? '', color: tag?.color ?? null }
            updateTaskInCache(queryClient, taskId, {
              tags: [...(draggedTask?.tags ?? []), newTagRef],
            } as Partial<Task>)
            updateTask(taskId, { tag_ids: [...existingTagIds, tagId] }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['views'] })
              queryClient.invalidateQueries({ queryKey: ['tags'] })
            })
          }
          return
        }

        const sidebarDrop = async () => {
          // Restore trashed tasks when dropped on a sidebar target
          if (isTrashed) {
            // Remove the task from the trash view cache immediately
            queryClient.setQueriesData<{ groups: { date: string; tasks: Task[] }[]; total: number }>(
              { queryKey: ['views', 'trash'] },
              (old) => {
                if (!old) return old
                return {
                  ...old,
                  total: old.total - 1,
                  groups: old.groups
                    .map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== taskId) }))
                    .filter((g) => g.tasks.length > 0),
                }
              },
            )
            updateTaskInCache(queryClient, taskId, {
              deleted_at: null,
            } as Partial<Task>)
            await restoreTask(taskId)
          }
          // Reopen non-open tasks when dropped on a sidebar target
          if (needsReopen) {
            updateTaskInCache(queryClient, taskId, {
              status: 'open',
              completed_at: null,
              canceled_at: null,
            } as Partial<Task>)
            await reopenTask(taskId)
          }
          if (overId === 'sidebar-today') {
            const today = new Date().toISOString().split('T')[0]
            updateTaskInCache(queryClient, taskId, { when_date: today } as Partial<Task>)
            await updateTask(taskId, { when_date: today })
          } else if (overId === 'sidebar-anytime') {
            updateTaskInCache(queryClient, taskId, { when_date: null } as Partial<Task>)
            await updateTask(taskId, { when_date: null })
          } else if (overId === 'sidebar-someday') {
            updateTaskInCache(queryClient, taskId, { when_date: 'someday' } as Partial<Task>)
            await updateTask(taskId, { when_date: 'someday' })
          } else if (overId === 'sidebar-inbox') {
            updateTaskInCache(queryClient, taskId, {
              project_id: null, project_name: null,
              area_id: null, area_name: null,
              when_date: null,
            } as Partial<Task>)
            await updateTask(taskId, { project_id: null, area_id: null, when_date: null })
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
          }
          // Invalidate after all API calls complete
          queryClient.invalidateQueries({ queryKey: ['views'] })
          queryClient.invalidateQueries({ queryKey: ['tags'] })
          if (overId.startsWith('sidebar-project-') || overId.startsWith('sidebar-area-')) {
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
          queryClient.invalidateQueries({ queryKey: ['projects'] })
          queryClient.invalidateQueries({ queryKey: ['areas'] })
        })
      }
    },
    [queryClient, projects, areas, allTags, registry],
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
