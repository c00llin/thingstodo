import { useState, useRef, useEffect } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Calendar, AlertCircle, ChevronDown } from 'lucide-react'
import type { Task } from '../api/types'
import { useCompleteTask, useReopenTask, useUpdateTask } from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { TaskDetail } from './TaskDetail'

interface TaskItemProps {
  task: Task
  showProject?: boolean
}

export function TaskItem({ task, showProject = true }: TaskItemProps) {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectTask = useAppStore((s) => s.selectTask)
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandTask = useAppStore((s) => s.expandTask)
  const editingTaskId = useAppStore((s) => s.editingTaskId)
  const startEditingTask = useAppStore((s) => s.startEditingTask)
  const completeTask = useCompleteTask()
  const reopenTask = useReopenTask()
  const updateTask = useUpdateTask()
  const isSelected = selectedTaskId === task.id
  const isExpanded = expandedTaskId === task.id
  const isCompleted = task.status === 'completed'

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(task.title)
  }, [task.title])

  // When editing starts, focus input and place cursor at end
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
    }
  }, [editing])

  // Stop editing when task is deselected
  useEffect(() => {
    if (!isSelected) setEditing(false)
  }, [isSelected])

  // Respond to store-level edit trigger (Enter key)
  useEffect(() => {
    if (editingTaskId === task.id) {
      setEditing(true)
      startEditingTask(null)
    }
  }, [editingTaskId, task.id, startEditingTask])

  function handleCheck(checked: boolean | 'indeterminate') {
    if (checked === true) {
      completeTask.mutate(task.id)
    } else {
      reopenTask.mutate(task.id)
    }
  }

  function handleClick() {
    selectTask(isSelected ? null : task.id)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault()
    selectTask(task.id)
    setEditing(true)
  }

  function saveTitle() {
    setEditing(false)
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      updateTask.mutate({ id: task.id, data: { title: trimmed } })
    } else {
      setTitle(task.title)
    }
  }

  function toggleExpand(e: React.MouseEvent) {
    e.stopPropagation()
    expandTask(isExpanded ? null : task.id)
  }

  return (
    <div className="group">
      <div
        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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
            {editing ? (
              <input
                ref={inputRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveTitle()
                  }
                  if (e.key === 'Escape') {
                    setTitle(task.title)
                    setEditing(false)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                className={`min-w-0 flex-1 border-none bg-transparent text-sm leading-5 focus:outline-none ${
                  isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'
                }`}
              />
            ) : (
              <span
                className={`text-sm leading-5 ${
                  isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {task.title}
              </span>
            )}
            {!editing && task.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300"
              >
                {tag.title}
              </span>
            ))}
            {!editing && (
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
            )}
          </div>
          {showProject && task.project_id && !editing && (
            <p className="mt-0.5 text-xs text-gray-400">
              {/* Project name shown via parent context or fetched separately */}
              Project
            </p>
          )}
        </div>
        {/* Expand detail button — visible on hover or when selected */}
        <button
          onClick={toggleExpand}
          className={`shrink-0 rounded p-0.5 text-gray-400 transition-all hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ${
            isSelected || isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } ${isExpanded ? 'rotate-180' : ''}`}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {isExpanded && <TaskDetail taskId={task.id} />}
    </div>
  )
}
