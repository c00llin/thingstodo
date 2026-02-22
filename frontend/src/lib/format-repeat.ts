import type { RepeatRule, RecurrencePattern } from '../api/types'

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const ORDINAL_LABELS: Record<string, string> = {
  first: 'first', second: 'second', third: 'third', fourth: 'fourth', last: 'last',
}

const WEEKDAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

function formatInterval(every: number, unit: string): string {
  if (every === 1) return ''
  return `Every ${every} ${unit}s`
}

type Formatter = (p: RecurrencePattern & { type: string }) => string

const formatters: Record<string, Formatter> = {
  daily(p) {
    if (p.every === 1) return 'Daily'
    return `Every ${p.every} days`
  },

  daily_weekday() {
    return 'Every weekday'
  },

  daily_weekend() {
    return 'Every weekend day'
  },

  weekly(p) {
    const wp = p as RecurrencePattern & { type: 'weekly' }
    const prefix = wp.every === 1 ? 'Weekly' : formatInterval(wp.every, 'week')
    if (wp.on && wp.on.length > 0) {
      const days = wp.on.map((d) => DAY_LABELS[d] ?? d).join(', ')
      return `${prefix} on ${days}`
    }
    return prefix
  },

  monthly_dom(p) {
    const mp = p as RecurrencePattern & { type: 'monthly_dom' }
    const prefix = mp.every === 1 ? 'Monthly' : formatInterval(mp.every, 'month')
    if (mp.day === 0) return `${prefix} on the last day`
    if (mp.day != null && mp.day < 0) {
      const n = Math.abs(mp.day)
      return `${prefix} on the ${ordinalSuffix(n)}-to-last day`
    }
    if (mp.day != null && mp.day > 0) return `${prefix} on day ${mp.day}`
    return prefix
  },

  monthly_dow(p) {
    const mp = p as RecurrencePattern & { type: 'monthly_dow' }
    const prefix = mp.every === 1 ? 'Monthly' : formatInterval(mp.every, 'month')
    const ord = ORDINAL_LABELS[mp.ordinal] ?? mp.ordinal
    const wd = WEEKDAY_LABELS[mp.weekday] ?? mp.weekday
    return `${prefix} on the ${ord} ${wd}`
  },

  monthly_workday(p) {
    const mp = p as RecurrencePattern & { type: 'monthly_workday' }
    const prefix = mp.every === 1 ? 'Monthly' : formatInterval(mp.every, 'month')
    return `${prefix} on the ${mp.workday_position} workday`
  },

  yearly_date(p) {
    const yp = p as RecurrencePattern & { type: 'yearly_date' }
    const prefix = yp.every === 1 ? 'Yearly' : formatInterval(yp.every, 'year')
    const month = MONTH_NAMES[yp.month] ?? ''
    if (month && yp.day != null && yp.day > 0) return `${prefix} on ${month} ${yp.day}`
    if (month) return `${prefix} in ${month}`
    return prefix
  },

  yearly_dow(p) {
    const yp = p as RecurrencePattern & { type: 'yearly_dow' }
    const prefix = yp.every === 1 ? 'Yearly' : formatInterval(yp.every, 'year')
    const ord = ORDINAL_LABELS[yp.ordinal] ?? yp.ordinal
    const wd = WEEKDAY_LABELS[yp.weekday] ?? yp.weekday
    const month = MONTH_NAMES[yp.month] ?? ''
    return `${prefix} on the ${ord} ${wd} of ${month}`
  },
}

function ordinalSuffix(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

export function formatRepeatRule(rule: RepeatRule): string {
  const pattern = rule.pattern
  const formatter = formatters[pattern.type]
  if (!formatter) return 'Repeating'

  let text = formatter(pattern as RecurrencePattern & { type: string })
  if (pattern.mode === 'after_completion') {
    text += ' after completion'
  }
  return text
}
