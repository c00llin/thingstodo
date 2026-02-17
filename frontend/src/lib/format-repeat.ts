import type { RepeatRule } from '../api/types'

const DAY_LABELS: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

const UNIT_SINGULAR: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

export function formatRepeatRule(rule: RepeatRule): string {
  const parts: string[] = []

  if (rule.interval_value === 1) {
    parts.push(FREQUENCY_LABEL[rule.frequency] ?? rule.frequency)
  } else {
    const unit = UNIT_SINGULAR[rule.frequency] ?? rule.frequency
    parts.push(`Every ${rule.interval_value} ${unit}s`)
  }

  if (rule.frequency === 'weekly' && rule.day_constraints.length > 0) {
    const days = rule.day_constraints.map((d) => DAY_LABELS[d] ?? d).join(', ')
    parts.push(`on ${days}`)
  }

  if (rule.mode === 'after_completion') {
    parts.push('after completion')
  }

  return parts.join(' ')
}
