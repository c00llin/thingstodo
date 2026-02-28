import { format, isToday, isTomorrow, isYesterday } from 'date-fns'

/**
 * Format an ISO date string (yyyy-MM-dd) as a friendly relative or absolute label.
 * Yesterday, Today, Tomorrow → relative; otherwise "Mon, Feb 16" style.
 */
export function formatRelativeDate(iso: string): string {
  if (iso === 'someday') return 'Someday'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  if (isYesterday(d)) return 'Yesterday'
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEE, MMM d')
}
