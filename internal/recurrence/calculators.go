package recurrence

import (
	"fmt"
	"strings"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
)

// --- Helpers ---

func clampToLastDay(year int, month time.Month, day int) time.Time {
	maxDay := daysInMonth(year, month)
	if day > maxDay {
		day = maxDay
	}
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func daysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

func isLeapYear(year int) bool {
	return year%4 == 0 && (year%100 != 0 || year%400 == 0)
}

var weekdayMap = map[string]time.Weekday{
	"sunday": time.Sunday, "monday": time.Monday, "tuesday": time.Tuesday,
	"wednesday": time.Wednesday, "thursday": time.Thursday, "friday": time.Friday,
	"saturday": time.Saturday,
}

var shortDayMap = map[string]time.Weekday{
	"sun": time.Sunday, "mon": time.Monday, "tue": time.Tuesday,
	"wed": time.Wednesday, "thu": time.Thursday, "fri": time.Friday,
	"sat": time.Saturday,
}

func parseWeekday(s string) (time.Weekday, bool) {
	wd, ok := weekdayMap[strings.ToLower(s)]
	if ok {
		return wd, true
	}
	wd, ok = shortDayMap[strings.ToLower(s)]
	return wd, ok
}

// nthWeekdayInMonth finds the Nth occurrence of a weekday in a given month.
// ordinal: "first"=1, "second"=2, "third"=3, "fourth"=4, "last"=-1
// If the Nth occurrence doesn't exist (e.g. 5th Monday), clamps to last occurrence.
func nthWeekdayInMonth(year int, month time.Month, ordinal string, wd time.Weekday) time.Time {
	if ordinal == "last" {
		// Start from last day and go backwards
		last := time.Date(year, month, daysInMonth(year, month), 0, 0, 0, 0, time.UTC)
		for last.Weekday() != wd {
			last = last.AddDate(0, 0, -1)
		}
		return last
	}

	n := ordinalToInt(ordinal)
	// Find first occurrence of wd in month
	first := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	for first.Weekday() != wd {
		first = first.AddDate(0, 0, 1)
	}
	// Advance by (n-1) weeks
	result := first.AddDate(0, 0, (n-1)*7)
	// If result overflows the month, clamp to last occurrence
	if result.Month() != month {
		return nthWeekdayInMonth(year, month, "last", wd)
	}
	return result
}

func ordinalToInt(s string) int {
	switch strings.ToLower(s) {
	case "first":
		return 1
	case "second":
		return 2
	case "third":
		return 3
	case "fourth":
		return 4
	default:
		return 1
	}
}

func isWorkday(t time.Time) bool {
	wd := t.Weekday()
	return wd >= time.Monday && wd <= time.Friday
}

// --- Calculators ---

// DailyCalculator adds N days.
type DailyCalculator struct{}

func (DailyCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}
	return from.AddDate(0, 0, every), nil
}

func (DailyCalculator) CurrentPeriod(from time.Time, _ model.RecurrencePattern) (time.Time, error) {
	return from, nil
}

// DailyWeekdayCalculator advances to the next Mon-Fri.
type DailyWeekdayCalculator struct{}

func (DailyWeekdayCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}
	candidate := from
	for i := 0; i < every; i++ {
		candidate = candidate.AddDate(0, 0, 1)
		for !isWorkday(candidate) {
			candidate = candidate.AddDate(0, 0, 1)
		}
	}
	return candidate, nil
}

func (DailyWeekdayCalculator) CurrentPeriod(from time.Time, _ model.RecurrencePattern) (time.Time, error) {
	if isWorkday(from) {
		return from, nil
	}
	// Advance to next weekday
	candidate := from.AddDate(0, 0, 1)
	for !isWorkday(candidate) {
		candidate = candidate.AddDate(0, 0, 1)
	}
	return candidate, nil
}

// DailyWeekendCalculator advances to the next Sat-Sun.
type DailyWeekendCalculator struct{}

func (DailyWeekendCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}
	candidate := from
	for i := 0; i < every; i++ {
		candidate = candidate.AddDate(0, 0, 1)
		for isWorkday(candidate) {
			candidate = candidate.AddDate(0, 0, 1)
		}
	}
	return candidate, nil
}

