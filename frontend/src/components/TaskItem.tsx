import { useState, useRef, useEffect } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Calendar, AlertCircle, ChevronDown, X } from 'lucide-react'
import type { Task } from '../api/types'
import { useCompleteTask, useReopenTask, useUpdateTask } from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { TaskDetail } from './TaskDetail'
import { useResolveTags } from '../hooks/useResolveTags'
import { TagAutocomplete } from './TagAutocomplete'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import { useProjects, useAreas } from '../hooks/queries'

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
  const resolveTags = useResolveTags()
  const { data: projectsData } = useProjects()
  const { data: areasData } = useAreas()
  const isSelected = selectedTaskId === task.id
  const isExpanded = expandedTaskId === task.id
  const isCompleted = task.status === 'completed'

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  function getEditTitle() {
    let prefix = ''
    if (task.project_id) {
      const project = (projectsData?.projects ?? []).find((p) => p.id === task.project_id)
      if (project) prefix = `$${project.title} `
    } else if (task.area_id) {
      const area = (areasData?.areas ?? []).find((a) => a.id === task.area_id)
      if (area) prefix = `$${area.title} `
    }
    const tagSuffix = task.tags.map((t) => `#${t.title}`).join(' ')
    return prefix + task.title + (tagSuffix ? ' ' + tagSuffix : '')
  }

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
      setTitle(getEditTitle())
      setEditing(true)
      startEditingTask(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setTitle(getEditTitle())
    setEditing(true)
  }

  async function saveTitle() {
    setEditing(false)
    const trimmed = title.trim()
    if (!trimmed || trimmed === getEditTitle()) {
      setTitle(task.title)
      return
    }
    const { title: cleanTitle, tagIds, projectId, areaId } = await resolveTags(trimmed)
    if (!cleanTitle) {
      setTitle(task.title)
      return
    }
    updateTask.mutate({
      id: task.id,
      data: {
        title: cleanTitle,
        tag_ids: tagIds,
        project_id: projectId,
        area_id: areaId,
      },
    })
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
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox.Root
            checked={isCompleted}
            onCheckedChange={handleCheck}
            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-neutral-300 transition-colors data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500 dark:border-neutral-500"
          >
            <Checkbox.Indicator>
              <Check size={12} className="text-white" />
            </Checkbox.Indicator>
          </Checkbox.Root>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {editing ? (
              <>
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
                    isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
                  }`}
                />
                <TagAutocomplete inputRef={inputRef} value={title} onChange={setTitle} />
                <ProjectAutocomplete inputRef={inputRef} value={title} onChange={setTitle} />
              </>
            ) : (
              <span
                className={`text-sm leading-5 ${
                  isCompleted ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
                }`}
              >
                {task.title}
              </span>
            )}
            {!editing && task.tags.map((tag) => (
              <span
                key={tag.id}
                className="group/tag inline-flex items-center gap-0.5 rounded-full bg-neutral-100 py-0.5 pl-2 pr-1.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
              >
                {tag.title}
                <button
                  type="button"
                  className="ml-0.5 hidden rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 group-hover/tag:inline-flex dark:hover:bg-neutral-600 dark:hover:text-neutral-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    const remainingTagIds = task.tags.filter((t) => t.id !== tag.id).map((t) => t.id)
                    updateTask.mutate({ id: task.id, data: { tag_ids: remainingTagIds } })
                  }}
                  aria-label={`Remove tag ${tag.title}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {!editing && (
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
                {task.checklist_count > 0 && (
                  <span>
                    {task.checklist_done}/{task.checklist_count}
                  </span>
                )}
              </div>
            )}
          </div>
          {showProject && task.project_id && !editing && (
            <p className="mt-0.5 text-xs text-neutral-400">
              {/* Project name shown via parent context or fetched separately */}
              Project
            </p>
          )}
        </div>
        {/* Expand detail button — visible on hover or when selected */}
        <button
          onClick={toggleExpand}
          className={`shrink-0 rounded p-0.5 text-neutral-400 transition-all hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 ${
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
