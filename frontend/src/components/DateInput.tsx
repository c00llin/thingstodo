import { useState, useRef, useEffect, useCallback } from 'react'
import { format, addDays, addMonths, nextMonday, startOfMonth } from 'date-fns'
import { parseNaturalDate } from '../lib/date-parser'
import { formatRelativeDate } from '../lib/format-date'

interface DateInputProps {
  value: string
  evening?: boolean
  onChange: (date: string | null, evening?: boolean) => void
  variant: 'when' | 'deadline'
  autoFocus?: boolean
  onComplete?: () => void
}

interface Suggestion {
  label: string
  detail?: string
  date: string | null
  evening?: boolean
}


function getDefaultSuggestions(variant: 'when' | 'deadline'): Suggestion[] {
  const today = new Date()
  const todayISO = format(today, 'yyyy-MM-dd')
  const tomorrowISO = format(addDays(today, 1), 'yyyy-MM-dd')
  const nextWeekISO = format(nextMonday(today), 'yyyy-MM-dd')

  if (variant === 'when') {
    return [
      { label: 'Today', detail: format(today, 'EEE, MMM d'), date: todayISO },
      { label: 'This Evening', detail: format(today, 'EEE, MMM d'), date: todayISO, evening: true },
      { label: 'Tomorrow', detail: format(addDays(today, 1), 'EEE, MMM d'), date: tomorrowISO },
      { label: 'Next Week', detail: format(nextMonday(today), 'EEE, MMM d'), date: nextWeekISO },
      { label: 'Someday', date: null },
    ]
  }

  return [
    { label: 'Today', detail: format(today, 'EEE, MMM d'), date: todayISO },
    { label: 'Tomorrow', detail: format(addDays(today, 1), 'EEE, MMM d'), date: tomorrowISO },
    { label: 'Next Week', detail: format(nextMonday(today), 'EEE, MMM d'), date: nextWeekISO },
    { label: 'Next Month', detail: format(startOfMonth(addMonths(today, 1)), 'EEE, MMM d'), date: format(startOfMonth(addMonths(today, 1)), 'yyyy-MM-dd') },
  ]
}

function getTypedSuggestion(text: string): Suggestion | null {
  const parsed = parseNaturalDate(text)
  if (!parsed) return null
  const d = new Date(parsed.date + 'T00:00:00')
  return {
    label: text.charAt(0).toUpperCase() + text.slice(1),
    detail: format(d, 'EEE, MMM d, yyyy'),
    date: parsed.date,
    evening: parsed.evening || undefined,
  }
}

export function DateInput({ value, evening, onChange, variant, autoFocus, onComplete }: DateInputProps) {
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions: Suggestion[] = (() => {
    const defaults = getDefaultSuggestions(variant)
    const query = text.trim().toLowerCase()
    if (!query) return defaults

    // Filter default suggestions by partial label match
    const filtered = defaults.filter((s) =>
      s.label.toLowerCase().includes(query)
    )

    // Try parsing as a natural date for a custom suggestion
    const typed = getTypedSuggestion(query)
    if (typed) {
      // Add parsed result if it's not already represented in filtered defaults
      const alreadyPresent = filtered.some(
        (s) => s.date === typed.date && (s.evening ?? false) === (typed.evening ?? false)
      )
      if (!alreadyPresent) {
        filtered.push(typed)
      }
    }

    return filtered
  })()

  const select = useCallback((s: Suggestion) => {
    onChange(s.date, s.evening)
    setActive(false)
    setText('')
    inputRef.current?.blur()
    onComplete?.()
  }, [onChange, onComplete])

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Close on click outside
  useEffect(() => {
    if (!active) return
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(false)
        setText('')
        onComplete?.()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [active, onComplete])

  // Reset highlight when text changes
  // eslint-disable-next-line react-hooks/set-state-in-effect -- derived reset, not cascading
  useEffect(() => { setHighlightIndex(0) }, [text])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!active) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (suggestions[highlightIndex]) {
        select(suggestions[highlightIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setActive(false)
      setText('')
      inputRef.current?.blur()
      onComplete?.()
    }
  }

  // Display mode: show friendly text when not active
  if (!active && value) {
    return (
      <button
        type="button"
        onClick={() => {
          setActive(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-left text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
      >
        {formatRelativeDate(value, evening)}
      </button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setActive(true)}
        onKeyDown={handleKeyDown}
        placeholder={variant === 'when' ? 'When...' : 'Deadline...'}
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        autoFocus={autoFocus}
      />

      {active && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === highlightIndex
                  ? 'bg-red-50 text-neutral-900 dark:bg-red-900/20 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                select(s)
              }}
            >
              <span>{s.label}</span>
              {s.detail && (
                <span className="ml-3 text-xs text-neutral-400">{s.detail}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
