import { Check, Calendar, AlertCircle } from 'lucide-react'
import type { Task } from '../api/types'

interface TaskItemDragOverlayProps {
  task: Task
}

export function TaskItemDragOverlay({ task }: TaskItemDragOverlayProps) {
  const isCompleted = task.status === 'completed'

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            isCompleted
              ? 'border-blue-500 bg-blue-500'
              : 'border-gray-300 dark:border-gray-500'
          }`}
        >
          {isCompleted && <Check size={12} className="text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                isCompleted
                  ? 'text-gray-400 line-through'
                  : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {task.title}
            </span>
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {tag.title}
              </span>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
              {task.deadline && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle size={12} />
                  {task.deadline}
                </span>
              )}
              {task.when_date && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  {task.when_date}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
