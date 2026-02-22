import type {
  RecurrencePattern,
  RecurrenceMode,
  OrdinalPosition,
  DayOfWeekFull,
} from '../../api/types'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

const ORDINALS: OrdinalPosition[] = ['first', 'second', 'third', 'fourth', 'last']
const WEEKDAYS: { value: DayOfWeekFull; label: string }[] = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
]

interface YearlyOptionsProps {
  pattern: RecurrencePattern
  onChange: (p: RecurrencePattern) => void
}

type YearlySubType = 'date' | 'dow'

const selectClasses =
  'rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'

export function YearlyOptions({ pattern, onChange }: YearlyOptionsProps) {
  const every = pattern.every
  const mode = pattern.mode as RecurrenceMode
  const subType: YearlySubType = pattern.type === 'yearly_dow' ? 'dow' : 'date'

  const dateMonth = pattern.type === 'yearly_date' ? pattern.month : 1
  const dateDay = pattern.type === 'yearly_date' && pattern.day != null ? pattern.day : 1
  const dowMonth = pattern.type === 'yearly_dow' ? pattern.month : 1
  const dowOrdinal = pattern.type === 'yearly_dow' ? pattern.ordinal : 'first'
  const dowWeekday = pattern.type === 'yearly_dow' ? pattern.weekday : 'monday'

  function setSubType(st: YearlySubType) {
    if (st === 'date') {
      onChange({ type: 'yearly_date', every, mode, month: dateMonth, day: dateDay })
    } else {
      onChange({
        type: 'yearly_dow',
        every,
        mode,
        month: dowMonth,
        ordinal: dowOrdinal,
        weekday: dowWeekday,
      })
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Specific date */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="yearly-type"
          checked={subType === 'date'}
          onChange={() => setSubType('date')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">On</span>
        <select
          value={dateMonth}
          onChange={(e) =>
            onChange({
              type: 'yearly_date',
              every,
              mode,
              month: parseInt(e.target.value),
              day: dateDay,
            })
          }
          className={selectClasses}
          disabled={subType !== 'date'}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={31}
          value={dateDay}
          onChange={(e) => {
            const day = Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
            onChange({ type: 'yearly_date', every, mode, month: dateMonth, day })
          }}
          className="w-14 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          disabled={subType !== 'date'}
        />
      </label>

      {/* Nth weekday of month */}
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <input
          type="radio"
          name="yearly-type"
          checked={subType === 'dow'}
          onChange={() => setSubType('dow')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">On the</span>
        <select
          value={dowOrdinal}
          onChange={(e) =>
            onChange({
              type: 'yearly_dow',
              every,
              mode,
              month: dowMonth,
              ordinal: e.target.value as OrdinalPosition,
              weekday: dowWeekday,
            })
          }
          className={selectClasses}
          disabled={subType !== 'dow'}
        >
          {ORDINALS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={dowWeekday}
          onChange={(e) =>
            onChange({
              type: 'yearly_dow',
              every,
              mode,
              month: dowMonth,
              ordinal: dowOrdinal,
              weekday: e.target.value as DayOfWeekFull,
            })
          }
          className={selectClasses}
          disabled={subType !== 'dow'}
        >
          {WEEKDAYS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
        <span className="text-neutral-700 dark:text-neutral-300">of</span>
        <select
          value={dowMonth}
          onChange={(e) =>
            onChange({
              type: 'yearly_dow',
              every,
              mode,
              month: parseInt(e.target.value),
              ordinal: dowOrdinal,
              weekday: dowWeekday,
            })
          }
          className={selectClasses}
          disabled={subType !== 'dow'}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
