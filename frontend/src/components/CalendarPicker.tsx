import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DateFilter } from '../stores/filters'

interface CalendarPickerProps {
  value: DateFilter | null
  onChange: (filter: DateFilter | null) => void
  presets: { label: string; value: DateFilter }[]
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function CalendarPicker({ value, onChange, presets }: CalendarPickerProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (value?.type === 'specific' && value.date) return new Date(value.date + 'T00:00:00')
    if (value?.type === 'range' && value.start) return new Date(value.start + 'T00:00:00')
    return new Date()
  })
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [viewMonth])

  const activePreset = value?.type === 'preset' ? value.preset : null

  function isSelected(day: Date): boolean {
    if (!value) return false
    if (value.type === 'specific' && value.date) {
      return isSameDay(day, new Date(value.date + 'T00:00:00'))
    }
    if (value.type === 'range' && value.start && value.end) {
      return isWithinInterval(day, {
        start: new Date(value.start + 'T00:00:00'),
        end: new Date(value.end + 'T00:00:00'),
      })
    }
    return false
  }

  function isInDragRange(day: Date): boolean {
    if (!rangeStart || !hoverDate) return false
    const start = isBefore(rangeStart, hoverDate) ? rangeStart : hoverDate
    const end = isAfter(rangeStart, hoverDate) ? rangeStart : hoverDate
    return isWithinInterval(day, { start, end })
  }

  function handleDayClick(day: Date) {
    const iso = format(day, 'yyyy-MM-dd')
    if (rangeStart) {
      const start = isBefore(rangeStart, day) ? rangeStart : day
      const end = isAfter(rangeStart, day) ? rangeStart : day
      onChange({
        type: 'range',
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      })
      setRangeStart(null)
      setHoverDate(null)
    } else if (value?.type === 'specific' && value.date === iso) {
      // Clicking the same date starts range mode
      setRangeStart(day)
    } else {
      onChange({ type: 'specific', date: iso })
    }
  }

  return (
    <div className="w-64">
      {/* Presets */}
      <div className="mb-2 flex flex-wrap gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setRangeStart(null)
              onChange(activePreset === p.value.preset ? null : p.value)
            }}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              activePreset === p.value.preset
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Month navigation */}
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-neutral-400">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const selected = isSelected(day)
          const inRange = isInDragRange(day)
          const today = isSameDay(day, new Date())

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => rangeStart && setHoverDate(day)}
              className={`h-7 w-full rounded text-xs transition-colors ${
                !inMonth
                  ? 'text-neutral-300 dark:text-neutral-700'
                  : selected
                    ? 'bg-red-500 font-medium text-white'
                    : inRange
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : today
                        ? 'font-medium text-red-500'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Clear */}
      {value && (
        <button
          onClick={() => { onChange(null); setRangeStart(null) }}
          className="mt-2 w-full text-center text-xs text-neutral-400 hover:text-red-500"
        >
          Clear selection
        </button>
      )}
    </div>
  )
}
