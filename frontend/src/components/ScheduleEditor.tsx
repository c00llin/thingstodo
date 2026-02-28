import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { Calendar, Plus, Trash2, X, Clock, Check } from 'lucide-react'
import { DateInput } from './DateInput'
import { TimeInput, type TimeInputHandle } from './TimeInput'
import {
  useCreateTaskSchedule,
  useUpdateTaskSchedule,
  useDeleteTaskSchedule,
  queryKeys,
} from '../hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import type { TaskSchedule } from '../api/types'
import { reorderSchedules } from '../api/schedules'
import { formatRelativeDate } from '../lib/format-date'

interface ScheduleEditorProps {
  taskId: string
  schedules: TaskSchedule[]
  whenEvening: boolean
  timeFormat: '12h' | '24h'
  defaultTimeGap: number
  hasRepeatRule: boolean
  onWhenDateChange: (date: string | null, evening?: boolean) => void
  onClearWhen: () => void
  /** Ref for the first DateInput (for @-trigger focus) */
  whenDateInputRef?: React.RefObject<HTMLDivElement | null>
  autoFocusFirst?: boolean
  onComplete?: () => void
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const nh = Math.min(Math.floor(total / 60), 23)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

export function ScheduleEditor({
  taskId,
  schedules,
  whenEvening,
  timeFormat,
  defaultTimeGap,
  hasRepeatRule,
  onWhenDateChange,
  onClearWhen,
  whenDateInputRef,
  autoFocusFirst,
  onComplete,
}: ScheduleEditorProps) {
  const createSchedule = useCreateTaskSchedule(taskId)
  const updateSchedule = useUpdateTaskSchedule(taskId)
  const deleteSchedule = useDeleteTaskSchedule(taskId)
  const queryClient = useQueryClient()

  // Refs to imperatively focus start/end-time inputs, keyed by entry id
  const startTimeRefs = useRef<Record<string, TimeInputHandle | null>>({})
  const endTimeRefs = useRef<Record<string, TimeInputHandle | null>>({})

  // After a date is selected, auto-focus the start time input for that entry
  const [focusStartTimeId, setFocusStartTimeId] = useState<string | null>(null)

  useEffect(() => {
    if (focusStartTimeId) {
      startTimeRefs.current[focusStartTimeId]?.focus()
      setFocusStartTimeId(null)
    }
  }, [focusStartTimeId])

  const [timeError, setTimeError] = useState<string | null>(null)

  // Auto-clear error message after 3 seconds
  useEffect(() => {
    if (timeError) {
      const timer = setTimeout(() => setTimeError(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [timeError])

  // Keep a ref with latest schedules & taskId so the unmount cleanup isn't stale
  const schedulesRef = useRef(schedules)
  const taskIdRef = useRef(taskId)
  schedulesRef.current = schedules
  taskIdRef.current = taskId

  // Sort schedule entries by date/time ascending when the editor unmounts (detail closes)
  useEffect(() => {
    return () => {
      const current = schedulesRef.current
      if (current.length <= 1) return

      const sorted = [...current].sort((a, b) => {
        // 'someday' sorts last
        if (a.when_date === 'someday' && b.when_date !== 'someday') return 1
        if (b.when_date === 'someday' && a.when_date !== 'someday') return -1
        // Compare dates
        if (a.when_date !== b.when_date) return a.when_date < b.when_date ? -1 : 1
        // Same date — compare start times (null sorts last)
        const at = a.start_time ?? '\xff'
        const bt = b.start_time ?? '\xff'
        if (at !== bt) return at < bt ? -1 : 1
        return 0
      })

      // Check if order actually changed
      const needsReorder = sorted.some((s, i) => s.id !== current[i].id)
      if (!needsReorder) return

      const items = sorted.map((s, i) => ({ id: s.id, sort_order: i }))
      reorderSchedules(taskIdRef.current, items).then(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskIdRef.current) })
        queryClient.invalidateQueries({ queryKey: ['views'] })
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-focus the new entry's DateInput when an entry is added
  const prevCountRef = useRef(schedules.length)
  const dateInputRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (schedules.length > prevCountRef.current && schedules.length > 1) {
      // A new entry was added — click the last entry's DateInput button to activate it
      const lastEntry = schedules[schedules.length - 1]
      const container = dateInputRefs.current[lastEntry.id]
      if (container) {
        const btn = container.querySelector('button')
        if (btn) btn.click()
      }
    }
    prevCountRef.current = schedules.length
  }, [schedules])

  const firstEntry = schedules[0]
  const isSomeday = firstEntry?.when_date === 'someday'
  const canAdd = !isSomeday && !hasRepeatRule && schedules.length < 12

  // Measure the widest date label so all rows align their time fields
  const dateLabels = useMemo(
    () => schedules.map((e, i) => formatRelativeDate(e.when_date, i === 0 ? whenEvening : undefined)),
    [schedules, whenEvening],
  )
  const measureRef = useRef<HTMLSpanElement>(null)
  const [dateMinWidth, setDateMinWidth] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    if (!measureRef.current || dateLabels.length <= 1) {
      setDateMinWidth(undefined)
      return
    }
    const el = measureRef.current
    let max = 0
    for (const label of dateLabels) {
      el.textContent = label
      max = Math.max(max, el.scrollWidth)
    }
    // Add padding (px-2 = 16px) + border (2px) to match DateInput button sizing
    setDateMinWidth(max + 18)
  }, [dateLabels])

  function handleAddEntry() {
    // Pick the next date that doesn't already have a timeless entry
    const timelessDates = new Set(
      schedules.filter((s) => !s.start_time && s.when_date !== 'someday').map((s) => s.when_date),
    )
    const d = new Date()
    d.setDate(d.getDate() + 1)
    // Skip dates that already have a timeless entry (up to 30 days out)
    for (let i = 0; i < 30; i++) {
      const iso = d.toISOString().split('T')[0]
      if (!timelessDates.has(iso)) {
        createSchedule.mutate({ when_date: iso })
        return
      }
      d.setDate(d.getDate() + 1)
    }
    // Fallback: just use the first available date
    const date = new Date()
    date.setDate(date.getDate() + 1)
    createSchedule.mutate({ when_date: date.toISOString().split('T')[0] })
  }

  function handleDateChange(entry: TaskSchedule, index: number, date: string | null, evening?: boolean) {
    // Block duplicate dates when neither entry has a time set
    if (date && date !== 'someday') {
      const duplicate = schedules.find(
        (s) => s.id !== entry.id && s.when_date === date && !s.start_time,
      )
      if (duplicate && !entry.start_time) {
        setTimeError('A schedule for this date already exists — set a time to differentiate')
        return
      }
    }

    if (index === 0) {
      onWhenDateChange(date, evening)
    } else if (date) {
      updateSchedule.mutate({ id: entry.id, data: { when_date: date } })
    }
    // Auto-focus start time after selecting a non-someday, non-evening date
    if (date && date !== 'someday' && !evening && !entry.start_time) {
      setFocusStartTimeId(entry.id)
    }
  }

  function handleStartTimeChange(entry: TaskSchedule, time: string | null) {
    if (time) {
      // If existing end time is now <= new start time, clear it
      const clearEnd = entry.end_time && entry.end_time <= time
      updateSchedule.mutate({
        id: entry.id,
        data: clearEnd
          ? { start_time: time, end_time: null }
          : { start_time: time },
      })
      // Jump to end time input
      endTimeRefs.current[entry.id]?.focus()
    } else {
      updateSchedule.mutate({
        id: entry.id,
        data: { start_time: null, end_time: null },
      })
    }
  }

  function handleEndTimeChange(entry: TaskSchedule, time: string | null) {
    // End time must be after start time
    if (time && entry.start_time && time <= entry.start_time) {
      setTimeError('End time must be after start time')
      return
    }
    setTimeError(null)
    updateSchedule.mutate({
      id: entry.id,
      data: { end_time: time },
    })
  }

  /** User left end-time empty → apply default gap from start */
  function handleEndTimeBlurEmpty(entry: TaskSchedule) {
    if (entry.start_time && !entry.end_time) {
      const endTime = addMinutes(entry.start_time, defaultTimeGap)
      updateSchedule.mutate({
        id: entry.id,
        data: { end_time: endTime },
      })
    }
  }

  function handleClearTime(entry: TaskSchedule) {
    // Block clearing time if it would create a duplicate timeless date
    const duplicate = schedules.find(
      (s) => s.id !== entry.id && s.when_date === entry.when_date && !s.start_time,
    )
    if (duplicate) {
      setTimeError('Another schedule for this date has no time — set a time there first')
      return
    }
    updateSchedule.mutate({
      id: entry.id,
      data: { start_time: null, end_time: null },
    })
  }

  function handleDeleteEntry(entry: TaskSchedule, index: number) {
    if (index === 0) {
      onClearWhen()
    } else {
      deleteSchedule.mutate(entry.id)
    }
  }

  // When there are no schedule entries, show a single date input
  if (schedules.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Calendar size={14} className="shrink-0 text-neutral-400" />
        <div ref={whenDateInputRef}>
          <DateInput
            variant="when"
            value=""
            onChange={onWhenDateChange}
            autoFocus={autoFocusFirst}
            onComplete={onComplete}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Hidden span for measuring the widest date label */}
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] whitespace-nowrap text-sm"
      />
      {schedules.map((entry, index) => {
        const isFirst = index === 0
        const isLast = index === schedules.length - 1
        const hasTime = !!entry.start_time
        const isEveningEntry = isFirst && whenEvening && !hasTime
        const today = new Date().toISOString().split('T')[0]
        const isPast = entry.when_date !== 'someday' && entry.when_date < today
        const isCompleted = entry.completed

        // Field styling: red when past & not completed, grey when completed, normal otherwise
        const pastFieldClassName = isPast
          ? isCompleted
            ? 'border-green-200 bg-green-50 text-green-400 line-through dark:border-green-800 dark:bg-green-900/20 dark:text-green-500'
            : 'border-red-300 bg-red-50 text-neutral-400 dark:border-red-800 dark:bg-red-950/40 dark:text-neutral-500'
          : undefined

        return (
          <div key={entry.id} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="shrink-0 text-neutral-400" />
              <div ref={(el) => { dateInputRefs.current[entry.id] = el; if (isFirst && whenDateInputRef) { whenDateInputRef.current = el } }} style={dateMinWidth ? { minWidth: dateMinWidth } : undefined} className={isPast ? 'pointer-events-none' : undefined}>
                <DateInput
                  variant="when"
                  value={entry.when_date}
                  evening={isFirst ? whenEvening : undefined}
                  onChange={(date, eve) => handleDateChange(entry, index, date, eve)}
                  autoFocus={isFirst && autoFocusFirst}
                  onComplete={isFirst ? onComplete : undefined}
                  hideSomeday={schedules.length > 1}
                  fieldClassName={pastFieldClassName}
                />
              </div>

              {/* Clear when date (X) — only for first entry when it's the sole entry */}
              {isFirst && schedules.length === 1 && !isPast && (
                <button
                  onClick={() => handleDeleteEntry(entry, index)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-label="Clear when date"
                >
                  <X size={14} />
                </button>
              )}

              {/* Time inputs — always show both start and end together */}
              {entry.when_date !== 'someday' && !isEveningEntry && (
                <>
                  <Clock size={14} className="shrink-0 text-neutral-400" />
                  <span className={isPast ? 'pointer-events-none' : undefined}>
                    <TimeInput
                      ref={(handle) => { startTimeRefs.current[entry.id] = handle }}
                      value={entry.start_time}
                      onChange={(time) => handleStartTimeChange(entry, time)}
                      placeholder="Start"
                      timeFormat={timeFormat}
                      fieldClassName={pastFieldClassName}
                    />
                  </span>
                  <span className="text-xs text-neutral-400">-</span>
                  <span className={isPast ? 'pointer-events-none' : undefined}>
                    <TimeInput
                      ref={(handle) => { endTimeRefs.current[entry.id] = handle }}
                      value={entry.end_time}
                      onChange={(time) => handleEndTimeChange(entry, time)}
                      onBlurEmpty={() => handleEndTimeBlurEmpty(entry)}
                      placeholder="End"
                      timeFormat={timeFormat}
                      fieldClassName={pastFieldClassName}
                    />
                  </span>
                  {hasTime && !isPast && (
                    <button
                      onClick={() => handleClearTime(entry)}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      aria-label="Clear time"
                    >
                      <X size={14} />
                    </button>
                  )}
                </>
              )}

              {isEveningEntry && (
                <span className="text-xs text-neutral-400">Evening</span>
              )}

              {/* Delete entry (trash) — for non-first entries, after time fields */}
              {!isFirst && !isPast && (
                <button
                  onClick={() => handleDeleteEntry(entry, index)}
                  className="text-neutral-400 hover:text-red-500 dark:hover:text-red-400"
                  aria-label="Remove schedule entry"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {/* Add button — inline on the last non-past row */}
              {isLast && canAdd && !isPast && (
                <button
                  onClick={handleAddEntry}
                  className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  aria-label="Add date"
                >
                  <Plus size={14} />
                </button>
              )}

              {/* Past entry actions: checkmark to mark complete, trash to delete, plus to add */}
              {isPast && (
                <>
                  <button
                    onClick={() => updateSchedule.mutate({
                      id: entry.id,
                      data: { completed: !entry.completed },
                    })}
                    className={`transition-colors ${
                      isCompleted
                        ? 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300'
                        : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200'
                    }`}
                    aria-label="Mark past schedule entry complete"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => deleteSchedule.mutate(entry.id)}
                    className="text-neutral-400 transition-colors hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400"
                    aria-label="Delete past schedule entry"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isLast && canAdd && (
                    <button
                      onClick={handleAddEntry}
                      className="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      aria-label="Add date"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
      {timeError && (
        <p className="text-xs text-red-500">{timeError}</p>
      )}
    </div>
  )
}
