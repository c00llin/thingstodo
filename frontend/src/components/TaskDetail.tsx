import { useState, useRef, useEffect } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Plus, Paperclip, Link, Trash2, X, Calendar, Flag, ListChecks, StickyNote, CircleMinus, CircleX, RefreshCw, CircleAlert } from 'lucide-react'
import { DateInput } from './DateInput'
import {
  useTask,
  useUpdateTask,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useDeleteTask,
  useCancelTask,
  useWontDoTask,
  useUploadFile,
  useAddLink,
  useDeleteAttachment,
} from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { getFileUrl } from '../api/attachments'
import { RepeatRulePicker } from './RepeatRulePicker'
import { formatRepeatRule } from '../lib/format-repeat'
import type { ChecklistItem, Attachment } from '../api/types'
import { isSiYuanLink, hasSiYuanLink, isReservedAnchor } from '../lib/siyuan'

interface TaskDetailProps {
  taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { data: task, isLoading } = useTask(taskId)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const cancelTask = useCancelTask()
  const wontDoTask = useWontDoTask()
  const expandTask = useAppStore((s) => s.expandTask)

  const detailFocusField = useAppStore((s) => s.detailFocusField)
  const setDetailFocusField = useAppStore((s) => s.setDetailFocusField)
  const setDetailFieldCompleted = useAppStore((s) => s.setDetailFieldCompleted)
  const triggeredByTitleRef = useRef(false)

