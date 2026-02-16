import { useState, useRef, useEffect } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Plus, Paperclip, Link, Trash2, X, Calendar, Flag, ListChecks, StickyNote } from 'lucide-react'
import {
  useTask,
  useUpdateTask,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useDeleteTask,
  useUploadFile,
  useAddLink,
  useDeleteAttachment,
} from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { getFileUrl } from '../api/attachments'
import type { ChecklistItem, Attachment } from '../api/types'

interface TaskDetailProps {
  taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { data: task, isLoading } = useTask(taskId)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const expandTask = useAppStore((s) => s.expandTask)

  const [editingNotes, setEditingNotes] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const [showWhen, setShowWhen] = useState(false)
  const [showDeadline, setShowDeadline] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const whenRef = useRef<HTMLInputElement>(null)
  const deadlineRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing server state into local draft
    if (task) setNotes(task.notes)
  }, [task])

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus()
    }
  }, [editingNotes])

  useEffect(() => {
    if (showWhen && whenRef.current) {
      whenRef.current.focus()
    }
  }, [showWhen])

  useEffect(() => {
    if (showDeadline && deadlineRef.current) {
      deadlineRef.current.focus()
    }
  }, [showDeadline])

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

  function handleWhenDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateTask.mutate({
      id: taskId,
      data: { when_date: e.target.value || null },
    })
    if (!e.target.value) setShowWhen(false)
  }

  function handleDeadlineChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateTask.mutate({
      id: taskId,
      data: { deadline: e.target.value || null },
    })
    if (!e.target.value) setShowDeadline(false)
  }

  function clearDeadline() {
    updateTask.mutate({ id: taskId, data: { deadline: null } })
    setShowDeadline(false)
  }

  function clearWhen() {
    updateTask.mutate({ id: taskId, data: { when_date: null } })
    setShowWhen(false)
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

  return (
    <div
      className="space-y-3 border-t border-neutral-100 py-4 pl-[64px] pr-6 dark:border-neutral-700"
      onKeyDown={handleKeyDown}
    >
      {/* Notes — shown when has notes or toggled */}
      {(hasNotes || showNotes) && (
        editingNotes ? (
          <textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            className="w-full resize-none border-none bg-transparent px-0 py-0 text-sm focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
            placeholder="Notes"
            rows={3}
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
        )
      )}

      {/* When date — shown when set or toggled */}
      {(hasWhen || showWhen) && (
        <div className="flex items-center gap-2">
          <Calendar size={14} className="shrink-0 text-neutral-400" />
          <input
            ref={whenRef}
            type="date"
            value={task.when_date ?? ''}
            onChange={handleWhenDateChange}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
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
          <input
            ref={deadlineRef}
            type="date"
            value={task.deadline ?? ''}
            onChange={handleDeadlineChange}
            className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          />
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

      {/* Toolbar — icon buttons for adding when, deadline, file, link */}
      <div className="flex items-center gap-1 border-t border-neutral-100 pt-3 dark:border-neutral-700">
        {!hasNotes && !showNotes && (
          <button
            onClick={() => { setShowNotes(true); setEditingNotes(true) }}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Add notes"
            title="Notes"
          >
            <StickyNote size={16} />
          </button>
        )}
        {!hasWhen && !showWhen && (
          <button
            onClick={() => setShowWhen(true)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Set when date"
            title="When"
          >
            <Calendar size={16} />
          </button>
        )}
        {!hasDeadline && !showDeadline && (
          <button
            onClick={() => setShowDeadline(true)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Set deadline"
            title="Deadline"
          >
            <Flag size={16} />
          </button>
        )}
        {!hasChecklist && !showChecklist && (
          <button
            onClick={() => setShowChecklist(true)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            aria-label="Add checklist"
            title="Checklist"
          >
            <ListChecks size={16} />
          </button>
        )}
        <FileUploadButton taskId={taskId} />
        <LinkAddButton taskId={taskId} />
        <div className="ml-auto">
          <button
            onClick={handleDelete}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete task"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Repeat rule */}
      {task.repeat_rule && (
        <div className="text-xs text-neutral-500">
          Repeats: {task.repeat_rule.frequency}
          {task.repeat_rule.interval_value > 1 &&
            ` every ${task.repeat_rule.interval_value}`}
          {task.repeat_rule.day_constraints.length > 0 &&
            ` on ${task.repeat_rule.day_constraints.join(', ')}`}
          {` (${task.repeat_rule.mode === 'fixed' ? 'fixed' : 'after completion'})`}
        </div>
      )}
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
          <button
            onClick={() => deleteAttachment.mutate(att.id)}
            className="ml-auto shrink-0 text-neutral-400 opacity-0 hover:text-red-500 group-hover/att:opacity-100"
            aria-label={`Remove ${att.title}`}
          >
            <X size={14} />
          </button>
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
        className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
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
    addLink.mutate({ type: 'link', title, url })
    setLinkUrl('')
    setLinkTitle('')
    setAdding(false)
  }

  function handleCancel() {
    setAdding(false)
    setLinkUrl('')
    setLinkTitle('')
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={linkUrlRef}
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
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
          onChange={(e) => setLinkTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
            if (e.key === 'Escape') handleCancel()
          }}
          placeholder="Title..."
          className="w-28 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <button
          onClick={handleCancel}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
      aria-label="Add link"
      title="Add link"
    >
      <Link size={16} />
    </button>
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
          <div key={item.id} className="group/item flex items-center gap-2">
            <Checkbox.Root
              checked={item.completed}
              onCheckedChange={(checked) =>
                updateItem.mutate({
                  id: item.id,
                  data: { completed: checked === true },
                })
              }
              className="flex h-4 w-4 items-center justify-center rounded border border-neutral-300 data-[state=checked]:border-red-500 data-[state=checked]:bg-red-500"
            >
              <Checkbox.Indicator>
                <Check size={10} className="text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span
              className={`flex-1 text-sm ${
                item.completed ? 'text-neutral-400 line-through' : 'text-neutral-700'
              }`}
            >
              {item.title}
            </span>
            <button
              onClick={() => deleteItem.mutate(item.id)}
              className="invisible text-neutral-400 hover:text-red-500 group-hover/item:visible"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-neutral-400" />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add item..."
            className="flex-1 border-none bg-transparent py-1 text-sm text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
