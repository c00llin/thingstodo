import type { RecurrencePattern, DayOfWeek, WeeklyPattern } from '../../api/types'

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

interface WeeklyOptionsProps {
  pattern: RecurrencePattern
  onChange: (p: RecurrencePattern) => void
}

export function WeeklyOptions({ pattern, onChange }: WeeklyOptionsProps) {
  const wp = pattern as WeeklyPattern
  const selected = wp.on ?? []

  function toggleDay(day: DayOfWeek) {
    const next = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day]
    onChange({ ...wp, on: next })
  }

  return (
    <div className="flex items-center gap-1">
      {DAYS.map((day) => (
        <button
          key={day.value}
          onClick={() => toggleDay(day.value)}
          className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
            selected.includes(day.value)
              ? 'bg-red-500 text-white'
              : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
          }`}
        >
          {day.label}
        </button>
      ))}
    </div>
  )
}
