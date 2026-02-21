import { AnimatePresence } from 'framer-motion'
import type { Task, SortField } from '../api/types'
import { TaskItem } from './TaskItem'
import { SortableTaskList } from './SortableTaskList'

interface TaskGroupProps {
  title: string
  tasks: Task[]
  showProject?: boolean
  hideWhenDate?: boolean
  sortable?: boolean
  sortField?: SortField
}

export function TaskGroup({
  title,
  tasks,
  showProject,
  hideWhenDate = false,
  sortable = false,
  sortField = 'sort_order_today',
}: TaskGroupProps) {
  if (tasks.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {sortable ? (
        <SortableTaskList
          tasks={tasks}
          sortField={sortField}
          showProject={showProject}
        />
      ) : (
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} showProject={showProject} hideWhenDate={hideWhenDate} showDivider />
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}
