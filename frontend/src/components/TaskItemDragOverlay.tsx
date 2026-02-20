import { Check, Calendar, Flag, StickyNote, Link, Paperclip, RefreshCw } from 'lucide-react'
import type { Task } from '../api/types'
import { getTagPillClasses } from '../lib/tag-colors'
import { TaskStatusIcon } from './TaskStatusIcon'

interface TaskItemDragOverlayProps {
  task: Task
}

export function TaskItemDragOverlay({ task }: TaskItemDragOverlayProps) {
  const isCompleted = task.status === 'completed'
  const isDone = task.status !== 'open'

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
      <div className="flex items-center gap-3">
        {task.status === 'canceled' || task.status === 'wont_do' ? (
          <TaskStatusIcon status={task.status} />
        ) : (
          <div
            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
              isCompleted
                ? 'border-red-500 bg-red-500'
                : task.high_priority
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-neutral-300 dark:border-neutral-500'
            }`}
          >
            {isCompleted && <Check size={12} className="text-white" />}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                isDone
                  ? 'text-neutral-400 line-through'
                  : 'text-neutral-900 dark:text-neutral-100'
              }`}
            >
              {task.title}
            </span>
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${getTagPillClasses(tag.color)}`}
              >
                {tag.title}
              </span>
            ))}
            {(task.has_notes || task.has_links || task.has_files || task.has_repeat_rule) && (
              <span className="flex items-center gap-1.5 text-neutral-400">
                {task.has_repeat_rule && <RefreshCw size={12} className="text-red-500" />}
                {task.has_notes && <StickyNote size={12} />}
                {task.has_links && <Link size={12} />}
                {task.has_files && <Paperclip size={12} />}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
              {task.deadline && (
                <span className="flex items-center gap-1 text-red-500">
                  <Flag size={12} />
                  {task.deadline}
                </span>
              )}
              {task.when_date && task.when_date !== 'someday' && (
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
