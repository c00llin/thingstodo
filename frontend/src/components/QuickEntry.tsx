import { useState, useCallback, useRef, useEffect } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router'
import { useAppStore } from '../stores/app'
import { useCreateTask, useProjects, useTags, useSearch } from '../hooks/queries'
import type { SearchResult } from '../api/types'
import { Calendar, Tag, FolderOpen, Search } from 'lucide-react'

type Mode = 'create' | 'search'

export function QuickEntry() {
  const open = useAppStore((s) => s.quickEntryOpen)
  const close = useAppStore((s) => s.closeQuickEntry)

  const [mode, setMode] = useState<Mode>('create')
  const [title, setTitle] = useState('')
  const [whenDate, setWhenDate] = useState('')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const createTask = useCreateTask()
  const { data: projectsData } = useProjects()
  const { data: tagsData } = useTags()
  const { data: searchData } = useSearch(searchQuery)
  const navigate = useNavigate()

  const titleRef = useRef<HTMLInputElement>(null)

  const projects = projectsData?.projects ?? []
  const tags = tagsData?.tags ?? []
  const searchResults: SearchResult[] = searchData?.results ?? []

  useEffect(() => {
    if (!open) {
      setTitle('')
      setWhenDate('')
      setProjectId(null)
      setSelectedTagIds([])
      setSearchQuery('')
      setMode('create')
    }
  }, [open])

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return

    createTask.mutate(
      {
        title: title.trim(),
        when_date: whenDate || undefined,
        project_id: projectId,
        tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      },
      {
        onSuccess: () => {
          close()
        },
      }
    )
  }, [title, whenDate, projectId, selectedTagIds, createTask, close])

  const handleSearchSelect = useCallback(
    (result: SearchResult) => {
      close()
      navigate(`/task/${result.task.id}`)
    },
    [close, navigate]
  )

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }, [])

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
            whenDate={whenDate}
            onWhenDateChange={setWhenDate}
            projectId={projectId}
            onProjectChange={setProjectId}
            selectedTagIds={selectedTagIds}
            onToggleTag={toggleTag}
            projects={projects}
            tags={tags}
            onSubmit={handleSubmit}
            onSwitchToSearch={switchToSearch}
            isSubmitting={createTask.isPending}
            titleRef={titleRef}
          />
        )}
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
          <span>
            {mode === 'create' ? 'Enter to create' : 'Enter to open'}
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
  whenDate,
  onWhenDateChange,
  projectId,
  onProjectChange,
  selectedTagIds,
  onToggleTag,
  projects,
  tags,
  onSubmit,
  onSwitchToSearch,
  isSubmitting,
  titleRef,
}: {
  title: string
  onTitleChange: (v: string) => void
  whenDate: string
  onWhenDateChange: (v: string) => void
  projectId: string | null
  onProjectChange: (v: string | null) => void
  selectedTagIds: string[]
  onToggleTag: (id: string) => void
  projects: { id: string; title: string }[]
  tags: { id: string; title: string }[]
  onSubmit: () => void
  onSwitchToSearch: () => void
  isSubmitting: boolean
  titleRef: React.RefObject<HTMLInputElement | null>
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
            ref={titleRef}
            autoFocus
            type="text"
            placeholder="New task..."
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

      <div className="flex flex-wrap gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-700">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-neutral-400" />
          <input
            type="date"
            value={whenDate}
            onChange={(e) => onWhenDateChange(e.target.value)}
            className="rounded border border-neutral-200 bg-transparent px-2 py-1 text-xs text-neutral-600 outline-none focus:border-red-400 dark:border-neutral-600 dark:text-neutral-300"
            disabled={isSubmitting}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <FolderOpen size={14} className="text-neutral-400" />
          <select
            value={projectId ?? ''}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className="rounded border border-neutral-200 bg-transparent px-2 py-1 text-xs text-neutral-600 outline-none focus:border-red-400 dark:border-neutral-600 dark:text-neutral-300 dark:bg-neutral-800"
            disabled={isSubmitting}
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <Tag size={14} className="text-neutral-400" />
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => onToggleTag(tag.id)}
                className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-600'
                }`}
                disabled={isSubmitting}
              >
                {tag.title}
              </button>
            ))}
          </div>
        </div>
      </div>
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
