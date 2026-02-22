import type {
  RecurrencePattern,
  RecurrenceMode,
  OrdinalPosition,
  DayOfWeekFull,
  WorkdayPosition,
} from '../../api/types'

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

interface MonthlyOptionsProps {
  pattern: RecurrencePattern
  onChange: (p: RecurrencePattern) => void
}

type MonthlySubType = 'dom' | 'dom_last' | 'dow' | 'workday'

function getSubType(pattern: RecurrencePattern): MonthlySubType {
  if (pattern.type === 'monthly_dow') return 'dow'
  if (pattern.type === 'monthly_workday') return 'workday'
  if (pattern.type === 'monthly_dom' && 'day' in pattern && pattern.day === 0) return 'dom_last'
  return 'dom'
}

const selectClasses =
  'rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'

export function MonthlyOptions({ pattern, onChange }: MonthlyOptionsProps) {
  const every = pattern.every
  const mode = pattern.mode as RecurrenceMode
  const subType = getSubType(pattern)

  const domDay = pattern.type === 'monthly_dom' && pattern.day != null && pattern.day > 0 ? pattern.day : 15
  const dowOrdinal = pattern.type === 'monthly_dow' ? pattern.ordinal : 'first'
  const dowWeekday = pattern.type === 'monthly_dow' ? pattern.weekday : 'monday'
  const workdayPos = pattern.type === 'monthly_workday' ? pattern.workday_position : 'first'

  function setSubType(st: MonthlySubType) {
    switch (st) {
      case 'dom':
        onChange({ type: 'monthly_dom', every, mode, day: domDay })
        break
      case 'dom_last':
        onChange({ type: 'monthly_dom', every, mode, day: 0 })
        break
      case 'dow':
        onChange({ type: 'monthly_dow', every, mode, ordinal: dowOrdinal, weekday: dowWeekday })
        break
      case 'workday':
        onChange({ type: 'monthly_workday', every, mode, workday_position: workdayPos })
        break
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Specific day of month */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="monthly-type"
          checked={subType === 'dom'}
          onChange={() => setSubType('dom')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">On day</span>
        <input
          type="number"
          min={1}
          max={31}
          value={domDay}
          onChange={(e) => {
            const day = Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
            onChange({ type: 'monthly_dom', every, mode, day })
          }}
          className="w-14 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          disabled={subType !== 'dom'}
        />
      </label>

      {/* Last day of month */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="monthly-type"
          checked={subType === 'dom_last'}
          onChange={() => setSubType('dom_last')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">On the last day</span>
      </label>

      {/* Nth weekday */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="monthly-type"
          checked={subType === 'dow'}
          onChange={() => setSubType('dow')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">On the</span>
        <select
          value={dowOrdinal}
          onChange={(e) =>
            onChange({
              type: 'monthly_dow',
              every,
              mode,
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
              type: 'monthly_dow',
              every,
              mode,
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
      </label>

      {/* First/last workday */}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="monthly-type"
          checked={subType === 'workday'}
          onChange={() => setSubType('workday')}
          className="text-red-500 focus:ring-red-400"
        />
        <select
          value={workdayPos}
          onChange={(e) =>
            onChange({
              type: 'monthly_workday',
              every,
              mode,
              workday_position: e.target.value as WorkdayPosition,
            })
          }
          className={selectClasses}
          disabled={subType !== 'workday'}
        >
          <option value="first">First</option>
          <option value="last">Last</option>
        </select>
        <span className="text-neutral-700 dark:text-neutral-300">workday</span>
      </label>
    </div>
  )
}
