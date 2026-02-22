package model

// RecurrenceMode defines when the next instance is created.
type RecurrenceMode string

const (
	RecurrenceModeFixed           RecurrenceMode = "fixed"
	RecurrenceModeAfterCompletion RecurrenceMode = "after_completion"
)

// PatternType discriminates the recurrence pattern variant.
type PatternType string

const (
	PatternDaily           PatternType = "daily"
	PatternDailyWeekday    PatternType = "daily_weekday"
	PatternDailyWeekend    PatternType = "daily_weekend"
	PatternWeekly          PatternType = "weekly"
	PatternMonthlyDOM      PatternType = "monthly_dom"
	PatternMonthlyDOW      PatternType = "monthly_dow"
	PatternMonthlyWorkday  PatternType = "monthly_workday"
	PatternYearlyDate      PatternType = "yearly_date"
	PatternYearlyDOW       PatternType = "yearly_dow"
)

// RecurrencePattern is a flat struct with omitempty for unused fields per type.
// The `Type` field discriminates which fields are relevant.
type RecurrencePattern struct {
	Type  PatternType    `json:"type"`
	Every int            `json:"every"`
	Mode  RecurrenceMode `json:"mode"`

	// Weekly: days of week (e.g. ["mon","wed","fri"])
	On []string `json:"on,omitempty"`

	// MonthlyDOM: day of month (1-31, 0=last day, negative=last-N)
	Day *int `json:"day,omitempty"`

	// MonthlyDOW / YearlyDOW: ordinal position + weekday
	Ordinal string `json:"ordinal,omitempty"` // "first","second","third","fourth","last"
	Weekday string `json:"weekday,omitempty"` // "monday"-"sunday"

	// MonthlyWorkday: "first" or "last"
	WorkdayPosition string `json:"workday_position,omitempty"`

	// YearlyDate / YearlyDOW: month (1-12) and day (1-31)
	Month int `json:"month,omitempty"`
	// Day is reused for YearlyDate (day of month)
}
