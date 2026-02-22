package recurrence

import (
	"fmt"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
)

// Calculator computes the next occurrence date for a specific pattern type.
type Calculator interface {
	Next(from time.Time, pattern model.RecurrencePattern) (time.Time, error)
}

// Engine dispatches to the correct Calculator based on pattern type.
type Engine struct {
	calculators map[model.PatternType]Calculator
}

// NewEngine creates an Engine with all calculator implementations registered.
func NewEngine() *Engine {
	return &Engine{
		calculators: map[model.PatternType]Calculator{
			model.PatternDaily:          DailyCalculator{},
			model.PatternDailyWeekday:   DailyWeekdayCalculator{},
			model.PatternDailyWeekend:   DailyWeekendCalculator{},
			model.PatternWeekly:         WeeklyCalculator{},
			model.PatternMonthlyDOM:     MonthlyDOMCalculator{},
			model.PatternMonthlyDOW:     MonthlyDOWCalculator{},
			model.PatternMonthlyWorkday: MonthlyWorkdayCalculator{},
			model.PatternYearlyDate:     YearlyDateCalculator{},
			model.PatternYearlyDOW:      YearlyDOWCalculator{},
		},
	}
}

// Next computes the next date from the given date string and pattern.
// fromDate should be "2006-01-02" format. Falls back to today if empty/invalid.
func (e *Engine) Next(fromDate string, pattern model.RecurrencePattern) (string, error) {
	base := parseOrNow(fromDate)

	calc, ok := e.calculators[pattern.Type]
	if !ok {
		return "", fmt.Errorf("unknown pattern type: %s", pattern.Type)
	}

	next, err := calc.Next(base, pattern)
	if err != nil {
		return "", err
	}
	return next.Format("2006-01-02"), nil
}

// FirstOnOrAfter finds the earliest occurrence of the pattern that is on or
// after the given date. Unlike Next (which always advances past fromDate),
// this checks the current period first (e.g. current month for monthly rules).
func (e *Engine) FirstOnOrAfter(fromDate string, pattern model.RecurrencePattern) (string, error) {
	base := parseOrNow(fromDate)

	calc, ok := e.calculators[pattern.Type]
	if !ok {
		return "", fmt.Errorf("unknown pattern type: %s", pattern.Type)
	}

	if cc, ok := calc.(CurrentPeriodCalculator); ok {
		if candidate, err := cc.CurrentPeriod(base, pattern); err == nil && !candidate.Before(base) {
			return candidate.Format("2006-01-02"), nil
		}
	}

	// Fall back to Next
	next, err := calc.Next(base, pattern)
	if err != nil {
		return "", err
	}
	return next.Format("2006-01-02"), nil
}

func parseOrNow(s string) time.Time {
	if s != "" {
		if t, err := time.Parse("2006-01-02", s); err == nil {
			return t
		}
	}
	return time.Now()
}

// CurrentPeriodCalculator is optionally implemented by calculators that can
// compute the occurrence within the current period (month, year, week, etc.).
type CurrentPeriodCalculator interface {
	CurrentPeriod(from time.Time, pattern model.RecurrencePattern) (time.Time, error)
}
