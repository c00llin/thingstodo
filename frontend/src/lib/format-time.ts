/**
 * Format a 24-hour HH:MM time string for display.
 */
export function formatTime(time: string, format: '12h' | '24h'): string {
  if (format === '24h') return time

  const [hStr, mStr] = time.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr || '00'
  const period = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${period}`
}

/**
 * Format a time range for display.
 * e.g. "9:00 AM - 10:00 AM" (12h) or "9:00 - 10:00" (24h)
 */
export function formatTimeRange(
  start: string,
  end: string,
  format: '12h' | '24h',
): string {
  return `${formatTime(start, format)} - ${formatTime(end, format)}`
}
