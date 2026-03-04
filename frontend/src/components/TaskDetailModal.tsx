import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import { useTask, useUpdateTask } from '../hooks/queries'
import { useResolveTags } from '../hooks/useResolveTags'
import { useDetailShortcuts, detectHashTrigger } from '../hooks/useDetailShortcuts'
import { TaskDetail } from './TaskDetail'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import { PriorityAutocomplete } from './PriorityAutocomplete'
import { AreaProjectPicker } from './AreaProjectPicker'
import { TagMultiSelect } from './TagMultiSelect'

export function TaskDetailModal() {
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const closeModal = useAppStore((s) => s.closeModal)

  const modalRef = useRef<HTMLDivElement>(null)

  // Focus the modal container on open so Escape/Tab work
  useEffect(() => {
    if (!expandedTaskId) return
    modalRef.current?.focus()
  }, [expandedTaskId])

  if (!expandedTaskId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[5vh] md:pt-[10vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="task-detail-modal mx-4 flex w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl outline-none md:mx-0 dark:bg-neutral-800"
        style={{ maxHeight: '85vh' }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // Don't close modal if focus is inside an input (let it blur/cancel edit first)
            const tag = (e.target as HTMLElement)?.tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA') return
            e.preventDefault()
            e.stopPropagation()
            closeModal()
          }
          // Tab trapping
          if (e.key === 'Tab') {
            const modal = modalRef.current
            if (!modal) return
            const focusable = modal.querySelectorAll<HTMLElement>(
              'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault()
              last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault()
              first.focus()
            }
          }
        }}
      >
        <ModalContent taskId={expandedTaskId} />
      </div>
    </div>
  )
}

