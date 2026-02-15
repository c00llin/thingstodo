import { Check, Calendar, AlertCircle } from 'lucide-react'
import type { Task } from '../api/types'

interface TaskItemDragOverlayProps {
  task: Task
}

export function TaskItemDragOverlay({ task }: TaskItemDragOverlayProps) {
  const isCompleted = task.status === 'completed'

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
            isCompleted
              ? 'border-red-500 bg-red-500'
              : 'border-neutral-300 dark:border-neutral-500'
          }`}
        >
          {isCompleted && <Check size={12} className="text-white" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                isCompleted
                  ? 'text-neutral-400 line-through'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {task.title}
            </span>
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
              >
                {tag.title}
              </span>
            ))}
            <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
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
