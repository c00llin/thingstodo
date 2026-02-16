import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { AnimatePresence } from 'framer-motion'
import type { Task, SortField } from '../api/types'
import { SortableTaskItem } from './SortableTaskItem'
import { TaskItemDragOverlay } from './TaskItemDragOverlay'
import { reorderTasks } from '../api/tasks'
import { useAppStore } from '../stores/app'

interface SortableTaskListProps {
  tasks: Task[]
  sortField: SortField
  showProject?: boolean
}

function calculatePosition(tasks: Task[], overIndex: number, sortField: SortField): number {
  if (tasks.length === 0) return 1024

  const getSortOrder = (t: Task) => {
    if (sortField === 'sort_order_today') return t.sort_order_today
    if (sortField === 'sort_order_project') return t.sort_order_project
    return t.sort_order_heading
  }

  if (overIndex === 0) {
    return getSortOrder(tasks[0]) / 2
  }
  if (overIndex >= tasks.length) {
    return getSortOrder(tasks[tasks.length - 1]) + 1024
  }
  return (getSortOrder(tasks[overIndex - 1]) + getSortOrder(tasks[overIndex])) / 2
}

export function SortableTaskList({ tasks, sortField, showProject }: SortableTaskListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeTask = tasks.find((t) => t.id === activeId)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = tasks.findIndex((t) => t.id === active.id)
      const newIndex = tasks.findIndex((t) => t.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const newPosition = calculatePosition(
        tasks.filter((t) => t.id !== active.id),
        newIndex,
        sortField,
      )

      reorderTasks([
        { id: String(active.id), sort_field: sortField, sort_order: newPosition },
      ])
    },
    [tasks, sortField],
  )

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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              showProject={showProject}
              isDragOverlay={false}
            />
          ))}
        </AnimatePresence>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskItemDragOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
