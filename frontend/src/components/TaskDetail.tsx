import { useState, useRef, useEffect } from 'react'
import * as Checkbox from '@radix-ui/react-checkbox'
import { Check, Plus, Paperclip, Link, Trash2, X } from 'lucide-react'
import {
  useTask,
  useUpdateTask,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useDeleteTask,
} from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { getFileUrl } from '../api/attachments'
import type { ChecklistItem } from '../api/types'

interface TaskDetailProps {
  taskId: string
}

export function TaskDetail({ taskId }: TaskDetailProps) {
  const { data: task, isLoading } = useTask(taskId)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const expandTask = useAppStore((s) => s.expandTask)

  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (task) setNotes(task.notes)
  }, [task])

  useEffect(() => {
    if (editingNotes && notesRef.current) {
      notesRef.current.focus()
    }
  }, [editingNotes])

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
  }

  function handleDeadlineChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateTask.mutate({
      id: taskId,
      data: { deadline: e.target.value || null },
    })
  }

  function handleDelete() {
    deleteTask.mutate(taskId)
    expandTask(null)
  }

  if (isLoading || !task) {
    return (
      <div className="border-t border-gray-100 px-6 py-4 text-sm text-gray-400 dark:border-gray-700">
        Loading...
      </div>
    )
  }

  return (
    <div
      className="space-y-4 border-t border-gray-100 px-6 py-4 dark:border-gray-700"
      onKeyDown={handleKeyDown}
    >
      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Notes</label>
        {editingNotes ? (
          <textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            rows={3}
          />
        ) : (
          <div
            onClick={() => setEditingNotes(true)}
            className="min-h-[2.5rem] cursor-text rounded-md border border-transparent px-3 py-2 text-sm text-gray-700 hover:border-gray-200 dark:text-gray-300 dark:hover:border-gray-600"
          >
            {task.notes || (
              <span className="text-gray-400">Add notes...</span>
            )}
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="flex gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">When</label>
          <input
            type="date"
            value={task.when_date ?? ''}
            onChange={handleWhenDateChange}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Deadline
          </label>
          <input
            type="date"
            value={task.deadline ?? ''}
            onChange={handleDeadlineChange}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Tags</label>
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-700"
              >
                {tag.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      <ChecklistEditor taskId={taskId} items={task.checklist} />

      {/* Attachments */}
      {task.attachments.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
            Attachments
          </label>
          <div className="space-y-1">
            {task.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-sm"
              >
                {att.type === 'file' ? (
                  <Paperclip size={14} className="text-gray-400" />
                ) : (
                  <Link size={14} className="text-gray-400" />
                )}
                {att.type === 'file' ? (
                  <a
                    href={getFileUrl(att.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {att.title}
                  </a>
                ) : (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {att.title}
                  </a>
                )}
                {att.file_size > 0 && (
                  <span className="text-xs text-gray-400">
                    ({(att.file_size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeat rule */}
      {task.repeat_rule && (
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Repeat</label>
          <p className="text-sm text-gray-700">
            {task.repeat_rule.frequency}
            {task.repeat_rule.interval_value > 1 &&
              ` every ${task.repeat_rule.interval_value}`}
            {task.repeat_rule.day_constraints.length > 0 &&
              ` on ${task.repeat_rule.day_constraints.join(', ')}`}
            {` (${task.repeat_rule.mode === 'fixed' ? 'fixed' : 'after completion'})`}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
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
      <label className="mb-1 block text-xs font-medium text-gray-500">Checklist</label>
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
              className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500"
            >
              <Checkbox.Indicator>
                <Check size={10} className="text-white" />
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span
              className={`flex-1 text-sm ${
                item.completed ? 'text-gray-400 line-through' : 'text-gray-700'
              }`}
            >
              {item.title}
            </span>
            <button
              onClick={() => deleteItem.mutate(item.id)}
              className="invisible text-gray-400 hover:text-red-500 group-hover/item:visible"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-gray-400" />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add item..."
            className="flex-1 border-none bg-transparent py-1 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
