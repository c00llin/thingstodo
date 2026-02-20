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

  // Register this list with the registry so AppDndContext can find tasks
  useEffect(() => {
    registry.register(listId, tasks, sortField)
    return () => registry.unregister(listId)
  })

  const taskIds = tasks.map((t) => t.id)
  const setVisibleTaskIds = useAppStore((s) => s.setVisibleTaskIds)
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandTask = useAppStore((s) => s.expandTask)

  useEffect(() => {
    setVisibleTaskIds(taskIds)
  }, [taskIds.join(','), setVisibleTaskIds])

  // Track which task IDs this list previously contained
  const prevTaskIdsRef = useRef<Set<string>>(new Set(taskIds))
  useEffect(() => {
    prevTaskIdsRef.current = new Set(taskIds)
  }, [taskIds.join(',')])

  // Close detail panel only if the expanded task was removed from THIS list
  useEffect(() => {
    if (expandedTaskId && prevTaskIdsRef.current.has(expandedTaskId) && !taskIds.includes(expandedTaskId)) {
      expandTask(null)
    }
  }, [taskIds.join(','), expandedTaskId, expandTask])

  return (
    <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
      <AnimatePresence initial={false}>
        {tasks.map((task) => (
          <SortableTaskItem
            key={task.id}
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
