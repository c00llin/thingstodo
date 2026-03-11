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
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateCalendarProps {
  value: string | null
  onSelect: (date: string) => void
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DateCalendar({ value, onSelect }: DateCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (value && value !== 'someday') return new Date(value + 'T00:00:00')
    return new Date()
  })

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [viewMonth])

  return (
    <div className="w-[224px] p-2">
      {/* Month navigation */}
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
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
          const selected = value && value !== 'someday' && isSameDay(day, new Date(value + 'T00:00:00'))
          const today = isSameDay(day, new Date())

          return (
            <button
              key={day.toISOString()}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(format(day, 'yyyy-MM-dd'))}
              className={`h-7 w-full rounded text-xs transition-colors ${
                !inMonth
                  ? 'text-neutral-300 dark:text-neutral-700'
                  : selected
                    ? 'bg-red-500 font-medium text-white'
                    : today
                      ? 'font-medium text-red-500'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