  const [editingNotes, setEditingNotes] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [showWhen, setShowWhen] = useState(false)
  const [showDeadline, setShowDeadline] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [showRepeat, setShowRepeat] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)
  const dateErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const whenDateInputRef = useRef<HTMLDivElement>(null)
  const deadlineDateInputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (task) setNotes(task.notes)
  }, [task])

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus()
      // Auto-size to fit existing content
      notesRef.current.style.height = 'auto'
      notesRef.current.style.height = notesRef.current.scrollHeight + 'px'
    }
  }, [editingNotes])

  // Handle focus field signal from inline title editing triggers (@, ^, *)
  useEffect(() => {
    if (!detailFocusField || !task) return
    const field = detailFocusField
    setDetailFocusField(null)
    triggeredByTitleRef.current = true

    if (field === 'notes') {
      setShowNotes(true)
      setEditingNotes(true)
    } else if (field === 'when') {
      setShowWhen(true)
      requestAnimationFrame(() => {
        const container = whenDateInputRef.current
        // If date already set, DateInput renders a button — click it to activate input mode
        const btn = container?.querySelector('button')
        if (btn) {
          btn.click()
        } else {
          container?.querySelector('input')?.focus()
        }
      })
    } else if (field === 'deadline') {
      setShowDeadline(true)
      requestAnimationFrame(() => {
        const container = deadlineDateInputRef.current
        const btn = container?.querySelector('button')
        if (btn) {
          btn.click()
        } else {
          container?.querySelector('input')?.focus()
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailFocusField, task])

  function returnToTitle() {
    if (triggeredByTitleRef.current) {
      triggeredByTitleRef.current = false
      setDetailFieldCompleted(true)
    }
  }

  function handleWhenComplete() {
    // Hide section if no date exists (Escape without selecting)
    if (!task?.when_date) {
      setShowWhen(false)
    }
    returnToTitle()
  }

  function handleDeadlineComplete() {
    if (!task?.deadline) {
      setShowDeadline(false)
    }
    returnToTitle()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      expandTask(null)
    }
  }

  function saveNotes() {
    setEditingNotes(false)
    if (task && notes !== task.notes) {
      updateTask.mutate({ id: taskId, data: { notes } })
    }
  }

  function showDateError(msg: string) {
    if (dateErrorTimerRef.current) clearTimeout(dateErrorTimerRef.current)
    setDateError(msg)
    dateErrorTimerRef.current = setTimeout(() => setDateError(null), 3000)
  }

  function handleWhenDateChange(date: string | null, evening?: boolean) {
    if (date && date !== 'someday' && task?.deadline && date > task.deadline) {
      showDateError('When date cannot be after the deadline')
      return
    }
    updateTask.mutate({
      id: taskId,
      data: { when_date: date, when_evening: evening ?? false },
    })
    if (!date) setShowWhen(false)
  }

  function handleDeadlineChange(date: string | null) {
    if (date && task?.when_date && task.when_date !== 'someday' && date < task.when_date) {
      showDateError('Deadline cannot be before the when date')
      return
    }
    updateTask.mutate({
      id: taskId,
      data: { deadline: date },
    })
    if (!date) setShowDeadline(false)
  }

  function clearDeadline() {
    updateTask.mutate({ id: taskId, data: { deadline: null } })
    setShowDeadline(false)
  }

  function clearWhen() {
    updateTask.mutate({ id: taskId, data: { when_date: null } })
    setShowWhen(false)
  }

  function handleCancel() {
    cancelTask.mutate(taskId)
    expandTask(null)
  }

  function handleWontDo() {
    wontDoTask.mutate(taskId)
    expandTask(null)
  }

  function handleDelete() {
    deleteTask.mutate(taskId)
    expandTask(null)
  }

  if (isLoading || !task) {
    return (
      <div className="border-t border-neutral-100 px-6 py-4 text-sm text-neutral-400 dark:border-neutral-700">
        Loading...
      </div>
    )
  }

  const hasNotes = !!task.notes
  const hasWhen = !!task.when_date
  const hasDeadline = !!task.deadline
  const hasChecklist = task.checklist.length > 0
  const hasRepeatRule = !!task.repeat_rule
  const hasSiYuan = hasSiYuanLink(task.attachments)

  return (
    <div
      className="space-y-3 border-t border-neutral-100 py-4 pl-6 pr-4 md:pl-[64px] md:pr-6 dark:border-neutral-700"
      onKeyDown={handleKeyDown}
    >
      {/* Notes — shown when has notes or toggled */}
      {(hasNotes || showNotes) && (
        <div className="flex gap-2">
          <StickyNote size={14} className="mt-0.5 shrink-0 text-neutral-400" />
          {editingNotes ? (
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                saveNotes()
                if (!notes.trim()) setShowNotes(false)
                returnToTitle()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  const trimmed = notes.split('\n').filter((l) => l.trim() !== '').join('\n')
                  setNotes(trimmed)
                  if (!trimmed) {
                    setShowNotes(false)
                  } else if (notesRef.current) {
                    notesRef.current.value = trimmed
                    notesRef.current.style.height = 'auto'
                    notesRef.current.style.height = notesRef.current.scrollHeight + 'px'
                  }
                  saveNotes()
                  returnToTitle()
                }
              }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
              className="w-full resize-none border-none bg-transparent px-0 py-0 text-sm focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              placeholder="Notes"
              rows={1}
            />
          ) : (
            <div
              onClick={() => setEditingNotes(true)}
              className="min-h-[1.5rem] cursor-text text-sm text-neutral-700 dark:text-neutral-300"
            >
              {task.notes || (
                <span className="text-neutral-400">Notes</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* When date — shown when set or toggled */}
      {(hasWhen || showWhen) && (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="shrink-0 text-neutral-400" />
          <div ref={whenDateInputRef}>
            <DateInput
              variant="when"
              value={task.when_date ?? ''}
              evening={task.when_evening}
              onChange={handleWhenDateChange}
              autoFocus={showWhen && !hasWhen}
              onComplete={handleWhenComplete}
            />
          </div>
          {hasWhen && (
            <button
              onClick={clearWhen}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              aria-label="Clear when date"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Deadline — shown when set or toggled */}
      {(hasDeadline || showDeadline) && (
        <div className="flex items-center gap-2">
          <Flag size={14} className="shrink-0 text-red-500" />
          <div ref={deadlineDateInputRef}>
            <DateInput
              variant="deadline"
              value={task.deadline ?? ''}
              onChange={handleDeadlineChange}
              autoFocus={showDeadline && !hasDeadline}
              onComplete={handleDeadlineComplete}
            />
          </div>
          {hasDeadline && (
            <button
              onClick={clearDeadline}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              aria-label="Clear deadline"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Checklist — shown when has items or toggled */}
      {(hasChecklist || showChecklist) && (
        <ChecklistEditor taskId={taskId} items={task.checklist} />
      )}

      {/* Existing attachments */}
      {task.attachments.length > 0 && (
        <AttachmentList taskId={taskId} attachments={task.attachments} />
      )}

      {/* Repeat rule picker */}
      {showRepeat && (
        <RepeatRulePicker taskId={taskId} existingRule={task.repeat_rule} onClose={() => setShowRepeat(false)} />
      )}

      {/* Date validation error */}
      {dateError && (
        <div className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {dateError}
        </div>
      )}

      {/* Toolbar — icon buttons for adding when, deadline, file, link, repeat */}
      <div className={`flex items-center gap-0.5 -ml-[6px] ${
        (hasNotes || showNotes || hasWhen || showWhen || hasDeadline || showDeadline || hasChecklist || showChecklist || task.attachments.length > 0 || hasRepeatRule || showRepeat || task.high_priority)
          ? 'border-t border-neutral-100 pt-3 dark:border-neutral-700'
          : ''
      }`}>
        {!hasNotes && !showNotes && (
          <button
            onClick={() => { setShowNotes(true); setEditingNotes(true) }}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Add notes"
            title="Notes"
          >
            <StickyNote size={16} />
          </button>
        )}
        {!hasWhen && !showWhen && (
          <button
            onClick={() => setShowWhen(true)}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Set when date"
            title="When"
          >
            <Calendar size={16} />
          </button>
        )}
        {!hasDeadline && !showDeadline && (
          <button
            onClick={() => setShowDeadline(true)}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Set deadline"
            title="Deadline"
          >
            <Flag size={16} />
          </button>
        )}
        {!hasChecklist && !showChecklist && (
          <button
            onClick={() => setShowChecklist(true)}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Add checklist"
            title="Checklist"
          >
            <ListChecks size={16} />
          </button>
        )}
        <FileUploadButton taskId={taskId} />
        <LinkAddButton taskId={taskId} />
        {task.high_priority ? (
          <button
            onClick={() => updateTask.mutate({ id: taskId, data: { high_priority: false } })}
            className="ml-1 flex items-center gap-1 rounded-md border border-red-200 px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
            aria-label="Remove high priority"
            title="High priority"
          >
            <CircleAlert size={14} />
            <span className="text-xs">High</span>
          </button>
        ) : (
          <button
            onClick={() => updateTask.mutate({ id: taskId, data: { high_priority: true } })}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Set high priority"
            title="High priority"
          >
            <CircleAlert size={16} />
          </button>
        )}
        {hasSiYuan ? (
          <button
            disabled
            className="rounded-md p-2 md:p-1 text-neutral-300 cursor-not-allowed dark:text-neutral-600"
            aria-label={hasRepeatRule ? 'Recurring disabled — remove SiYuan link to edit' : 'Recurring not available for SiYuan-linked tasks'}
            title={hasRepeatRule ? 'Has a repeat rule — remove SiYuan link to edit' : 'Recurring not available for SiYuan-linked tasks'}
          >
            <RefreshCw size={16} />
          </button>
        ) : hasRepeatRule && !showRepeat && task.repeat_rule ? (
          <button
            onClick={() => setShowRepeat(true)}
            className="ml-1 flex items-center gap-1 rounded-md border border-neutral-200 px-1.5 py-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:border-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Repeat"
            title="Repeat"
          >
            <RefreshCw size={14} />
            <span className="text-xs text-neutral-500">{formatRepeatRule(task.repeat_rule)}</span>
          </button>
        ) : !showRepeat && (
          <button
            onClick={() => setShowRepeat(true)}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Repeat"
            title="Repeat"
          >
            <RefreshCw size={16} />
          </button>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {task.status === 'open' && (
            <>
              <button
                onClick={handleCancel}
                className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                aria-label="Cancel task"
                title="Cancel"
              >
                <CircleMinus size={16} />
              </button>
              <button
                onClick={handleWontDo}
                className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                aria-label="Won't do task"
                title="Won't do"
              >
                <CircleX size={16} />
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete task"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function AttachmentList({
  taskId,
  attachments,
}: {
  taskId: string
  attachments: Attachment[]
}) {
  const deleteAttachment = useDeleteAttachment(taskId)

  return (
    <div className="space-y-1">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="group/att flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-1.5 text-sm dark:bg-neutral-800"
        >
          {att.type === 'file' ? (
            <Paperclip size={14} className="shrink-0 text-neutral-400" />
          ) : (
            <Link size={14} className="shrink-0 text-neutral-400" />
          )}
          {att.type === 'file' ? (
            <a
              href={getFileUrl(att.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-red-600 hover:underline"
            >
              {att.title}
            </a>
          ) : (
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 truncate text-red-600 hover:underline"
            >
              {att.title}
            </a>
          )}
          {att.file_size > 0 && (
            <span className="shrink-0 text-xs text-neutral-400">
              ({(att.file_size / 1024 / 1024).toFixed(1)} MB)
            </span>
          )}
          {!isSiYuanLink(att) && (
            <button
              onClick={() => deleteAttachment.mutate(att.id)}
              className="ml-auto shrink-0 text-neutral-400 opacity-0 hover:text-red-500 group-hover/att:opacity-100"
              aria-label={`Remove ${att.title}`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function FileUploadButton({ taskId }: { taskId: string }) {
  const uploadFile = useUploadFile(taskId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile.mutate(file)
    }
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        aria-label="Attach file"
        title="Attach file"
      >
        <Paperclip size={16} />
      </button>
    </>
  )
}

function LinkAddButton({ taskId }: { taskId: string }) {
  const addLink = useAddLink(taskId)
  const [adding, setAdding] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const linkUrlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding && linkUrlRef.current) {
      linkUrlRef.current.focus()
    }
  }, [adding])

  function handleAdd() {
    const url = linkUrl.trim()
    if (!url) return
    const title = linkTitle.trim() || url
    if (isReservedAnchor(title)) {
      setLinkError('"SiYuan" is a reserved link name')
      return
    }
    addLink.mutate({ type: 'link', title, url })
    setLinkUrl('')
    setLinkTitle('')
    setLinkError(null)
    setAdding(false)
  }

  function handleCancel() {
    setAdding(false)
    setLinkUrl('')
    setLinkTitle('')
    setLinkError(null)
  }

  if (adding) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <input
            ref={linkUrlRef}
            type="url"
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); setLinkError(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') handleCancel()
            }}
            placeholder="URL..."
            className="w-40 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <input
            type="text"
            value={linkTitle}
            onChange={(e) => { setLinkTitle(e.target.value); setLinkError(null) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') handleCancel()
            }}
            placeholder="Title..."
            className={`w-28 rounded-md border bg-white px-2 py-1 text-xs focus:outline-none dark:bg-neutral-800 dark:text-neutral-100 ${
              linkError
                ? 'border-red-400 focus:border-red-400 dark:border-red-500'
                : 'border-neutral-200 focus:border-red-400 dark:border-neutral-600'
            }`}
          />
          <button
            onClick={handleCancel}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <X size={14} />
          </button>
        </div>
        {linkError && (
          <span className="text-xs text-red-500">{linkError}</span>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="rounded-md p-2 md:p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      aria-label="Add link"
      title="Add link"
    >
      <Link size={16} />
    </button>
  )
}

function ChecklistItemRow({
  item,
  onUpdate,
  onDelete,
}: {
  item: ChecklistItem
  onUpdate: (data: { title?: string; completed?: boolean }) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  function save() {
    setEditing(false)
    const trimmed = title.trim()
    if (trimmed && trimmed !== item.title) {
      onUpdate({ title: trimmed })
    } else {
      setTitle(item.title)
    }
  }

  return (
    <div className="group/item flex items-center gap-2">
      <Checkbox.Root
        checked={item.completed}
        onCheckedChange={(checked) => onUpdate({ completed: checked === true })}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-neutral-300 data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
      >
        <Checkbox.Indicator>
          <Check size={10} className="text-white" />
        </Checkbox.Indicator>
      </Checkbox.Root>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setTitle(item.title)
              setEditing(false)
            }
          }}
          className={`flex-1 border-none bg-transparent py-0 text-sm focus:outline-none ${
            item.completed ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
          }`}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 cursor-text text-sm ${
            item.completed ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
          }`}
        >
          {item.title}
        </span>
      )}
      <button
        onClick={onDelete}
        className="invisible text-neutral-400 hover:text-red-500 group-hover/item:visible"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ChecklistEditor({
  taskId,
  items,
}: {
  taskId: string
  items: ChecklistItem[]
}) {
  const [newTitle, setNewTitle] = useState('')
  const createItem = useCreateChecklistItem(taskId)
  const updateItem = useUpdateChecklistItem(taskId)
  const deleteItem = useDeleteChecklistItem(taskId)

  function handleAdd() {
    const title = newTitle.trim()
    if (!title) return
    createItem.mutate({ title })
    setNewTitle('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      <div className="space-y-1">
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            onUpdate={(data) => updateItem.mutate({ id: item.id, data })}
            onDelete={() => deleteItem.mutate(item.id)}
          />
        ))}
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-neutral-400" />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add item..."
            className="flex-1 border-none bg-transparent py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100"
          />
        </div>
      </div>
    </div>
  )
}
