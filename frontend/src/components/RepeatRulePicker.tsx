import { useState } from 'react'
import type { RepeatRule, RepeatFrequency, RepeatMode, DayConstraint } from '../api/types'
import { useUpsertRepeatRule, useDeleteRepeatRule } from '../hooks/queries'

const DAYS: { value: DayConstraint; label: string }[] = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

interface RepeatRulePickerProps {
  taskId: string
  existingRule: RepeatRule | null
  onClose: () => void
}

export function RepeatRulePicker({ taskId, existingRule, onClose }: RepeatRulePickerProps) {
  const [frequency, setFrequency] = useState<RepeatFrequency>(existingRule?.frequency ?? 'daily')
  const [intervalValue, setIntervalValue] = useState(existingRule?.interval_value ?? 1)
  const [mode, setMode] = useState<RepeatMode>(existingRule?.mode ?? 'fixed')
  const [dayConstraints, setDayConstraints] = useState<DayConstraint[]>(existingRule?.day_constraints ?? [])

  const upsertRepeatRule = useUpsertRepeatRule(taskId)
  const deleteRepeatRule = useDeleteRepeatRule(taskId)

  function handleFrequencyChange(value: RepeatFrequency) {
    setFrequency(value)
    if (value !== 'weekly') {
      setDayConstraints([])
    }
  }

  function toggleDay(day: DayConstraint) {
    setDayConstraints((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  function handleSave() {
    upsertRepeatRule.mutate({
      frequency,
      interval_value: intervalValue,
      mode,
      day_constraints: frequency === 'weekly' ? dayConstraints : [],
    })
    onClose()
  }

  function handleDelete() {
    deleteRepeatRule.mutate()
    onClose()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">Every</span>
        <input
          type="number"
          min={1}
          max={999}
          value={intervalValue}
          onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-16 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <select
          value={frequency}
          onChange={(e) => handleFrequencyChange(e.target.value as RepeatFrequency)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="daily">{intervalValue === 1 ? 'day' : 'days'}</option>
          <option value="weekly">{intervalValue === 1 ? 'week' : 'weeks'}</option>
          <option value="monthly">{intervalValue === 1 ? 'month' : 'months'}</option>
          <option value="yearly">{intervalValue === 1 ? 'year' : 'years'}</option>
        </select>
      </div>

      {frequency === 'weekly' && (
        <div className="flex items-center gap-1">
          {DAYS.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                dayConstraints.includes(day.value)
                  ? 'bg-red-500 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as RepeatMode)}
          className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          <option value="fixed">Fixed schedule</option>
          <option value="after_completion">After completion</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="rounded-md bg-red-500 px-3 py-1 text-sm font-medium text-white hover:bg-red-600"
        >
          Save
        </button>
        {existingRule && (
          <button
            onClick={handleDelete}
            className="rounded-md px-3 py-1 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Remove
          </button>
        )}
        <button
          onClick={onClose}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
