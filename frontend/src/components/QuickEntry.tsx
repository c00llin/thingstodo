import { useState, useCallback, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/app'
import { useCreateTask } from '../hooks/queries'
import { useResolveTags } from '../hooks/useResolveTags'
import { useDetailShortcuts, detectHashTrigger } from '../hooks/useDetailShortcuts'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import { PriorityAutocomplete } from './PriorityAutocomplete'
import { TagMultiSelect } from './TagMultiSelect'
import { AreaProjectPicker } from './AreaProjectPicker'
import { StickyNote, Calendar, Flag, Tag, Folder, X } from 'lucide-react'
import { DateInput } from './DateInput'

export function QuickEntry() {
  const open = useAppStore((s) => s.quickEntryOpen)
  const close = useAppStore((s) => s.closeQuickEntry)
  const initialValue = useAppStore((s) => s.quickEntryInitialValue)

  const [title, setTitle] = useState('')

  // Detail fields
  const [notes, setNotes] = useState('')
  const [whenDate, setWhenDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [highPriority, setHighPriority] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [showWhen, setShowWhen] = useState(false)
  const [showDeadline, setShowDeadline] = useState(false)

  // Tag and area/project fields
  const [tagIds, setTagIds] = useState<string[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [areaId, setAreaId] = useState<string | null>(null)
  const [showTags, setShowTags] = useState(false)
  const [showArea, setShowArea] = useState(false)

  const createTask = useCreateTask()
  const resolveTags = useResolveTags()

  const inputRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const notesOpenedByShortcutRef = useRef(false)

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
    setDeadline('')
    setHighPriority(false)
    setShowNotes(false)
    setShowWhen(false)
    setShowDeadline(false)
    setTagIds([])
    setProjectId(null)
    setAreaId(null)
    setShowTags(false)
    setShowArea(false)
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

  const handleToggleNotes = useCallback((v: boolean) => {
    if (v) notesOpenedByShortcutRef.current = true
    setShowNotes(v)
  }, [])

  // Auto-focus notes when toggled — delay when opened via Alt+N to avoid
  // macOS dead-key characters (e.g. Alt+N → ~)
  useEffect(() => {
    if (showNotes && notesRef.current) {
      const delay = notesOpenedByShortcutRef.current ? 120 : 0
      notesOpenedByShortcutRef.current = false
      const timer = setTimeout(() => {
        notesRef.current?.focus()
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [showNotes])

  const handleSubmit = useCallback(async () => {
    const raw = title.trim()
    if (!raw) return

    const { title: parsedTitle, tagIds: parsedTagIds, projectId: parsedProjectId, areaId: parsedAreaId } = await resolveTags(raw)
    if (!parsedTitle) return

    // Merge tag IDs from title tokens with tag picker selections
    const mergedTagIds = [...new Set([...parsedTagIds, ...tagIds])]

    createTask.mutate(
      {
        title: parsedTitle,
        notes: notes.trim() || undefined,
        when_date: whenDate || undefined,
        high_priority: highPriority || undefined,
        deadline: deadline || undefined,
        tag_ids: mergedTagIds.length > 0 ? mergedTagIds : undefined,
        project_id: projectId ?? parsedProjectId ?? undefined,
        area_id: areaId ?? parsedAreaId ?? undefined,
      },
      {
        onSuccess: () => {
          setTitle('')
          resetDetailFields()
          close()
        },
      }
    )
  }, [title, notes, whenDate, highPriority, deadline, tagIds, projectId, areaId, resolveTags, createTask, close])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[8vh] md:pt-[15vh]"
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
      <div className="quick-entry-modal mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl md:mx-0 dark:bg-neutral-800">
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
          onWhenDateChange={(date) => {
            setWhenDate(date ?? '')
            if (!date) setShowWhen(false)
          }}
          deadline={deadline}
          onDeadlineChange={(date) => {
            setDeadline(date ?? '')
            if (!date) setShowDeadline(false)
          }}
          highPriority={highPriority}
          onToggleHighPriority={() => setHighPriority((p) => !p)}
          onSetHighPriority={() => setHighPriority(true)}
          showNotes={showNotes}
          onToggleNotes={handleToggleNotes}
          showWhen={showWhen}
          onToggleWhen={setShowWhen}
          showDeadline={showDeadline}
          onToggleDeadline={setShowDeadline}
          tagIds={tagIds}
          onTagIdsChange={setTagIds}
          showTags={showTags}
          onToggleTags={setShowTags}
          areaId={areaId}
          projectId={projectId}
          onAreaProjectChange={(a, p) => { setAreaId(a); setProjectId(p) }}
          showArea={showArea}
          onToggleArea={setShowArea}
        />
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
  onWhenDateChange,
  deadline,
  onDeadlineChange,
  highPriority,
  onToggleHighPriority,
  onSetHighPriority,
  showNotes,
  onToggleNotes,
  showWhen,
  onToggleWhen,
  showDeadline,
  onToggleDeadline,
  tagIds,
  onTagIdsChange,
  showTags,
  onToggleTags,
  areaId,
  projectId,
  onAreaProjectChange,
  showArea,
  onToggleArea,
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
  onWhenDateChange: (date: string | null) => void
  deadline: string
  onDeadlineChange: (date: string | null) => void
  highPriority: boolean
  onToggleHighPriority: () => void
  onSetHighPriority: () => void
  showNotes: boolean
  onToggleNotes: (v: boolean) => void
  showWhen: boolean
  onToggleWhen: (v: boolean) => void
  showDeadline: boolean
  onToggleDeadline: (v: boolean) => void
  tagIds: string[]
  onTagIdsChange: (ids: string[]) => void
  showTags: boolean
  onToggleTags: (v: boolean) => void
  areaId: string | null
  projectId: string | null
  onAreaProjectChange: (areaId: string | null, projectId: string | null) => void
  showArea: boolean
  onToggleArea: (v: boolean) => void
}) {
  const showToolbar = title.trim().length >= 2

  const whenDateInputRef = useRef<HTMLDivElement>(null)
  const deadlineDateInputRef = useRef<HTMLDivElement>(null)

  const handleTitleChange = useCallback((value: string) => {
    const cursorPos = inputRef.current?.selectionStart ?? value.length

    // # triggers tag picker
    if (detectHashTrigger(value, cursorPos, () => onToggleTags(true), onTitleChange)) {
      return
    }

    onTitleChange(value)
  }, [inputRef, onTitleChange, onToggleTags])

  const returnFocusToTitle = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [inputRef])

  // Alt+key shortcuts
  useDetailShortcuts({
    onToggleTags: useCallback(() => onToggleTags(true), [onToggleTags]),
    onToggleArea: useCallback(() => onToggleArea(true), [onToggleArea]),
    onToggleWhen: useCallback(() => onToggleWhen(true), [onToggleWhen]),
    onToggleDeadline: useCallback(() => onToggleDeadline(true), [onToggleDeadline]),
    onToggleNotes: useCallback(() => onToggleNotes(true), [onToggleNotes]),
    onTogglePriority: onToggleHighPriority,
    enabled: true,
  })

  // Whether tag/area rows should show
  // Tags: show when picker is open or tags have been selected
  const hasTagContent = tagIds.length > 0 || showTags
  // Area: show in the row only when an area/project is actually set, OR the picker is open
  const hasAreaContent = areaId !== null || showArea

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
      <ProjectAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} />
      <PriorityAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} onSetHighPriority={onSetHighPriority} />

      {/* Tag and area/project pickers — shown when tags triggered or have content */}
      {(hasTagContent || hasAreaContent) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-200 px-4 py-2 pl-[48px] dark:border-neutral-700">
          {hasAreaContent && (
            <AreaProjectPicker
              controlledAreaId={areaId}
              controlledProjectId={projectId}
              onControlledChange={onAreaProjectChange}
              externalOpen={showArea}
              onExternalOpenChange={onToggleArea}
              onSelect={returnFocusToTitle}
              onClose={returnFocusToTitle}
            />
          )}
          {hasAreaContent && hasTagContent && (
            <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-700" />
          )}
          {hasTagContent && (
            <TagMultiSelect
              controlledTagIds={tagIds}
              onControlledChange={onTagIdsChange}
              externalOpen={showTags}
              onExternalOpenChange={onToggleTags}
              onClose={returnFocusToTitle}
            />
          )}
        </div>
      )}

      {/* Detail sections — shown when toggled */}
      {(showNotes || showWhen || showDeadline) && (
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
                  onChange={onWhenDateChange}
                  autoFocus={!whenDate}
                  onComplete={(selected) => {
                    if (!selected) onToggleWhen(false)
                    returnFocusToTitle()
                  }}
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
                  onComplete={(selected) => {
                    if (!selected) onToggleDeadline(false)
                    returnFocusToTitle()
                  }}
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

      {/* Icon toolbar — appears after 2+ characters */}
      {showToolbar && (
        <div className="flex items-center gap-1 border-t border-neutral-200 py-2 pl-[42px] pr-4 dark:border-neutral-700">
          {!hasAreaContent && (
            <button
              onClick={() => onToggleArea(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Set area/project"
              title="Area / Project (Alt+A)"
            >
              <Folder size={16} />
            </button>
          )}
          {!hasTagContent && (
            <button
              onClick={() => onToggleTags(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Add tags"
              title="Tags (Alt+T)"
            >
              <Tag size={16} />
            </button>
          )}
          {!showNotes && (
            <button
              onClick={() => onToggleNotes(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Add notes"
              title="Notes (Alt+N)"
            >
              <StickyNote size={16} />
            </button>
          )}
          {!showWhen && (
            <button
              onClick={() => onToggleWhen(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Set when date"
              title="When (Alt+W)"
            >
              <Calendar size={16} />
            </button>
          )}
          {!showDeadline && (
            <button
              onClick={() => onToggleDeadline(true)}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              aria-label="Set deadline"
              title="Deadline (Alt+D)"
            >
              <Flag size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
