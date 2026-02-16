import { useState, useCallback, useRef, useEffect } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router'
import { useAppStore } from '../stores/app'
import { useCreateTask, useSearch } from '../hooks/queries'
import { useResolveTags } from '../hooks/useResolveTags'
import { TagAutocomplete } from './TagAutocomplete'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import type { SearchResult } from '../api/types'
import { Search, StickyNote, Calendar, Flag, X } from 'lucide-react'

type Mode = 'create' | 'search'

export function QuickEntry() {
  const open = useAppStore((s) => s.quickEntryOpen)
  const close = useAppStore((s) => s.closeQuickEntry)
  const initialValue = useAppStore((s) => s.quickEntryInitialValue)

  const [mode, setMode] = useState<Mode>('create')
  const [title, setTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Detail fields
  const [notes, setNotes] = useState('')
  const [whenDate, setWhenDate] = useState('')
  const [deadline, setDeadline] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [showWhen, setShowWhen] = useState(false)
  const [showDeadline, setShowDeadline] = useState(false)

  const createTask = useCreateTask()
  const resolveTags = useResolveTags()
  const { data: searchData } = useSearch(searchQuery)
  const navigate = useNavigate()

  const inputRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const whenRef = useRef<HTMLInputElement>(null)
  const deadlineRef = useRef<HTMLInputElement>(null)

  const searchResults: SearchResult[] = searchData?.results ?? []

  useEffect(() => {
    if (open) {
      // Only overwrite the draft when opened with a seeded value (type-to-create)
      if (initialValue) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding input with typed character
        setTitle(initialValue)
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset mode on open
      setMode('create')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset search on open
      setSearchQuery('')
    }
  }, [open, initialValue])

  // Reset detail fields when title is cleared
  useEffect(() => {
    if (title.trim().length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting sections when title cleared
      resetDetailFields()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  useEffect(() => {
    if (showWhen && whenRef.current) whenRef.current.focus()
  }, [showWhen])
  useEffect(() => {
    if (showDeadline && deadlineRef.current) deadlineRef.current.focus()
  }, [showDeadline])

  function resetDetailFields() {
    setNotes('')
    setWhenDate('')
    setDeadline('')
    setShowNotes(false)
    setShowWhen(false)
    setShowDeadline(false)
  }

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
  }, [title, notes, whenDate, deadline, resolveTags, createTask, close])

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      close()
      navigate(`/task/${result.task.id}`)
    },
    [close, navigate]
  )

  const switchToSearch = useCallback(() => {
    setMode('search')
    setSearchQuery('')
  }, [])

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
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-neutral-800">
        {mode === 'search' ? (
          <SearchMode
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            onSelect={handleSearchSelect}
            onSwitchToCreate={() => setMode('create')}
          />
        ) : (
          <CreateMode
            title={title}
            onTitleChange={setTitle}
            onSubmit={handleSubmit}
            onSwitchToSearch={switchToSearch}
            isSubmitting={createTask.isPending}
            inputRef={inputRef}
            notes={notes}
            onNotesChange={setNotes}
            notesRef={notesRef}
            whenDate={whenDate}
            onWhenDateChange={setWhenDate}
            whenRef={whenRef}
            deadline={deadline}
            onDeadlineChange={setDeadline}
            deadlineRef={deadlineRef}
            showNotes={showNotes}
            onToggleNotes={setShowNotes}
            showWhen={showWhen}
            onToggleWhen={setShowWhen}
            showDeadline={showDeadline}
            onToggleDeadline={setShowDeadline}
          />
        )}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
          <span>
            {mode === 'create' ? 'Enter to create · #tag $project' : 'Enter to open'}
          </span>
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
  onSwitchToSearch,
  isSubmitting,
  inputRef,
  notes,
  onNotesChange,
  notesRef,
  whenDate,
  onWhenDateChange,
  whenRef,
  deadline,
  onDeadlineChange,
  deadlineRef,
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
  onSwitchToSearch: () => void
  isSubmitting: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  notes: string
  onNotesChange: (v: string) => void
  notesRef: React.RefObject<HTMLTextAreaElement | null>
  whenDate: string
  onWhenDateChange: (v: string) => void
  whenRef: React.RefObject<HTMLInputElement | null>
  deadline: string
  onDeadlineChange: (v: string) => void
  deadlineRef: React.RefObject<HTMLInputElement | null>
  showNotes: boolean
  onToggleNotes: (v: boolean) => void
  showWhen: boolean
  onToggleWhen: (v: boolean) => void
  showDeadline: boolean
  onToggleDeadline: (v: boolean) => void
}) {
  const showToolbar = title.trim().length >= 2

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
          <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-neutral-300 dark:border-neutral-600" />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            placeholder="New task... (#tag $project)"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            disabled={isSubmitting}
          />
          <button
            onClick={onSwitchToSearch}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
            title="Switch to search (Alt+F)"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
      <TagAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} />
      <ProjectAutocomplete inputRef={inputRef} value={title} onChange={onTitleChange} />

      {/* Detail sections — shown when toggled */}
      {showToolbar && (showNotes || showWhen || showDeadline) && (
        <div className="space-y-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
          {showNotes && (
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full resize-none border-none bg-transparent px-0 py-0 text-sm focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              placeholder="Notes"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.stopPropagation()
              }}
            />
          )}
          {showWhen && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="shrink-0 text-neutral-400" />
              <input
                ref={whenRef}
                type="date"
                value={whenDate}
                onChange={(e) => onWhenDateChange(e.target.value)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              />
              {whenDate && (
                <button
                  onClick={() => { onWhenDateChange(''); onToggleWhen(false) }}
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
              <input
                ref={deadlineRef}
                type="date"
                value={deadline}
                onChange={(e) => onDeadlineChange(e.target.value)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              />
              {deadline && (
                <button
                  onClick={() => { onDeadlineChange(''); onToggleDeadline(false) }}
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
        <div className="flex items-center gap-1 border-t border-neutral-200 px-4 py-2 dark:border-neutral-700">
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

function SearchMode({
  query,
  onQueryChange,
  results,
  onSelect,
  onSwitchToCreate,
}: {
  query: string
  onQueryChange: (v: string) => void
  results: SearchResult[]
  onSelect: (result: SearchResult) => void
  onSwitchToCreate: () => void
}) {
  return (
    <Command label="Search tasks" className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <Search size={18} className="text-neutral-400" />
        <Command.Input
          autoFocus
          placeholder="Search tasks..."
          value={query}
          onValueChange={onQueryChange}
          className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
        <button
          onClick={onSwitchToCreate}
          className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          New task
        </button>
      </div>

      <Command.List className="max-h-72 overflow-y-auto p-2">
        <Command.Empty className="px-4 py-8 text-center text-sm text-neutral-400">
          {query.length === 0
            ? 'Start typing to search...'
            : 'No tasks found.'}
        </Command.Empty>

        {results.map((result) => (
          <Command.Item
            key={result.task.id}
            value={result.task.title}
            onSelect={() => onSelect(result)}
            className="flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-sm aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-700"
          >
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {result.title_snippet || result.task.title}
            </span>
            {result.notes_snippet && (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {result.notes_snippet}
              </span>
            )}
          </Command.Item>
        ))}
      </Command.List>
    </Command>
  )
}
