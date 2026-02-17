import { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Calendar, Flag, GripVertical, X, ListChecks, StickyNote, Link, Paperclip, RefreshCw } from 'lucide-react'
import type { Task } from '../api/types'
import { useCompleteTask, useReopenTask, useUpdateTask } from '../hooks/queries'
import { getTaskContext } from '../hooks/useTaskContext'
import { useAppStore } from '../stores/app'
import { TaskDetail } from './TaskDetail'
import { useResolveTags } from '../hooks/useResolveTags'
import { formatRelativeDate } from '../lib/format-date'
import { TaskStatusIcon } from './TaskStatusIcon'
import { TagAutocomplete } from './TagAutocomplete'
import { ProjectAutocomplete } from './ProjectAutocomplete'

function DelayedReveal({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(id)
  }, [])

  return (
    <div
      className="transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {children}
    </div>
  )
}

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
  const setDetailFocusField = useAppStore((s) => s.setDetailFocusField)
  const detailFieldCompleted = useAppStore((s) => s.detailFieldCompleted)
  const setDetailFieldCompleted = useAppStore((s) => s.setDetailFieldCompleted)
  const completeTask = useCompleteTask()
  const reopenTask = useReopenTask()
  const updateTask = useUpdateTask()
  const resolveTags = useResolveTags()
  const taskContext = getTaskContext(task)
  const isSelected = selectedTaskId === task.id
  const isExpanded = expandedTaskId === task.id
  const isCompleted = task.status === 'completed'
  const isDone = task.status !== 'open'

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({ id: task.id, data: { type: 'task', task } })

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBlurRef = useRef(false)
  const triggerCursorRef = useRef<number | null>(null)

  function getEditTitle() {
    const tagSuffix = task.tags.map((t) => `#${t.title}`).join(' ')
    return task.title + (tagSuffix ? ' ' + tagSuffix : '')
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

  // Stop editing when task is deselected and not expanded
  useEffect(() => {
    if (!isSelected && !isExpanded) setEditing(false)
  }, [isSelected, isExpanded])

  // Respond to store-level edit trigger (Enter key)
  useEffect(() => {
    if (editingTaskId === task.id) {
      setTitle(getEditTitle())
      setEditing(true)
      startEditingTask(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTaskId, task.id, startEditingTask])

  // Return focus to title after a detail field completes (triggered by @, ^, *)
  useEffect(() => {
    if (detailFieldCompleted && editing && isExpanded) {
      setDetailFieldCompleted(false)
      const pos = triggerCursorRef.current
      triggerCursorRef.current = null
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        if (pos != null) {
          inputRef.current?.setSelectionRange(pos, pos)
        }
      })
    }
  }, [detailFieldCompleted, editing, isExpanded, setDetailFieldCompleted])

  function handleCheck(checked: boolean | 'indeterminate') {
    if (checked === true) {
      completeTask.mutate(task.id)
    } else {
      reopenTask.mutate(task.id)
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      selectTask(isSelected ? null : task.id)
      return
    }
    // Delay single-click so double-click can cancel it
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      expandTask(isExpanded ? null : task.id)
    }, 200)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    expandTask(task.id)
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
    const hasDollarToken = trimmed.includes('$')
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
        project_id: hasDollarToken ? projectId : task.project_id,
        area_id: hasDollarToken ? areaId : task.area_id,
      },
    })
  }

  function handleTitleChange(value: string) {
    const cursorPos = inputRef.current?.selectionStart ?? value.length
    const lastChar = value[cursorPos - 1]

    const triggerMap: Record<string, 'when' | 'deadline' | 'notes'> = {
      '@': 'when',
      '^': 'deadline',
      '*': 'notes',
    }

    const field = lastChar ? triggerMap[lastChar] : undefined
    if (field) {
      const withoutTrigger = value.slice(0, cursorPos - 1) + value.slice(cursorPos)
      setTitle(withoutTrigger)
      triggerCursorRef.current = cursorPos - 1
      skipBlurRef.current = true
      setDetailFocusField(field)
      expandTask(task.id)
      return
    }

    setTitle(value)
  }


  return (
    <div ref={setNodeRef} className="group" style={{ opacity: isDragging ? 0.4 : 1 }}>
      <div
        className={`relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
          isSelected
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
        }`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Drag handle */}
        <button
          className="absolute -left-5 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-500 group-hover:opacity-100 active:cursor-grabbing dark:text-neutral-600 dark:hover:text-neutral-400"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </button>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {task.status === 'canceled' || task.status === 'wont_do' ? (
            <TaskStatusIcon status={task.status} />
          ) : (
            <Checkbox.Root
              checked={isCompleted}
              onCheckedChange={handleCheck}
              className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-neutral-300 transition-colors data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500 dark:border-neutral-500"
            >
              <Checkbox.Indicator>
                <Check size={12} className="text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <input
                  ref={inputRef}
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={() => {
                    if (skipBlurRef.current) {
                      skipBlurRef.current = false
                      return
                    }
                    saveTitle()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      skipBlurRef.current = true
                      saveTitle()
                    }
                    if (e.key === 'Escape') {
                      skipBlurRef.current = true
                      setTitle(task.title)
                      setEditing(false)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={`min-w-0 flex-1 border-none bg-transparent text-sm leading-5 focus:outline-none ${
                    isDone ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
                  }`}
                />
                <TagAutocomplete inputRef={inputRef} value={title} onChange={setTitle} />
                <ProjectAutocomplete inputRef={inputRef} value={title} onChange={setTitle} />
              </>
            ) : (
              <span
                className={`text-sm leading-5 ${
                  isDone ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
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
            {!editing && (task.has_notes || task.has_links || task.has_files || task.has_repeat_rule) && (
              <span className="flex items-center gap-1.5 text-neutral-400">
                {task.has_repeat_rule && <RefreshCw size={12} className="text-red-500" />}
                {task.has_notes && <StickyNote size={12} />}
                {task.has_links && <Link size={12} />}
                {task.has_files && <Paperclip size={12} />}
              </span>
            )}
            {!editing && (
              <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
                {task.deadline && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Flag size={12} />
                    {formatRelativeDate(task.deadline)}
                  </span>
                )}
                {task.when_date && task.when_date !== 'someday' && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    {formatRelativeDate(task.when_date)}
                  </span>
                )}
                {task.checklist_count > 0 && (
                  <span className="flex items-center gap-1">
                    <ListChecks size={12} />
                    {task.checklist_done}/{task.checklist_count}
                  </span>
                )}
              </div>
            )}
          </div>
          {showProject && taskContext && !editing && (
            <p className="mt-0.5 text-[10px] leading-tight text-neutral-400">
              {taskContext}
            </p>
          )}
        </div>
      </div>
      {isExpanded && (
        <DelayedReveal>
          <TaskDetail taskId={task.id} />
        </DelayedReveal>
      )}
    </div>
  )
}
