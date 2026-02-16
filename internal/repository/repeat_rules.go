package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

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
	var constraints string
	err := r.db.QueryRow(
		"SELECT id, task_id, frequency, interval_value, mode, day_constraints FROM repeat_rules WHERE task_id = ?", taskID,
	).Scan(&rr.ID, &rr.TaskID, &rr.Frequency, &rr.IntervalValue, &rr.Mode, &constraints)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	rr.DayConstraints = parseDayConstraints(constraints)
	return &rr, nil
}

func (r *RepeatRuleRepository) Upsert(taskID string, input model.CreateRepeatRuleInput) (*model.RepeatRule, error) {
	id := model.NewID()
	constraintsJSON := encodeDayConstraints(input.DayConstraints)

	_, err := r.db.Exec(`
		INSERT INTO repeat_rules (id, task_id, frequency, interval_value, mode, day_constraints)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(task_id) DO UPDATE SET
			frequency = excluded.frequency,
			interval_value = excluded.interval_value,
			mode = excluded.mode,
			day_constraints = excluded.day_constraints`,
		id, taskID, input.Frequency, input.IntervalValue, input.Mode, constraintsJSON)
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
	rows, err := r.db.Query("SELECT id, task_id, frequency, interval_value, mode, day_constraints FROM repeat_rules")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []model.RepeatRule
	for rows.Next() {
		var rr model.RepeatRule
		var constraints string
		_ = rows.Scan(&rr.ID, &rr.TaskID, &rr.Frequency, &rr.IntervalValue, &rr.Mode, &constraints)
		rr.DayConstraints = parseDayConstraints(constraints)
		rules = append(rules, rr)
	}
	return rules, rows.Err()
}

func parseDayConstraints(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" || s == "[]" {
		return []string{}
	}
	var result []string
	if err := json.Unmarshal([]byte(s), &result); err != nil {
		// Fallback: comma-separated
		return strings.Split(s, ",")
	}
	return result
}

func encodeDayConstraints(days []string) string {
	if len(days) == 0 {
		return ""
	}
	b, _ := json.Marshal(days)
	return string(b)
}
