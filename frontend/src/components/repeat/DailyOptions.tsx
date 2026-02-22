import type { RecurrencePattern } from '../../api/types'

interface DailyOptionsProps {
  pattern: RecurrencePattern
  onChange: (p: RecurrencePattern) => void
}

export function DailyOptions({ pattern, onChange }: DailyOptionsProps) {
  const mode = pattern.mode
  const every = pattern.every

  function setType(type: 'daily' | 'daily_weekday' | 'daily_weekend') {
    if (type === 'daily') {
      onChange({ type: 'daily', every, mode })
    } else if (type === 'daily_weekday') {
      onChange({ type: 'daily_weekday', every: 1, mode })
    } else {
      onChange({ type: 'daily_weekend', every: 1, mode })
    }
  }

  const currentType = pattern.type as string

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="daily-type"
          checked={currentType === 'daily'}
          onChange={() => setType('daily')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">
          Every {currentType === 'daily' ? every : 1} day{(currentType === 'daily' ? every : 1) !== 1 ? 's' : ''}
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="daily-type"
          checked={currentType === 'daily_weekday'}
          onChange={() => setType('daily_weekday')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">Every weekday (Mon–Fri)</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="daily-type"
          checked={currentType === 'daily_weekend'}
          onChange={() => setType('daily_weekend')}
          className="text-red-500 focus:ring-red-400"
        />
        <span className="text-neutral-700 dark:text-neutral-300">Every weekend (Sat–Sun)</span>
      </label>
    </div>
  )
}
