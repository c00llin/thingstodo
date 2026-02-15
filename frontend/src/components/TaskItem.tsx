import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Calendar, AlertCircle } from 'lucide-react'
import type { Task } from '../api/types'
import { useCompleteTask, useReopenTask } from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { TaskDetail } from './TaskDetail'

interface TaskItemProps {
  task: Task
  showProject?: boolean
}

export function TaskItem({ task, showProject = true }: TaskItemProps) {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectTask = useAppStore((s) => s.selectTask)
  const completeTask = useCompleteTask()
  const reopenTask = useReopenTask()
  const isExpanded = selectedTaskId === task.id
  const isCompleted = task.status === 'completed'

  function handleCheck(checked: boolean | 'indeterminate') {
    if (checked === true) {
      completeTask.mutate(task.id)
    } else {
      reopenTask.mutate(task.id)
    }
  }

  function handleClick() {
    selectTask(isExpanded ? null : task.id)
  }

  return (
    <div className="group">
      <div
        className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition-colors ${
          isExpanded ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        onClick={handleClick}
      >
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox.Root
            checked={isCompleted}
            onCheckedChange={handleCheck}
            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 transition-colors data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 dark:border-gray-500"
          >
            <Checkbox.Indicator>
              <Check size={12} className="text-white" />
            </Checkbox.Indicator>
          </Checkbox.Root>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${
                isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'
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
              {task.checklist_count > 0 && (
                <span>
                  {task.checklist_done}/{task.checklist_count}
                </span>
              )}
            </div>
          </div>
          {showProject && task.project_id && (
            <p className="mt-0.5 text-xs text-gray-400">
              {/* Project name shown via parent context or fetched separately */}
              Project
            </p>
          )}
        </div>
      </div>
      {isExpanded && <TaskDetail taskId={task.id} />}
    </div>
  )
}
