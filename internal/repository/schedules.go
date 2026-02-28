package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type ScheduleRepository struct {
	db *sql.DB
}

func NewScheduleRepository(db *sql.DB) *ScheduleRepository {
	return &ScheduleRepository{db: db}
}

func (r *ScheduleRepository) ListByTask(taskID string) ([]model.TaskSchedule, error) {
	rows, err := r.db.Query(
		"SELECT id, when_date, start_time, end_time, completed, sort_order FROM task_schedules WHERE task_id = ? ORDER BY sort_order", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.TaskSchedule
	for rows.Next() {
		var s model.TaskSchedule
		if err := rows.Scan(&s.ID, &s.WhenDate, &s.StartTime, &s.EndTime, &s.Completed, &s.SortOrder); err != nil {
			return nil, fmt.Errorf("scan schedule: %w", err)
		}
		items = append(items, s)
	}
	if items == nil {
		items = []model.TaskSchedule{}
	}
	return items, rows.Err()
}

func (r *ScheduleRepository) Create(taskID string, input model.CreateTaskScheduleInput) (*model.TaskSchedule, error) {
	id := model.NewID()
	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM task_schedules WHERE task_id = ?", taskID).Scan(&maxSort)

	_, err := r.db.Exec(
		"INSERT INTO task_schedules (id, task_id, when_date, start_time, end_time, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
		id, taskID, input.WhenDate, input.StartTime, input.EndTime, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create schedule: %w", err)
	}

	var s model.TaskSchedule
	_ = r.db.QueryRow("SELECT id, when_date, start_time, end_time, completed, sort_order FROM task_schedules WHERE id = ?", id).
		Scan(&s.ID, &s.WhenDate, &s.StartTime, &s.EndTime, &s.Completed, &s.SortOrder)
	return &s, nil
}

func (r *ScheduleRepository) Update(id string, input model.UpdateTaskScheduleInput) (*model.TaskSchedule, error) {
	if input.WhenDate != nil {
		_, _ = r.db.Exec("UPDATE task_schedules SET when_date = ? WHERE id = ?", *input.WhenDate, id)
	}
	if _, ok := input.Raw["start_time"]; ok {
		_, _ = r.db.Exec("UPDATE task_schedules SET start_time = ? WHERE id = ?", input.StartTime, id)
	}
	if _, ok := input.Raw["end_time"]; ok {
		_, _ = r.db.Exec("UPDATE task_schedules SET end_time = ? WHERE id = ?", input.EndTime, id)
	}
	if input.SortOrder != nil {
		_, _ = r.db.Exec("UPDATE task_schedules SET sort_order = ? WHERE id = ?", *input.SortOrder, id)
	}
	if input.Completed != nil {
		v := 0
		if *input.Completed {
			v = 1
		}
		_, _ = r.db.Exec("UPDATE task_schedules SET completed = ? WHERE id = ?", v, id)
	}

	var s model.TaskSchedule
	err := r.db.QueryRow("SELECT id, task_id, when_date, start_time, end_time, completed, sort_order FROM task_schedules WHERE id = ?", id).
		Scan(&s.ID, &s.TaskID, &s.WhenDate, &s.StartTime, &s.EndTime, &s.Completed, &s.SortOrder)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &s, err
}

func (r *ScheduleRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM task_schedules WHERE id = ?", id)
	return err
}

func (r *ScheduleRepository) Reorder(items []model.SimpleReorderItem) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, item := range items {
		_, err := tx.Exec("UPDATE task_schedules SET sort_order = ? WHERE id = ?", item.SortOrder, item.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// GetTaskIDForSchedule returns the task_id owning the given schedule entry.
func (r *ScheduleRepository) GetTaskIDForSchedule(scheduleID string) (string, error) {
	var taskID string
	err := r.db.QueryRow("SELECT task_id FROM task_schedules WHERE id = ?", scheduleID).Scan(&taskID)
	if err != nil {
		return "", err
	}
	return taskID, nil
}

// CountByTask returns the number of schedule entries for a task.
func (r *ScheduleRepository) CountByTask(taskID string) (int, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM task_schedules WHERE task_id = ?", taskID).Scan(&count)
	return count, err
}

// SyncPrimary updates tasks.when_date and tasks.when_evening from the first schedule entry.
func (r *ScheduleRepository) SyncPrimary(taskID, eveningStartsAt string) error {
	var whenDate sql.NullString
	var startTime sql.NullString

	err := r.db.QueryRow(
		"SELECT when_date, start_time FROM task_schedules WHERE task_id = ? ORDER BY sort_order ASC LIMIT 1",
		taskID).Scan(&whenDate, &startTime)

	if err == sql.ErrNoRows {
		// No schedules left — set when_date to NULL
		_, err = r.db.Exec("UPDATE tasks SET when_date = NULL, when_evening = 0, updated_at = datetime('now') WHERE id = ?", taskID)
		return err
	}
	if err != nil {
		return fmt.Errorf("sync primary: %w", err)
	}

	// Determine evening status based on start_time
	evening := 0
	if startTime.Valid && startTime.String >= eveningStartsAt {
		evening = 1
	}
	// If task has a start_time, we always set when_evening based on the threshold.
	// If no start_time, preserve the existing when_evening value.
	if startTime.Valid {
		_, err = r.db.Exec(
			"UPDATE tasks SET when_date = ?, when_evening = ?, updated_at = datetime('now') WHERE id = ?",
			whenDate.String, evening, taskID)
	} else {
		_, err = r.db.Exec(
			"UPDATE tasks SET when_date = ?, updated_at = datetime('now') WHERE id = ?",
			whenDate.String, taskID)
	}
	return err
}

// GetScheduleFields reads the current when_date and start_time for a schedule entry.
func (r *ScheduleRepository) GetScheduleFields(id string, whenDate *string, startTime **string) error {
	var wd string
	var st sql.NullString
	err := r.db.QueryRow("SELECT when_date, start_time FROM task_schedules WHERE id = ?", id).Scan(&wd, &st)
	if err != nil {
		return err
	}
	*whenDate = wd
	if st.Valid {
		s := st.String
		*startTime = &s
	} else {
		*startTime = nil
	}
	return nil
}

// HasDuplicateTimelessDate checks whether another timeless entry with the same date exists for this task.
// excludeID is the schedule entry being changed (pass "" for new entries).
func (r *ScheduleRepository) HasDuplicateTimelessDate(taskID, whenDate, excludeID string) (bool, error) {
	if whenDate == "someday" {
		return false, nil
	}
	var count int
	err := r.db.QueryRow(
		"SELECT COUNT(*) FROM task_schedules WHERE task_id = ? AND when_date = ? AND start_time IS NULL AND id != ?",
		taskID, whenDate, excludeID).Scan(&count)
	return count > 0, err
}

// CreateFirstEntry creates a single schedule entry for a task (used by scheduler for repeat instances).
func (r *ScheduleRepository) CreateFirstEntry(taskID, date string) error {
	id := model.NewID()
	_, err := r.db.Exec(
		"INSERT INTO task_schedules (id, task_id, when_date, sort_order) VALUES (?, ?, ?, 0)",
		id, taskID, date)
	return err
}

// SyncFirstScheduleDate updates the first schedule entry's when_date to match tasks.when_date.
// This is called when when_date is updated via PATCH /tasks/{id}.
func (r *ScheduleRepository) SyncFirstScheduleDate(taskID string, date *string) error {
	if date == nil {
		// when_date set to NULL — delete all schedules
		_, err := r.db.Exec("DELETE FROM task_schedules WHERE task_id = ?", taskID)
		return err
	}
	// Check if there's a first schedule entry
	var schedID string
	var startTime sql.NullString
	err := r.db.QueryRow(
		"SELECT id, start_time FROM task_schedules WHERE task_id = ? ORDER BY sort_order ASC LIMIT 1",
		taskID).Scan(&schedID, &startTime)
	if err == sql.ErrNoRows {
		// Create one
		return r.CreateFirstEntry(taskID, *date)
	}
	if err != nil {
		return err
	}
	// Block duplicate timeless dates
	if !startTime.Valid && *date != "someday" {
		dup, err := r.HasDuplicateTimelessDate(taskID, *date, schedID)
		if err != nil {
			return err
		}
		if dup {
			return fmt.Errorf("duplicate timeless date")
		}
	}
	// Update existing first entry
	_, err = r.db.Exec("UPDATE task_schedules SET when_date = ? WHERE id = ?", *date, schedID)
	return err
}
