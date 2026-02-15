import {
  addDays,
  addMonths,
  nextMonday,
  nextFriday,
  nextThursday,
  nextWednesday,
  nextTuesday,
  nextSaturday,
  nextSunday,
  format,
  startOfMonth,
  parse,
  isValid,
  isBefore,
  addYears,
} from 'date-fns'

export interface ParsedDate {
  date: string // ISO date string YYYY-MM-DD
  evening: boolean
}

const DAY_FINDERS: Record<string, (d: Date) => Date> = {
  monday: nextMonday,
  mon: nextMonday,
  tuesday: nextTuesday,
  tue: nextTuesday,
  wednesday: nextWednesday,
  wed: nextWednesday,
  thursday: nextThursday,
  thu: nextThursday,
  friday: nextFriday,
  fri: nextFriday,
  saturday: nextSaturday,
  sat: nextSaturday,
  sunday: nextSunday,
  sun: nextSunday,
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

function formatDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function parseNaturalDate(input: string): ParsedDate | null {
  const text = input.trim().toLowerCase()
  if (!text) return null

  const today = new Date()

  // "this evening" or "tonight"
  if (text === 'this evening' || text === 'tonight') {
    return { date: formatDate(today), evening: true }
  }

  // "today"
  if (text === 'today') {
    return { date: formatDate(today), evening: false }
  }

  // "tomorrow"
  if (text === 'tomorrow') {
    return { date: formatDate(addDays(today, 1)), evening: false }
  }

  // "next week"
  if (text === 'next week') {
    return { date: formatDate(nextMonday(today)), evening: false }
  }

  // "next month"
  if (text === 'next month') {
    return { date: formatDate(startOfMonth(addMonths(today, 1))), evening: false }
  }

  // "in N days/weeks/months"
  const inMatch = text.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months)$/)
  if (inMatch) {
    const n = parseInt(inMatch[1], 10)
    const unit = inMatch[2]
    if (unit.startsWith('day')) {
      return { date: formatDate(addDays(today, n)), evening: false }
    }
    if (unit.startsWith('week')) {
      return { date: formatDate(addDays(today, n * 7)), evening: false }
    }
    if (unit.startsWith('month')) {
      return { date: formatDate(addMonths(today, n)), evening: false }
    }
  }

  // Day name: "friday", "mon", etc.
  const dayFinder = DAY_FINDERS[text]
  if (dayFinder) {
    return { date: formatDate(dayFinder(today)), evening: false }
  }

  // "month day" pattern: "jan 15", "december 3"
  const monthDayMatch = text.match(/^([a-z]+)\s+(\d{1,2})$/)
  if (monthDayMatch) {
    const monthNum = MONTH_NAMES[monthDayMatch[1]]
    if (monthNum !== undefined) {
      const day = parseInt(monthDayMatch[2], 10)
      let candidate = new Date(today.getFullYear(), monthNum, day)
      if (!isValid(candidate)) return null
      // If the date has passed this year, use next year
      if (isBefore(candidate, today)) {
        candidate = addYears(candidate, 1)
      }
      return { date: formatDate(candidate), evening: false }
    }
  }

  // Try parsing as a date string directly (YYYY-MM-DD, MM/DD, etc.)
  for (const fmt of ['yyyy-MM-dd', 'MM/dd', 'M/d']) {
    const parsed = parse(text, fmt, today)
    if (isValid(parsed)) {
      // For short formats without year, advance if in the past
      if (!text.includes('-') && isBefore(parsed, today)) {
        return { date: formatDate(addYears(parsed, 1)), evening: false }
      }
      return { date: formatDate(parsed), evening: false }
    }
  }

  return null
}
