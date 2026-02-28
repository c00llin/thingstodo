import { useEffect, useRef, useId } from 'react'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { AnimatePresence } from 'framer-motion'
import type { Task, SortField } from '../api/types'
import { SortableTaskItem } from './SortableTaskItem'
import { useAppStore } from '../stores/app'
import { useSortableListRegistry } from '../contexts/useSortableListRegistry'

interface SortableTaskListProps {
  tasks: Task[]
  sortField: SortField
  showProject?: boolean
  hideWhenDate?: boolean
}

export function SortableTaskList({ tasks, sortField, showProject, hideWhenDate }: SortableTaskListProps) {
  const listId = useId()
  const registry = useSortableListRegistry()

  // Register this list with the registry so AppDndContext can find tasks.
  // Re-register when tasks change to keep data fresh, but only unregister on unmount.
  useEffect(() => {
    registry.register(listId, tasks, sortField)
  }, [registry, listId, tasks, sortField])

  useEffect(() => {
    return () => registry.unregister(listId)
  }, [registry, listId])

  // Use schedule_entry_id as sortable ID when available (multi-date tasks),
  // falling back to task.id for tasks without schedule entries.
  const sortableIds = tasks.map((t) => t.schedule_entry_id ?? t.id)
  const sortableIdsKey = sortableIds.join(',')
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandTask = useAppStore((s) => s.expandTask)

  // Track which sortable IDs this list previously contained
  const prevIdsRef = useRef<Set<string>>(new Set(sortableIds))
  useEffect(() => {
    prevIdsRef.current = new Set(sortableIds)
  }, [sortableIds, sortableIdsKey])

  // Close detail panel only if the expanded task was removed from THIS list
  const expandedScheduleEntryId = useAppStore((s) => s.expandedScheduleEntryId)
  useEffect(() => {
    if (!expandedTaskId) return
    // Determine the composite key that was expanded
    const expandedKey = expandedScheduleEntryId ?? expandedTaskId
    if (prevIdsRef.current.has(expandedKey) && !sortableIds.includes(expandedKey)) {
      expandTask(null)
    }
  }, [sortableIds, sortableIdsKey, expandedTaskId, expandedScheduleEntryId, expandTask])

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <SortableTaskItem
            key={task.schedule_entry_id ?? task.id}
            task={task}
            showProject={showProject}
            hideWhenDate={hideWhenDate}
            isDragOverlay={false}
            showDivider
          />
        ))}
      </AnimatePresence>
    </SortableContext>
  )
}
