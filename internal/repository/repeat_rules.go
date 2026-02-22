package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type RepeatRuleRepository struct {
	db *sql.DB
}

func NewRepeatRuleRepository(db *sql.DB) *RepeatRuleRepository {
	return &RepeatRuleRepository{db: db}
}

func (r *RepeatRuleRepository) GetByTask(taskID string) (*model.RepeatRule, error) {
	var rr model.RepeatRule
	var patternJSON string
	err := r.db.QueryRow(
		"SELECT id, task_id, pattern FROM repeat_rules WHERE task_id = ?", taskID,
	).Scan(&rr.ID, &rr.TaskID, &patternJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if patternJSON != "" {
		if err := json.Unmarshal([]byte(patternJSON), &rr.Pattern); err != nil {
			return nil, fmt.Errorf("unmarshal pattern: %w", err)
		}
	}
	populateFlatFields(&rr)
	return &rr, nil
}

func (r *RepeatRuleRepository) Upsert(taskID string, input model.CreateRepeatRuleInput) (*model.RepeatRule, error) {
	id := model.NewID()
	pattern := resolvePattern(input)
	patternJSON, err := json.Marshal(pattern)
	if err != nil {
		return nil, fmt.Errorf("marshal pattern: %w", err)
	}

	// Also write flat columns for backwards compat with older code
	frequency, intervalValue, mode, constraintsJSON := flatFieldsFromPattern(pattern)

	_, err = r.db.Exec(`
		INSERT INTO repeat_rules (id, task_id, pattern, frequency, interval_value, mode, day_constraints)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(task_id) DO UPDATE SET
			pattern = excluded.pattern,
			frequency = excluded.frequency,
			interval_value = excluded.interval_value,
			mode = excluded.mode,
			day_constraints = excluded.day_constraints`,
		id, taskID, string(patternJSON), frequency, intervalValue, mode, constraintsJSON)
	if err != nil {
		return nil, fmt.Errorf("upsert repeat rule: %w", err)
	}
	return r.GetByTask(taskID)
}

func (r *RepeatRuleRepository) DeleteByTask(taskID string) error {
	_, err := r.db.Exec("DELETE FROM repeat_rules WHERE task_id = ?", taskID)
	return err
}

func (r *RepeatRuleRepository) ListAll() ([]model.RepeatRule, error) {
	rows, err := r.db.Query("SELECT id, task_id, pattern FROM repeat_rules")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []model.RepeatRule
	for rows.Next() {
		var rr model.RepeatRule
		var patternJSON string
		_ = rows.Scan(&rr.ID, &rr.TaskID, &patternJSON)
		if patternJSON != "" {
			_ = json.Unmarshal([]byte(patternJSON), &rr.Pattern)
		}
		populateFlatFields(&rr)
		rules = append(rules, rr)
	}
	return rules, rows.Err()
}

// resolvePattern converts a CreateRepeatRuleInput to a RecurrencePattern.
// If input.Pattern is set, uses it directly. Otherwise, converts from legacy flat fields.
func resolvePattern(input model.CreateRepeatRuleInput) model.RecurrencePattern {
	if input.Pattern != nil {
		p := *input.Pattern
		if p.Every < 1 {
			p.Every = 1
		}
		return p
	}

	// Legacy conversion
	every := input.IntervalValue
	if every < 1 {
		every = 1
	}
	mode := model.RecurrenceMode(input.Mode)

	switch input.Frequency {
	case "weekly":
		return model.RecurrencePattern{
			Type:  model.PatternWeekly,
			Every: every,
			Mode:  mode,
			On:    input.DayConstraints,
		}
	case "monthly":
		return model.RecurrencePattern{
			Type:  model.PatternMonthlyDOM,
			Every: every,
			Mode:  mode,
		}
	case "yearly":
		return model.RecurrencePattern{
			Type:  model.PatternYearlyDate,
			Every: every,
			Mode:  mode,
		}
	default: // daily
		return model.RecurrencePattern{
			Type:  model.PatternDaily,
			Every: every,
			Mode:  mode,
		}
	}
}

// populateFlatFields sets the deprecated flat fields from the pattern for backwards compat.
func populateFlatFields(rr *model.RepeatRule) {
	rr.Mode = string(rr.Pattern.Mode)
	rr.IntervalValue = rr.Pattern.Every
	if rr.IntervalValue < 1 {
		rr.IntervalValue = 1
	}

	switch rr.Pattern.Type {
	case model.PatternDaily, model.PatternDailyWeekday, model.PatternDailyWeekend:
		rr.Frequency = "daily"
	case model.PatternWeekly:
		rr.Frequency = "weekly"
		rr.DayConstraints = rr.Pattern.On
	case model.PatternMonthlyDOM, model.PatternMonthlyDOW, model.PatternMonthlyWorkday:
		rr.Frequency = "monthly"
	case model.PatternYearlyDate, model.PatternYearlyDOW:
		rr.Frequency = "yearly"
	}

	if rr.DayConstraints == nil {
		rr.DayConstraints = []string{}
	}
}

// flatFieldsFromPattern extracts legacy flat column values from a pattern.
func flatFieldsFromPattern(p model.RecurrencePattern) (frequency string, intervalValue int, mode string, constraintsJSON string) {
	mode = string(p.Mode)
	intervalValue = p.Every
	if intervalValue < 1 {
		intervalValue = 1
	}

	switch p.Type {
	case model.PatternDaily, model.PatternDailyWeekday, model.PatternDailyWeekend:
		frequency = "daily"
	case model.PatternWeekly:
		frequency = "weekly"
		if len(p.On) > 0 {
			b, _ := json.Marshal(p.On)
			constraintsJSON = string(b)
		}
	case model.PatternMonthlyDOM, model.PatternMonthlyDOW, model.PatternMonthlyWorkday:
		frequency = "monthly"
	case model.PatternYearlyDate, model.PatternYearlyDOW:
		frequency = "yearly"
	default:
		frequency = "daily"
	}
	return
}
