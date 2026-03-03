import type { ReminderType } from '../api/types'
import { format } from 'date-fns'

/**
 * Short label for a reminder, used in task context lines and reminder lists.
 */
export function formatReminderLabel(
  r: { type: ReminderType; value: number; exact_at?: string | null },
  timeFormat: '12h' | '24h' = '12h',
): string {
  switch (r.type) {
    case 'at_start': return 'At start'
    case 'on_day': return 'On day (morning)'
    case 'minutes_before': return `${r.value} min before`
    case 'hours_before': return `${r.value} hr before`
    case 'days_before': return `${r.value} day${r.value !== 1 ? 's' : ''} before`
    case 'exact': {
      if (!r.exact_at) return 'Exact time'
      const timeFmt = timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
      return format(new Date(r.exact_at), `MMM d, ${timeFmt}`)
    }
  }
}

/**
 * Short label from just type + value, for task list context lines.
 */
export function formatReminderShort(type: ReminderType, value: number, timeFormat: '12h' | '24h' = '12h', exactAt?: string | null): string {
  return formatReminderLabel({ type, value, exact_at: exactAt }, timeFormat)
}
