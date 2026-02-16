import { useState, useCallback, useRef, useEffect } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router'
import { useAppStore } from '../stores/app'
import { useCreateTask, useSearch } from '../hooks/queries'
import { useResolveTags } from '../hooks/useResolveTags'
import { TagAutocomplete } from './TagAutocomplete'
import { ProjectAutocomplete } from './ProjectAutocomplete'
import type { SearchResult } from '../api/types'
import { Search } from 'lucide-react'

type Mode = 'create' | 'search'

export function QuickEntry() {
  const open = useAppStore((s) => s.quickEntryOpen)
  const close = useAppStore((s) => s.closeQuickEntry)
  const initialValue = useAppStore((s) => s.quickEntryInitialValue)

  const [mode, setMode] = useState<Mode>('create')
  const [title, setTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const createTask = useCreateTask()
  const resolveTags = useResolveTags()
  const { data: searchData } = useSearch(searchQuery)
  const navigate = useNavigate()

  const inputRef = useRef<HTMLInputElement>(null)

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

  // Place cursor at end of value when popup opens
  useEffect(() => {
    if (open && inputRef.current) {
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [open])

  const handleSubmit = useCallback(async () => {
    const raw = title.trim()
    if (!raw) return

    const { title: parsedTitle, tagIds, projectId, areaId } = await resolveTags(raw)
    if (!parsedTitle) return

    createTask.mutate(
      {
        title: parsedTitle,
        tag_ids: tagIds.length > 0 ? tagIds : undefined,
        project_id: projectId ?? undefined,
        area_id: areaId ?? undefined,
      },
      {
        onSuccess: () => {
          setTitle('')
          close()
        },
      }
    )
  }, [title, resolveTags, createTask, close])

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
}: {
  title: string
  onTitleChange: (v: string) => void
  onSubmit: () => void
  onSwitchToSearch: () => void
  isSubmitting: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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