function ModalContent({ taskId }: { taskId: string }) {
  const { data: task } = useTask(taskId)
  const updateTask = useUpdateTask()
  const resolveTags = useResolveTags()
  const closeModal = useAppStore((s) => s.closeModal)
  const editingTaskId = useAppStore((s) => s.editingTaskId)
  const startEditingTask = useAppStore((s) => s.startEditingTask)
  const setDetailFocusField = useAppStore((s) => s.setDetailFocusField)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task?.title ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const [toolbarPortalEl, setToolbarPortalEl] = useState<HTMLDivElement | null>(null)

  // External open state for pickers (driven by Alt+key shortcuts)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [areaOpen, setAreaOpen] = useState(false)

  function getEditTitle() {
    if (!task) return ''
    return task.title
  }

  // Sync title when task data changes (e.g. navigating between tasks)
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setEditing(false)
    }
  }, [task?.id, task?.title]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length)
    }
  }, [editing])

  // Respond to store-level edit trigger (Enter key sets editingTaskId)
  useEffect(() => {
    if (editingTaskId === taskId) {
      setTitle(getEditTitle())
      setEditing(true)
      startEditingTask(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTaskId, taskId, startEditingTask])

  // Alt+key shortcuts for detail fields
  const handleFocusTitle = useCallback(() => {
    setTitle(getEditTitle())
    setEditing(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task])

  const handleToggleTags = useCallback(() => {
    setTagsOpen(true)
  }, [])

  const handleToggleArea = useCallback(() => {
    setAreaOpen(true)
  }, [])

  const handleTogglePriority = useCallback(() => {
    if (task) {
      updateTask.mutate({ id: task.id, data: { high_priority: !task.high_priority } })
    }
  }, [task, updateTask])

  useDetailShortcuts({
    onFocusTitle: handleFocusTitle,
    onToggleTags: handleToggleTags,
    onToggleArea: handleToggleArea,
    onToggleWhen: useCallback(() => setDetailFocusField('when'), [setDetailFocusField]),
    onToggleDeadline: useCallback(() => setDetailFocusField('deadline'), [setDetailFocusField]),
    onToggleNotes: useCallback(() => setDetailFocusField('notes'), [setDetailFocusField]),
    onToggleChecklist: useCallback(() => setDetailFocusField('checklist'), [setDetailFocusField]),
    onToggleReminder: useCallback(() => setDetailFocusField('reminder'), [setDetailFocusField]),
    onToggleLink: useCallback(() => setDetailFocusField('link'), [setDetailFocusField]),
    onToggleFile: useCallback(() => setDetailFocusField('file'), [setDetailFocusField]),
    onTogglePriority: handleTogglePriority,
    enabled: !!task,
  })

  async function saveTitle() {
    setEditing(false)
    if (!task) return
    const trimmed = title.trim()
    if (!trimmed || trimmed === task.title) {
      setTitle(task.title)
      return
    }
    const hasDollarToken = trimmed.includes('$')
    const { title: cleanTitle, tagIds: newTagIds, projectId, areaId } = await resolveTags(trimmed)
    if (!cleanTitle) {
      setTitle(task.title)
      return
    }
    // Preserve existing tags and merge any new #tag tokens typed inline
    const existingTagIds = task.tags.map((t) => t.id)
    const mergedTagIds = [...new Set([...existingTagIds, ...newTagIds])]
    updateTask.mutate({
      id: task.id,
      data: {
        title: cleanTitle,
        tag_ids: mergedTagIds,
        project_id: hasDollarToken ? projectId : task.project_id,
        area_id: hasDollarToken ? areaId : task.area_id,
      },
    })
  }

  function handleTitleChange(value: string) {
    const cursorPos = inputRef.current?.selectionStart ?? value.length

    // # triggers tag picker
    if (detectHashTrigger(value, cursorPos, handleToggleTags, setTitle)) {
      return
    }

    setTitle(value)
  }

  const isDone = task?.status !== 'open'

  return (
    <>
      {/* Modal header — editable title */}
      <div className="flex items-start gap-3 rounded-t-xl border-b border-neutral-200 bg-red-50 px-5 py-4 dark:border-neutral-700 dark:bg-red-900/20">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="relative">
              <input
                ref={inputRef}
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => saveTitle()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    saveTitle()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    setTitle(task?.title ?? '')
                    setEditing(false)
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className={`w-full border-none bg-transparent text-lg font-medium leading-7 focus:outline-none ${
                  isDone ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
                }`}
              />
              <ProjectAutocomplete inputRef={inputRef} value={title} onChange={setTitle} />
              <PriorityAutocomplete
                inputRef={inputRef}
                value={title}
                onChange={setTitle}
                onSetHighPriority={() => {
                  if (task) updateTask.mutate({ id: task.id, data: { high_priority: true } })
                }}
              />
            </div>
          ) : (
            <h2
              className={`cursor-text text-lg font-medium ${
                isDone ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'
              }`}
              onClick={() => {
                setTitle(getEditTitle())
                setEditing(true)
              }}
            >
              {task?.title ?? 'Loading\u2026'}
            </h2>
          )}
        </div>
        <button
          onClick={closeModal}
          className="mt-0.5 shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Area/Project and Tags row */}
      {task && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 px-5 py-2 dark:border-neutral-700">
          <AreaProjectPicker
            task={task}
            externalOpen={areaOpen}
            onExternalOpenChange={setAreaOpen}
          />
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          <TagMultiSelect
            task={task}
            externalOpen={tagsOpen}
            onExternalOpenChange={setTagsOpen}
          />
        </div>
      )}

      {/* Scrollable detail content */}
      <div className="flex-1 overflow-y-auto px-5">
        <TaskDetail taskId={taskId} isModal toolbarPortalEl={toolbarPortalEl} />
      </div>

      {/* Toolbar — pinned at bottom, portaled from TaskDetail */}
      <div ref={setToolbarPortalEl} className="flex items-center gap-0.5 border-t border-neutral-200 px-4 py-1.5 dark:border-neutral-700" />
    </>
  )
}
