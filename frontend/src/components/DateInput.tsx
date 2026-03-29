import { useState, useRef, useEffect, useCallback } from 'react'
import { format, addDays, addMonths, nextMonday, startOfMonth } from 'date-fns'
import { Calendar } from 'lucide-react'
import { parseNaturalDate } from '../lib/date-parser'
import { formatRelativeDate } from '../lib/format-date'
import { DateCalendar } from './DateCalendar'

interface DateInputProps {
  value: string
  onChange: (date: string | null) => void
  variant: 'when' | 'deadline'
  autoFocus?: boolean
  /** Called after a selection or dismissal. Receives the current value (null if cleared/dismissed). */
  onComplete?: (selectedValue: string | null) => void
  /** Hide the "Someday" option from suggestions */
  hideSomeday?: boolean
  /** Extra classes applied to the button/input field */
  fieldClassName?: string
  /** Direction for the dropdown/calendar to open. Default is 'down'. */
  dropdownPosition?: 'up' | 'down'
}

interface Suggestion {
  label: string
  detail?: string
  date: string | null
}


function getDefaultSuggestions(variant: 'when' | 'deadline'): Suggestion[] {
  const today = new Date()
  const todayISO = format(today, 'yyyy-MM-dd')
  const tomorrowISO = format(addDays(today, 1), 'yyyy-MM-dd')
  const nextWeekISO = format(nextMonday(today), 'yyyy-MM-dd')

  if (variant === 'when') {
    return [
      { label: 'Today', detail: format(today, 'EEE, MMM d'), date: todayISO },
      { label: 'Tomorrow', detail: format(addDays(today, 1), 'EEE, MMM d'), date: tomorrowISO },
      { label: 'Next Week', detail: format(nextMonday(today), 'EEE, MMM d'), date: nextWeekISO },
      { label: 'Someday', date: 'someday' },
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
  }
}

export function DateInput({ value, onChange, variant, autoFocus, onComplete, hideSomeday, fieldClassName, dropdownPosition = 'down' }: DateInputProps) {
  const [active, setActive] = useState(false)
  const [text, setText] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [showCalendar, setShowCalendar] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions: Suggestion[] = (() => {
    let defaults = getDefaultSuggestions(variant)
    if (hideSomeday) defaults = defaults.filter((s) => s.date !== 'someday')
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
        (s) => s.date === typed.date
      )
      if (!alreadyPresent) {
        filtered.push(typed)
      }
    }

    return filtered
  })()

  const select = useCallback((s: Suggestion) => {
    onChange(s.date)
    setActive(false)
    setText('')
    setShowCalendar(false)
    inputRef.current?.blur()
    onComplete?.(s.date)
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
        setShowCalendar(false)
        onComplete?.(value || null)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [active, onComplete, value])

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
      setShowCalendar(false)
      inputRef.current?.blur()
      onComplete?.(value || null)
    }
  }

  function handleContainerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape' && (active || showCalendar)) {
      e.preventDefault()
      e.stopPropagation()
      setActive(false)
      setText('')
      setShowCalendar(false)
      inputRef.current?.blur()
      onComplete?.(value || null)
    }
  }

  // Display mode: show friendly text when not active
  if (!active && value) {
    return (
      <div ref={containerRef} className="relative" onKeyDown={handleContainerKeyDown}>
        <div className={`flex w-full items-center rounded-md border text-sm ${fieldClassName ?? 'border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'}`}>
          <button
            type="button"
            onClick={() => {
              setShowCalendar(false)
              setActive(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            className="flex-1 px-2 py-1 text-left"
          >
            {formatRelativeDate(value)}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCalendar(true)
              setActive(true)
            }}
            className="px-1.5 py-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label="Open calendar"
          >
            <Calendar size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleContainerKeyDown}>
      <div className="flex items-center rounded-md border border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800 focus-within:border-red-400">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setShowCalendar(false) }}
          onFocus={() => setActive(true)}
          onKeyDown={handleKeyDown}
          placeholder={variant === 'when' ? 'When...' : 'Deadline...'}
          className="flex-1 bg-transparent px-2 py-1 text-sm focus:outline-none dark:text-neutral-100"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setActive(true)
            setShowCalendar((v) => !v)
            requestAnimationFrame(() => inputRef.current?.focus())
          }}
          className="px-1.5 py-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          aria-label="Open calendar"
        >
          <Calendar size={14} />
        </button>
      </div>

      {active && !showCalendar && suggestions.length > 0 && (
        <div className={`absolute left-0 z-50 min-w-[200px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800 ${dropdownPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
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

      {active && showCalendar && (
        <div className={`absolute left-0 z-50 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-800 ${dropdownPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <DateCalendar
            value={value}
            onSelect={(date) => select({ label: '', date })}
          />
        </div>
      )}
    </div>
  )
}