func (DailyWeekendCalculator) CurrentPeriod(from time.Time, _ model.RecurrencePattern) (time.Time, error) {
	if !isWorkday(from) {
		return from, nil
	}
	// Advance to next weekend day
	candidate := from.AddDate(0, 0, 1)
	for isWorkday(candidate) {
		candidate = candidate.AddDate(0, 0, 1)
	}
	return candidate, nil
}

// WeeklyCalculator respects interval (every N weeks) and day constraints.
type WeeklyCalculator struct{}

func (WeeklyCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}

	if len(p.On) == 0 {
		return from.AddDate(0, 0, 7*every), nil
	}

	target := make(map[time.Weekday]bool)
	for _, d := range p.On {
		if wd, ok := parseWeekday(d); ok {
			target[wd] = true
		}
	}
	if len(target) == 0 {
		return from.AddDate(0, 0, 7*every), nil
	}

	// Find the Monday of the current week (week containing `from`)
	weekStart := from
	for weekStart.Weekday() != time.Monday {
		weekStart = weekStart.AddDate(0, 0, -1)
	}

	// Check remaining days in the current week first
	candidate := from.AddDate(0, 0, 1)
	nextWeekStart := weekStart.AddDate(0, 0, 7)
	for candidate.Before(nextWeekStart) {
		if target[candidate.Weekday()] {
			return candidate, nil
		}
		candidate = candidate.AddDate(0, 0, 1)
	}

	// Jump to the next interval week and find first matching day
	targetWeekStart := weekStart.AddDate(0, 0, 7*every)
	for d := 0; d < 7; d++ {
		candidate = targetWeekStart.AddDate(0, 0, d)
		if target[candidate.Weekday()] {
			return candidate, nil
		}
	}

	// Fallback (shouldn't happen with valid target days)
	return from.AddDate(0, 0, 7*every), nil
}

func (WeeklyCalculator) CurrentPeriod(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	if len(p.On) == 0 {
		return from, nil
	}
	target := make(map[time.Weekday]bool)
	for _, d := range p.On {
		if wd, ok := parseWeekday(d); ok {
			target[wd] = true
		}
	}
	// Check from today through end of this week
	candidate := from
	for i := 0; i < 7; i++ {
		if target[candidate.Weekday()] {
			return candidate, nil
		}
		candidate = candidate.AddDate(0, 0, 1)
	}
	return from, nil
}

// MonthlyDOMCalculator handles specific day of month.
// Day=0 means last day, negative means last-N.
type MonthlyDOMCalculator struct{}

func (MonthlyDOMCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}

	targetMonth := from.AddDate(0, every, 0)
	year, month := targetMonth.Year(), targetMonth.Month()

	if p.Day == nil {
		// Use same day of month as from date, clamped
		return clampToLastDay(year, month, from.Day()), nil
	}

	day := *p.Day
	if day == 0 {
		// Last day of month
		return clampToLastDay(year, month, daysInMonth(year, month)), nil
	}
	if day < 0 {
		// Last-N day (e.g. -1 = second to last)
		lastDay := daysInMonth(year, month)
		d := lastDay + day // day is negative, so this subtracts
		if d < 1 {
			d = 1
		}
		return time.Date(year, month, d, 0, 0, 0, 0, time.UTC), nil
	}
	return clampToLastDay(year, month, day), nil
}

func (MonthlyDOMCalculator) CurrentPeriod(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	year, month := from.Year(), from.Month()
	if p.Day == nil {
		return clampToLastDay(year, month, from.Day()), nil
	}
	day := *p.Day
	if day == 0 {
		return clampToLastDay(year, month, daysInMonth(year, month)), nil
	}
	if day < 0 {
		lastDay := daysInMonth(year, month)
		d := lastDay + day
		if d < 1 {
			d = 1
		}
		return time.Date(year, month, d, 0, 0, 0, 0, time.UTC), nil
	}
	return clampToLastDay(year, month, day), nil
}

// MonthlyDOWCalculator handles Nth weekday of month (e.g. "first Monday").
type MonthlyDOWCalculator struct{}

func (MonthlyDOWCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}

	wd, ok := parseWeekday(p.Weekday)
	if !ok {
		return time.Time{}, fmt.Errorf("invalid weekday: %s", p.Weekday)
	}

	ordinal := p.Ordinal
	if ordinal == "" {
		ordinal = "first"
	}

	targetMonth := from.AddDate(0, every, 0)
	year, month := targetMonth.Year(), targetMonth.Month()
	return nthWeekdayInMonth(year, month, ordinal, wd), nil
}

