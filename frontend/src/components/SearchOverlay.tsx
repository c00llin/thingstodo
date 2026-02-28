import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useSearch } from '../hooks/queries'
import { getTaskContext } from '../hooks/useTaskContext'
import type { SearchResult } from '../api/types'

/** Wait for a task element to appear in the DOM, then expand and scroll to it.
 *  Retries briefly to handle page navigation + data loading delays. */
function expandAndScrollToTask(taskId: string, attempts = 0) {
  const el = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)
  if (el) {
    useAppStore.getState().expandTask(taskId)
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } else if (attempts < 20) {
    setTimeout(() => expandAndScrollToTask(taskId, attempts + 1), 100)
  }
}

export function SearchOverlay() {
  const open = useAppStore((s) => s.searchOpen)
  if (!open) return null
  return <SearchOverlayInner />
}

function SearchOverlayInner() {
  const close = useAppStore((s) => s.closeSearch)
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [rawSelectedIndex, setSelectedIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { data, isFetching } = useSearch(debouncedQuery)
  const results = useMemo(() => data?.results ?? [], [data?.results])

  // Clamp selection to valid range
  const selectedIndex = results.length > 0 ? Math.min(rawSelectedIndex, results.length - 1) : 0

  // Debounce query
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query)
      setSelectedIndex(0)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const selectResult = useCallback(
    (result: SearchResult) => {
      const task = result.task
      if (task.project_id) {
        navigate(`/project/${task.project_id}`)
      } else if (task.area_id) {
        navigate(`/area/${task.area_id}`)
      } else if (task.when_date === 'someday') {
        navigate('/someday')
      } else if (task.when_date) {
        const today = new Date().toISOString().slice(0, 10)
        navigate(task.when_date <= today ? '/today' : '/upcoming')
      } else {
        navigate('/inbox')
      }
      expandAndScrollToTask(task.id)
      close()
    },
    [navigate, close],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        selectResult(results[selectedIndex])
      }
    },
    [results, selectedIndex, selectResult, close],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[8vh] md:pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      onKeyDown={onKeyDown}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl md:mx-0 dark:bg-neutral-800">
        <div className="flex items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <Search size={16} className="shrink-0 text-neutral-400" />
          <input
            autoFocus
            type="text"
            placeholder="Search tasks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          {isFetching && (
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-transparent dark:border-neutral-600" />
          )}
        </div>

        <div className="max-h-72 overflow-y-auto p-2">
          {debouncedQuery.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              Type to search tasks
            </p>
          ) : results.length === 0 && !isFetching ? (
            <p className="px-4 py-6 text-center text-sm text-neutral-500">
              No results found.
            </p>
          ) : (
            results.map((result, i) => (
              <button
                key={result.task.id}
                className={`flex w-full cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-left ${
                  i === selectedIndex
                    ? 'bg-neutral-100 dark:bg-neutral-700'
                    : ''
                }`}
                onClick={() => selectResult(result)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span
                  className="text-sm text-neutral-700 dark:text-neutral-300 [&_mark]:bg-yellow-200 [&_mark]:text-neutral-900 dark:[&_mark]:bg-yellow-500/40 dark:[&_mark]:text-neutral-100"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeSnippet(result.title_snippet) || escapeHtml(result.task.title),
                  }}
                />
                {getTaskContext(result.task) && (
                  <span className="text-[10px] text-neutral-400">
                    {getTaskContext(result.task)}
                  </span>
                )}
                {result.notes_snippet && (
                  <span
                    className="line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400 [&_mark]:bg-yellow-200 [&_mark]:text-neutral-700 dark:[&_mark]:bg-yellow-500/40 dark:[&_mark]:text-neutral-300"
                    dangerouslySetInnerHTML={{ __html: sanitizeSnippet(result.notes_snippet) }}
                  />
                )}
              </button>
            ))
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 md:flex dark:border-neutral-700 dark:text-neutral-500">
          <span>↑↓ Navigate · Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Sanitize FTS5 snippet HTML — only allow <mark> tags, escape everything else. */
function sanitizeSnippet(snippet: string): string {
  // Split on <mark> and </mark>, escape each text segment, reassemble
  const parts: string[] = []
  let remaining = snippet
  while (remaining.length > 0) {
    const openIdx = remaining.indexOf('<mark>')
    if (openIdx === -1) {
      parts.push(escapeHtml(remaining))
      break
    }
    parts.push(escapeHtml(remaining.slice(0, openIdx)))
    remaining = remaining.slice(openIdx + 6)
    const closeIdx = remaining.indexOf('</mark>')
    if (closeIdx === -1) {
      parts.push(escapeHtml(remaining))
      break
    }
    parts.push('<mark>' + escapeHtml(remaining.slice(0, closeIdx)) + '</mark>')
    remaining = remaining.slice(closeIdx + 7)
  }
  return parts.join('')
}
