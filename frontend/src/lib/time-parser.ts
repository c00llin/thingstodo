/**
 * Parse free-text time input into HH:MM 24-hour format.
 *
 * Accepts: 9, 9am, 9:00, 9:00am, 9:30pm, 21:00, 2pm, 14:30, etc.
 * Returns null on parse failure.
 */
export function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (!s) return null

  // Match: optional hours, optional :minutes, optional am/pm
  const match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const period = match[3]

  if (minutes < 0 || minutes > 59) return null

  if (period) {
    // 12-hour input
    if (hours < 1 || hours > 12) return null
    const isPM = period.startsWith('p')
    if (hours === 12) {
      hours = isPM ? 12 : 0
    } else if (isPM) {
      hours += 12
    }
  } else {
    // 24-hour input (or bare number)
    if (hours < 0 || hours > 23) return null
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
