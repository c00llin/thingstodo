import { useState, useRef, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Calendar, Flag, GripVertical, X, ListChecks, StickyNote, Link, Paperclip, RefreshCw } from 'lucide-react'
import type { Task } from '../api/types'
import { useCompleteTask, useReopenTask, useUpdateTask, useReviewTask } from '../hooks/queries'
import { getTaskContext } from '../hooks/useTaskContext'
import { useAppStore } from '../stores/app'
import { TaskDetail } from './TaskDetail'
import { ConfirmDialog } from './ConfirmDialog'
import { useResolveTags } from '../hooks/useResolveTags'
import { formatRelativeDate } from '../lib/format-date'
import { formatTime, formatTimeRange } from '../lib/format-time'
import { useSettings } from '../hooks/queries'
import { getTagPillClasses, getTagIconClass } from '../lib/tag-colors'
import { isSiYuanTag } from '../lib/siyuan'
import { SiYuanIcon } from './SiYuanIcon'
import { TaskStatusIcon } from './TaskStatusIcon'
import { TagAutocomplete } from './TagAutocomplete'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import { PriorityAutocomplete } from './PriorityAutocomplete'

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
  hideWhenDate?: boolean
  showReviewCheckbox?: boolean
  showDivider?: boolean
}

export function TaskItem({ task, showProject = true, hideWhenDate = false, showReviewCheckbox = false, showDivider = false }: TaskItemProps) {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const selectedScheduleEntryId = useAppStore((s) => s.selectedScheduleEntryId)
  const selectTask = useAppStore((s) => s.selectTask)
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const expandedScheduleEntryId = useAppStore((s) => s.expandedScheduleEntryId)
  const expandTask = useAppStore((s) => s.expandTask)
  const editingTaskId = useAppStore((s) => s.editingTaskId)
  const startEditingTask = useAppStore((s) => s.startEditingTask)
  const setDetailFocusField = useAppStore((s) => s.setDetailFocusField)
  const detailFieldCompleted = useAppStore((s) => s.detailFieldCompleted)
  const setDetailFieldCompleted = useAppStore((s) => s.setDetailFieldCompleted)
  const isDeparting = useAppStore((s) => s.departingTaskId) === task.id
  const pendingCompleteConfirmId = useAppStore((s) => s.pendingCompleteConfirmId)
  const setPendingCompleteConfirmId = useAppStore((s) => s.setPendingCompleteConfirmId)
  const completeTask = useCompleteTask()
  const reopenTask = useReopenTask()
  const updateTask = useUpdateTask()
  const reviewTask = useReviewTask()
  const resolveTags = useResolveTags()
  const { data: settings } = useSettings()
  const taskContext = getTaskContext(task)
  const entryId = task.schedule_entry_id
  const isSelected = selectedTaskId === task.id && selectedScheduleEntryId === (entryId ?? null)
  const isExpanded = expandedTaskId === task.id && expandedScheduleEntryId === (entryId ?? null)
  const isCompleted = task.status === 'completed'
  const isDone = task.status !== 'open'

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({ id: task.schedule_entry_id ?? task.id, data: { type: 'task', task } })

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [siyuanError, setSiyuanError] = useState<string | null>(null)
  const [scheduleConfirmPending, setScheduleConfirmPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipBlurRef = useRef(false)
  const triggerCursorRef = useRef<number | null>(null)
  const siyuanErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getEditTitle() {
    const tagSuffix = task.tags.filter((t) => !isSiYuanTag(t.title)).map((t) => `#${t.title}`).join(' ')
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

  // Open schedule confirmation when triggered by keyboard shortcut
  useEffect(() => {
    if (pendingCompleteConfirmId === task.id) {
      setScheduleConfirmPending(true)
      setPendingCompleteConfirmId(null)
    }
  }, [pendingCompleteConfirmId, task.id, setPendingCompleteConfirmId])

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
      if (task.has_actionable_schedules) {
        setScheduleConfirmPending(true)
      } else {
        completeTask.mutate(task.id)
      }
    } else {
      reopenTask.mutate(task.id)
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey) {
      selectTask(isSelected ? null : task.id, entryId)
      return
    }
    // Delay single-click so double-click can cancel it
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      expandTask(isExpanded ? null : task.id, entryId)
    }, 200)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
    }
    expandTask(task.id, entryId)
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
    const siyuanTagIds = task.tags.filter((t) => isSiYuanTag(t.title)).map((t) => t.id)
    updateTask.mutate({
      id: task.id,
      data: {
        title: cleanTitle,
        tag_ids: [...tagIds, ...siyuanTagIds],
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
      expandTask(task.id, entryId)
      return
    }

    // Detect #siyuan token
    const tagMatches = [...value.matchAll(/#([\w-]+)/g)]
    if (tagMatches.some((m) => m[1].toLowerCase() === 'siyuan')) {
      if (siyuanErrorTimerRef.current) clearTimeout(siyuanErrorTimerRef.current)
      setSiyuanError('"siyuan" is a reserved tag')
      siyuanErrorTimerRef.current = setTimeout(() => setSiyuanError(null), 2000)
    }

    setTitle(value)
  }


  return (
    <motion.div
      ref={setNodeRef}
      data-task-id={task.id}
      data-departing={isDeparting ? 'true' : undefined}
      className="group/item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={
        isDeparting
          ? { opacity: 0, height: 0, transition: { duration: 0.7, ease: 'easeInOut' } }
          : { opacity: 1, height: 'auto' }
      }
      exit={
        isDone
          ? { opacity: 0, height: 0, transition: { duration: 0.3, delay: 0.8 } }
          : { opacity: 0, height: 0, transition: { duration: 0.2 } }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
      <div
        className={`relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
          isSelected
            ? 'bg-red-50 dark:bg-red-900/20'
            : 'group-hover/item:bg-neutral-50 dark:group-hover/item:bg-neutral-800'
        }`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Drag handle */}
        <button
          className="absolute -left-5 top-1/2 hidden -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-500 group-hover/item:opacity-100 active:cursor-grabbing md:block dark:text-neutral-600 dark:hover:text-neutral-400"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </button>
        <div className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0" onClick={(e) => e.stopPropagation()}>
          {task.status === 'canceled' || task.status === 'wont_do' ? (
            <TaskStatusIcon status={task.status} />
          ) : (
            <Checkbox.Root
              checked={isCompleted}
              onCheckedChange={handleCheck}
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500 ${
                task.high_priority ? 'border-red-500 dark:border-red-500' : 'border-neutral-300 dark:border-neutral-500'
              }`}
            >
              <Checkbox.Indicator>
                <Check size={12} className="text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                <PriorityAutocomplete
                  inputRef={inputRef}
                  value={title}
                  onChange={setTitle}
                  onSetHighPriority={() => updateTask.mutate({ id: task.id, data: { high_priority: true } })}
                />
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
            {!editing && task.tags.filter((t) => isSiYuanTag(t.title)).map((tag) => (
              <SiYuanIcon key={tag.id} size={14} className={getTagIconClass(tag.color) || 'text-neutral-400'} />
            ))}
            {!editing && task.tags.filter((t) => !isSiYuanTag(t.title)).map((tag) => (
              <span
                key={tag.id}
                className={`group/tag inline-flex items-center gap-0.5 rounded-full py-0.5 pl-2 pr-1.5 text-xs ${getTagPillClasses(tag.color)}`}
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
                {task.has_links && !task.tags.some((t) => isSiYuanTag(t.title)) && <Link size={12} />}
                {task.has_files && <Paperclip size={12} />}
              </span>
            )}
            {!editing && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 md:ml-auto">
                {task.deadline && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Flag size={12} />
                    {formatRelativeDate(task.deadline)}
                  </span>
                )}
                {!hideWhenDate && task.when_date && (
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
          {!editing && (taskContext || (settings?.show_time_badge !== false && task.first_schedule_time)) && showProject && (
            <p className="mt-0.5 text-[10px] leading-tight text-neutral-400">
              {taskContext}
              {taskContext && settings?.show_time_badge !== false && task.first_schedule_time && ' — '}
              {settings?.show_time_badge !== false && task.first_schedule_time && (
                task.past_schedule_count && task.past_schedule_count > 1
                  ? 'multiple time frames'
                  : task.first_schedule_end_time
                    ? formatTimeRange(task.first_schedule_time, task.first_schedule_end_time, settings?.time_format ?? '12h')
                    : formatTime(task.first_schedule_time, settings?.time_format ?? '12h')
              )}
            </p>
          )}
          {siyuanError && (
            <p className="mt-0.5 text-xs text-red-500">{siyuanError}</p>
          )}
        </div>
      </div>
      {showDivider && <div className="mx-3 border-b border-neutral-100 dark:border-neutral-800" />}
      </div>
      {showReviewCheckbox && (
        <button
          className="mt-2 shrink-0 self-start rounded p-1 text-neutral-300 opacity-0 transition-opacity hover:text-neutral-500 group-hover/item:opacity-100 dark:text-neutral-600 dark:hover:text-neutral-400"
          onClick={(e) => {
            e.stopPropagation()
            reviewTask.mutate(task.id)
          }}
          aria-label="Mark as reviewed"
        >
          <Check size={20} />
        </button>
      )}
      </div>
      {isExpanded && (
        <DelayedReveal>
          <TaskDetail taskId={task.id} />
        </DelayedReveal>
      )}
      <ConfirmDialog
        open={scheduleConfirmPending}
        title="Complete task with scheduled dates?"
        description="Past scheduled dates will be marked done. Today and future dates will be removed."
        confirmLabel="Complete"
        onConfirm={() => {
          setScheduleConfirmPending(false)
          completeTask.mutate(task.id)
        }}
        onCancel={() => setScheduleConfirmPending(false)}
      />
    </motion.div>
  )
}
