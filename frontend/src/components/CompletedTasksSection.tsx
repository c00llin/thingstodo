import { useState } from 'react'
import type { Task } from '../api/types'
import { TaskItem } from './TaskItem'

interface CompletedTasksSectionProps {
  tasks: Task[]
  showProject?: boolean
}

export function CompletedTasksSection({ tasks, showProject }: CompletedTasksSectionProps) {
  const [expanded, setExpanded] = useState(false)

  if (tasks.length === 0) return null

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        {expanded ? 'Hide completed tasks' : `Show ${tasks.length} completed task${tasks.length === 1 ? '' : 's'}`}
      </button>
      {expanded && (
        <div className="mt-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} showProject={showProject} showDivider />
          ))}
        </div>
      )}
    </div>
  )
}
