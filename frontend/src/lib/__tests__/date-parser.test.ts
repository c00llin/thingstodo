import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseNaturalDate } from '../date-parser'
import { format, addDays, addMonths, startOfMonth, nextMonday, nextFriday } from 'date-fns'

function fmt(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

describe('parseNaturalDate', () => {
  const realDate = Date

  beforeEach(() => {
    // Fix "today" to 2026-02-15 (a Sunday)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 15))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const today = new Date(2026, 1, 15)

  it('returns null for empty input', () => {
    expect(parseNaturalDate('')).toBeNull()
    expect(parseNaturalDate('  ')).toBeNull()
  })

  it('returns null for unrecognized input', () => {
    expect(parseNaturalDate('gobbledygook')).toBeNull()
    expect(parseNaturalDate('asdf1234')).toBeNull()
  })

  it('parses "today"', () => {
    expect(parseNaturalDate('today')).toEqual({
      date: fmt(today),
      evening: false,
    })
  })

  it('parses "tomorrow"', () => {
    expect(parseNaturalDate('tomorrow')).toEqual({
      date: fmt(addDays(today, 1)),
      evening: false,
    })
  })

  it('parses "this evening" and "tonight"', () => {
    const expected = { date: fmt(today), evening: true }
    expect(parseNaturalDate('this evening')).toEqual(expected)
    expect(parseNaturalDate('tonight')).toEqual(expected)
  })

  it('parses "next week" as next Monday', () => {
    expect(parseNaturalDate('next week')).toEqual({
      date: fmt(nextMonday(today)),
      evening: false,
    })
  })

  it('parses "next month" as 1st of next month', () => {
    expect(parseNaturalDate('next month')).toEqual({
      date: fmt(startOfMonth(addMonths(today, 1))),
      evening: false,
    })
  })

  it('parses "in N days"', () => {
    expect(parseNaturalDate('in 3 days')).toEqual({
      date: fmt(addDays(today, 3)),
      evening: false,
    })
    expect(parseNaturalDate('in 1 day')).toEqual({
      date: fmt(addDays(today, 1)),
      evening: false,
    })
  })

  it('parses "in N weeks"', () => {
    expect(parseNaturalDate('in 2 weeks')).toEqual({
      date: fmt(addDays(today, 14)),
      evening: false,
    })
  })

  it('parses "in N months"', () => {
    expect(parseNaturalDate('in 3 months')).toEqual({
      date: fmt(addMonths(today, 3)),
      evening: false,
    })
  })

  it('parses day names', () => {
    expect(parseNaturalDate('friday')).toEqual({
      date: fmt(nextFriday(today)),
      evening: false,
    })
    expect(parseNaturalDate('fri')).toEqual({
      date: fmt(nextFriday(today)),
      evening: false,
    })
    expect(parseNaturalDate('monday')).toEqual({
      date: fmt(nextMonday(today)),
      evening: false,
    })
  })

  it('parses "month day" pattern', () => {
    // March 5 is in the future from Feb 15
    expect(parseNaturalDate('mar 5')).toEqual({
      date: '2026-03-05',
      evening: false,
    })
  })

  it('rolls "month day" to next year if in the past', () => {
    // Jan 10 has already passed in 2026
    expect(parseNaturalDate('jan 10')).toEqual({
      date: '2027-01-10',
      evening: false,
    })
  })

  it('parses ISO date format', () => {
    expect(parseNaturalDate('2026-06-01')).toEqual({
      date: '2026-06-01',
      evening: false,
    })
  })

  it('is case-insensitive', () => {
    expect(parseNaturalDate('TODAY')).toEqual({
      date: fmt(today),
      evening: false,
    })
    expect(parseNaturalDate('Tomorrow')).toEqual({
      date: fmt(addDays(today, 1)),
      evening: false,
    })
  })
})
