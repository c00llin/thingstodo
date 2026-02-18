import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import { useCreateTask } from '../hooks/queries'
import { useResolveTags } from '../hooks/useResolveTags'
import { TagAutocomplete } from './TagAutocomplete'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import { PriorityAutocomplete } from './PriorityAutocomplete'
import { StickyNote, Calendar, Flag, X } from 'lucide-react'
import { DateInput } from './DateInput'

export function QuickEntry() {
  const open = useAppStore((s) => s.quickEntryOpen)
  const close = useAppStore((s) => s.closeQuickEntry)
  const initialValue = useAppStore((s) => s.quickEntryInitialValue)

  const [title, setTitle] = useState('')

  // Detail fields
  const [notes, setNotes] = useState('')
  const [whenDate, setWhenDate] = useState('')
  const [whenEvening, setWhenEvening] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [highPriority, setHighPriority] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showWhen, setShowWhen] = useState(false)
  const [showDeadline, setShowDeadline] = useState(false)

  const createTask = useCreateTask()
  const resolveTags = useResolveTags()

  const inputRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      // Only overwrite the draft when opened with a seeded value (type-to-create)
      if (initialValue) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(initialValue)
      }
    }
  }, [open, initialValue])

  function resetDetailFields() {
    setNotes('')
    setWhenDate('')
    setWhenEvening(false)
    setDeadline('')
    setHighPriority(false)
    setShowNotes(false)
    setShowWhen(false)
    setShowDeadline(false)
  }

  // Reset detail fields when title is cleared
  useEffect(() => {
    if (title.trim().length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetDetailFields()
    }
  }, [title])

  // Place cursor at end of value when popup opens
  useEffect(() => {
    if (open && inputRef.current) {
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [open])

  // Auto-focus sections when toggled
  useEffect(() => {
    if (showNotes && notesRef.current) notesRef.current.focus()
  }, [showNotes])

  const handleSubmit = useCallback(async () => {
    const raw = title.trim()
    if (!raw) return

    const { title: parsedTitle, tagIds, projectId, areaId } = await resolveTags(raw)
    if (!parsedTitle) return

    createTask.mutate(
      {
        title: parsedTitle,
        notes: notes.trim() || undefined,
        when_date: whenDate || undefined,
        when_evening: whenEvening || undefined,
        high_priority: highPriority || undefined,
        deadline: deadline || undefined,
        tag_ids: tagIds.length > 0 ? tagIds : undefined,
        project_id: projectId ?? undefined,
        area_id: areaId ?? undefined,
      },
      {
        onSuccess: () => {
          setTitle('')
          resetDetailFields()
          close()
        },
      }
    )
  }, [title, notes, whenDate, whenEvening, highPriority, deadline, resolveTags, createTask, close])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
        }
        if (e.key === 'Tab') {
          const modal = e.currentTarget.querySelector<HTMLElement>('.quick-entry-modal')
          if (!modal) return
          const focusable = modal.querySelectorAll<HTMLElement>(
            'input:not([disabled]), textarea:not([disabled]), button:not([disabled])'
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
      <div className="quick-entry-modal w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-neutral-800">
        <CreateMode
          title={title}
          onTitleChange={setTitle}
          onSubmit={handleSubmit}
          isSubmitting={createTask.isPending}
          inputRef={inputRef}
          notes={notes}
          onNotesChange={setNotes}
          notesRef={notesRef}
          whenDate={whenDate}
          whenEvening={whenEvening}
          onWhenDateChange={(date, evening) => {
            setWhenDate(date ?? '')
            setWhenEvening(evening ?? false)
            if (!date) setShowWhen(false)
          }}
          deadline={deadline}
          onDeadlineChange={(date) => {
            setDeadline(date ?? '')
            if (!date) setShowDeadline(false)
          }}
          highPriority={highPriority}
          onSetHighPriority={() => setHighPriority(true)}
          showNotes={showNotes}
          onToggleNotes={setShowNotes}
          showWhen={showWhen}
          onToggleWhen={setShowWhen}
          showDeadline={showDeadline}
          onToggleDeadline={setShowDeadline}
        />
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
          <span>Enter to create · #tag $project *notes @when ^deadline !high</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}

function CreateMode({
  title,
  onTitleChange,
  onSubmit,
  isSubmitting,
  inputRef,
  notes,
  onNotesChange,
  notesRef,
  whenDate,
  whenEvening,
  onWhenDateChange,
  deadline,
  onDeadlineChange,
  highPriority,
  onSetHighPriority,
  showNotes,
  onToggleNotes,
  showWhen,
  onToggleWhen,
  showDeadline,
  onToggleDeadline,
}: {
  title: string
  onTitleChange: (v: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  notes: string
  onNotesChange: (v: string) => void
  notesRef: React.RefObject<HTMLTextAreaElement | null>
  whenDate: string
  whenEvening: boolean
  onWhenDateChange: (date: string | null, evening?: boolean) => void
  deadline: string
  onDeadlineChange: (date: string | null) => void
  highPriority: boolean
  onSetHighPriority: () => void
  showNotes: boolean
  onToggleNotes: (v: boolean) => void
  showWhen: boolean
  onToggleWhen: (v: boolean) => void
  showDeadline: boolean
  onToggleDeadline: (v: boolean) => void
}) {
  const showToolbar = title.trim().length >= 2

  // Track cursor position when a trigger character is used, so we can restore it after field completion
  const triggerCursorRef = useRef<number | null>(null)
  const whenDateInputRef = useRef<HTMLDivElement>(null)
  const deadlineDateInputRef = useRef<HTMLDivElement>(null)

  const handleTitleChange = useCallback((value: string) => {
    const cursorPos = inputRef.current?.selectionStart ?? value.length
    const lastChar = value[cursorPos - 1]

    if (lastChar === '@') {
      const withoutTrigger = value.slice(0, cursorPos - 1) + value.slice(cursorPos)
      triggerCursorRef.current = cursorPos - 1
      onTitleChange(withoutTrigger)
      onToggleWhen(true)
      requestAnimationFrame(() => {
        const input = whenDateInputRef.current?.querySelector('input')
        input?.focus()
      })
      return
    }

    if (lastChar === '^') {
      const withoutTrigger = value.slice(0, cursorPos - 1) + value.slice(cursorPos)
      triggerCursorRef.current = cursorPos - 1
      onTitleChange(withoutTrigger)
      onToggleDeadline(true)
      requestAnimationFrame(() => {
        const input = deadlineDateInputRef.current?.querySelector('input')
        input?.focus()
      })
      return
    }

    if (lastChar === '*') {
      const withoutTrigger = value.slice(0, cursorPos - 1) + value.slice(cursorPos)
      triggerCursorRef.current = cursorPos - 1
      onTitleChange(withoutTrigger)
      onToggleNotes(true)
      requestAnimationFrame(() => {
        notesRef.current?.focus()
      })
      return
    }

    onTitleChange(value)
  }, [inputRef, onTitleChange, onToggleWhen, onToggleDeadline, onToggleNotes, notesRef])

  const returnFocusToTitle = useCallback(() => {
    const pos = triggerCursorRef.current
    triggerCursorRef.current = null
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      if (pos != null) {
        inputRef.current?.setSelectionRange(pos, pos)
      }
    })
  }, [inputRef])

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && e.target === inputRef.current) {
          e.preventDefault()
          onSubmit()
        }
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${highPriority ? 'border-red-500' : 'border-neutral-300 dark:border-neutral-600'}`} />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="New task..."
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            disabled={isSubmitting}
          />
        </div>
      </div>
      <TagAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} />
      <ProjectAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} />
      <PriorityAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} onSetHighPriority={onSetHighPriority} />

      {/* Detail sections — shown when toggled */}
      {showToolbar && (showNotes || showWhen || showDeadline) && (
        <div className="space-y-3 border-t border-neutral-200 px-4 py-3 pl-[48px] dark:border-neutral-700">
          {showNotes && (
            <div className="flex gap-2">
              <StickyNote size={14} className="mt-0.5 shrink-0 text-neutral-400" />
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                className="w-full resize-none border-none bg-transparent px-0 py-0 text-sm focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
                placeholder="Notes"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    e.stopPropagation()
                    const trimmed = notes.split('\n').filter((l) => l.trim() !== '').join('\n')
                    onNotesChange(trimmed)
                    if (!trimmed) {
                      onToggleNotes(false)
                    } else if (notesRef.current) {
                      notesRef.current.value = trimmed
                      notesRef.current.style.height = 'auto'
                      notesRef.current.style.height = notesRef.current.scrollHeight + 'px'
                    }
                    returnFocusToTitle()
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = el.scrollHeight + 'px'
                }}
              />
            </div>
          )}
          {showWhen && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="shrink-0 text-neutral-400" />
              <div ref={whenDateInputRef}>
                <DateInput
                  variant="when"
                  value={whenDate}
                  evening={whenEvening}
                  onChange={onWhenDateChange}
                  autoFocus={!whenDate}
                  onComplete={returnFocusToTitle}
                />
              </div>
              {whenDate && (
                <button
                  onClick={() => { onWhenDateChange(null); onToggleWhen(false) }}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-label="Clear when date"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {showDeadline && (
            <div className="flex items-center gap-2">
              <Flag size={14} className="shrink-0 text-red-500" />
              <div ref={deadlineDateInputRef}>
                <DateInput
                  variant="deadline"
                  value={deadline}
                  onChange={onDeadlineChange}
                  autoFocus={!deadline}
                  onComplete={returnFocusToTitle}
                />
              </div>
              {deadline && (
                <button
                  onClick={() => { onDeadlineChange(null); onToggleDeadline(false) }}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-label="Clear deadline"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Icon toolbar — appears after 2+ characters, hidden when all sections active */}
      {showToolbar && (!showNotes || !showWhen || !showDeadline) && (
        <div className="flex items-center gap-1 border-t border-neutral-200 py-2 pl-[42px] pr-4 dark:border-neutral-700">
          {!showNotes && (
            <button
              onClick={() => onToggleNotes(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Add notes"
              title="Notes"
            >
              <StickyNote size={16} />
            </button>
          )}
          {!showWhen && (
            <button
              onClick={() => onToggleWhen(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Set when date"
              title="When"
            >
              <Calendar size={16} />
            </button>
          )}
          {!showDeadline && (
            <button
              onClick={() => onToggleDeadline(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Set deadline"
              title="Deadline"
            >
              <Flag size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

