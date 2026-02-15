import type { Task, SortField } from '../api/types'
import { TaskItem } from './TaskItem'
import { SortableTaskList } from './SortableTaskList'

interface TaskGroupProps {
  title: string
  tasks: Task[]
  showProject?: boolean
  sortable?: boolean
  sortField?: SortField
}

export function TaskGroup({
  title,
  tasks,
  showProject,
  sortable = false,
  sortField = 'sort_order_today',
}: TaskGroupProps) {
  if (tasks.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      {sortable ? (
        <SortableTaskList
          tasks={tasks}
          sortField={sortField}
          showProject={showProject}
        />
      ) : (
        <div className="space-y-0.5">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} showProject={showProject} />
          ))}
        </div>
      )}
    </div>
  )
}
