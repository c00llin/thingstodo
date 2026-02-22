import { useState } from 'react'
import type { RepeatRule, RecurrencePattern, RecurrenceMode } from '../api/types'
import { useUpsertRepeatRule, useDeleteRepeatRule } from '../hooks/queries'
import { DailyOptions } from './repeat/DailyOptions'
import { WeeklyOptions } from './repeat/WeeklyOptions'
import { MonthlyOptions } from './repeat/MonthlyOptions'
import { YearlyOptions } from './repeat/YearlyOptions'

type FrequencyClass = 'daily' | 'weekly' | 'monthly' | 'yearly'

function frequencyClassFromType(type: string): FrequencyClass {
  if (type.startsWith('daily')) return 'daily'
  if (type.startsWith('weekly')) return 'weekly'
  if (type.startsWith('monthly')) return 'monthly'
  if (type.startsWith('yearly')) return 'yearly'
  return 'daily'
}

function defaultPatternForClass(cls: FrequencyClass, every: number, mode: RecurrenceMode): RecurrencePattern {
  switch (cls) {
    case 'daily':
      return { type: 'daily', every, mode }
    case 'weekly':
      return { type: 'weekly', every, mode, on: [] }
    case 'monthly':
      return { type: 'monthly_dom', every, mode }
    case 'yearly':
      return { type: 'yearly_date', every, mode, month: new Date().getMonth() + 1 }
  }
}

function patternFromExistingRule(rule: RepeatRule | null): RecurrencePattern {
  if (rule?.pattern) return rule.pattern
  return { type: 'daily', every: 1, mode: 'fixed' }
}

interface RepeatRulePickerProps {
  taskId: string
  existingRule: RepeatRule | null
  onClose: () => void
}

export function RepeatRulePicker({ taskId, existingRule, onClose }: RepeatRulePickerProps) {
  const [draft, setDraft] = useState<RecurrencePattern>(() => patternFromExistingRule(existingRule))

  const upsertRepeatRule = useUpsertRepeatRule(taskId)
  const deleteRepeatRule = useDeleteRepeatRule(taskId)

  const freqClass = frequencyClassFromType(draft.type)

  function handleFrequencyClassChange(cls: FrequencyClass) {
    if (cls !== freqClass) {
      setDraft(defaultPatternForClass(cls, draft.every, draft.mode))
    }
  }

  function handleEveryChange(value: number) {
    setDraft((prev) => ({ ...prev, every: Math.max(1, value) }))
  }

  function handleModeChange(mode: RecurrenceMode) {
    setDraft((prev) => ({ ...prev, mode }))
  }

  function handleSave() {
    upsertRepeatRule.mutate({ pattern: draft })
    onClose()
  }

  function handleDelete() {
    deleteRepeatRule.mutate()
    onClose()
  }

  const inputClasses =
    'w-16 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'
  const selectClasses =
    'rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'

  return (
    <div className="space-y-3">
      {/* Top row: interval + frequency class */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">Every</span>
        <input
          type="number"
          min={1}
          max={999}
          value={draft.every}
          onChange={(e) => handleEveryChange(parseInt(e.target.value) || 1)}
          className={inputClasses}
        />
        <select
          value={freqClass}
          onChange={(e) => handleFrequencyClassChange(e.target.value as FrequencyClass)}
          className={selectClasses}
        >
          <option value="daily">{draft.every === 1 ? 'day' : 'days'}</option>
          <option value="weekly">{draft.every === 1 ? 'week' : 'weeks'}</option>
          <option value="monthly">{draft.every === 1 ? 'month' : 'months'}</option>
          <option value="yearly">{draft.every === 1 ? 'year' : 'years'}</option>
        </select>
      </div>

      {/* Contextual sub-options */}
      {freqClass === 'daily' && <DailyOptions pattern={draft} onChange={setDraft} />}
      {freqClass === 'weekly' && <WeeklyOptions pattern={draft} onChange={setDraft} />}
      {freqClass === 'monthly' && <MonthlyOptions pattern={draft} onChange={setDraft} />}
      {freqClass === 'yearly' && <YearlyOptions pattern={draft} onChange={setDraft} />}

      {/* Mode selector */}
      <div className="flex items-center gap-2">
        <select
          value={draft.mode}
          onChange={(e) => handleModeChange(e.target.value as RecurrenceMode)}
          className={selectClasses}
        >
          <option value="fixed">Fixed schedule</option>
          <option value="after_completion">After completion</option>
        </select>
      </div>

      {/* Action buttons */}
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