func (MonthlyDOWCalculator) CurrentPeriod(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	wd, ok := parseWeekday(p.Weekday)
	if !ok {
		return time.Time{}, fmt.Errorf("invalid weekday: %s", p.Weekday)
	}
	ordinal := p.Ordinal
	if ordinal == "" {
		ordinal = "first"
	}
	return nthWeekdayInMonth(from.Year(), from.Month(), ordinal, wd), nil
}

// MonthlyWorkdayCalculator handles first/last workday (Mon-Fri) of month.
type MonthlyWorkdayCalculator struct{}

func (MonthlyWorkdayCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}

	targetMonth := from.AddDate(0, every, 0)
	year, month := targetMonth.Year(), targetMonth.Month()

	switch p.WorkdayPosition {
	case "first":
		d := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
		for !isWorkday(d) {
			d = d.AddDate(0, 0, 1)
		}
		return d, nil
	case "last":
		d := time.Date(year, month, daysInMonth(year, month), 0, 0, 0, 0, time.UTC)
		for !isWorkday(d) {
			d = d.AddDate(0, 0, -1)
		}
		return d, nil
	default:
		return time.Time{}, fmt.Errorf("invalid workday_position: %s", p.WorkdayPosition)
	}
}

func (c MonthlyWorkdayCalculator) CurrentPeriod(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	year, month := from.Year(), from.Month()
	switch p.WorkdayPosition {
	case "first":
		d := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
		for !isWorkday(d) {
			d = d.AddDate(0, 0, 1)
		}
		return d, nil
	case "last":
		d := time.Date(year, month, daysInMonth(year, month), 0, 0, 0, 0, time.UTC)
		for !isWorkday(d) {
			d = d.AddDate(0, 0, -1)
		}
		return d, nil
	default:
		return time.Time{}, fmt.Errorf("invalid workday_position: %s", p.WorkdayPosition)
	}
}

// YearlyDateCalculator handles specific month+day yearly recurrence.
type YearlyDateCalculator struct{}

func (YearlyDateCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}

	year := from.Year() + every
	month := time.Month(p.Month)
	if month < 1 || month > 12 {
		// Use from's month if not specified
		month = from.Month()
	}

	day := from.Day()
	if p.Day != nil && *p.Day > 0 {
		day = *p.Day
	}

	// Handle Feb 29: if target year is not a leap year, clamp
	if month == time.February && day == 29 && !isLeapYear(year) {
		// Find next leap year
		for !isLeapYear(year) {
			year += every
		}
	}

	return clampToLastDay(year, month, day), nil
}

func (YearlyDateCalculator) CurrentPeriod(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	year := from.Year()
	month := time.Month(p.Month)
	if month < 1 || month > 12 {
		month = from.Month()
	}
	day := from.Day()
	if p.Day != nil && *p.Day > 0 {
		day = *p.Day
	}
	if month == time.February && day == 29 && !isLeapYear(year) {
		return time.Time{}, fmt.Errorf("no Feb 29 this year")
	}
	return clampToLastDay(year, month, day), nil
}

// YearlyDOWCalculator handles Nth weekday of a specific month yearly.
type YearlyDOWCalculator struct{}

func (YearlyDOWCalculator) Next(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	every := p.Every
	if every < 1 {
		every = 1
	}

	wd, ok := parseWeekday(p.Weekday)
	if !ok {
		return time.Time{}, fmt.Errorf("invalid weekday: %s", p.Weekday)
	}

	ordinal := p.Ordinal
	if ordinal == "" {
		ordinal = "first"
	}

	month := time.Month(p.Month)
	if month < 1 || month > 12 {
		month = from.Month()
	}

	year := from.Year() + every
	return nthWeekdayInMonth(year, month, ordinal, wd), nil
}

func (YearlyDOWCalculator) CurrentPeriod(from time.Time, p model.RecurrencePattern) (time.Time, error) {
	wd, ok := parseWeekday(p.Weekday)
	if !ok {
		return time.Time{}, fmt.Errorf("invalid weekday: %s", p.Weekday)
	}
	ordinal := p.Ordinal
	if ordinal == "" {
		ordinal = "first"
	}
	month := time.Month(p.Month)
	if month < 1 || month > 12 {
		month = from.Month()
	}
	return nthWeekdayInMonth(from.Year(), month, ordinal, wd), nil
}
