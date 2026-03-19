package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type ReminderRepository struct {
	db        *sql.DB
	changeLog *ChangeLogRepository
}

func NewReminderRepository(db *sql.DB, changeLog *ChangeLogRepository) *ReminderRepository {
	return &ReminderRepository{db: db, changeLog: changeLog}
}

func (r *ReminderRepository) ListByTask(taskID string) ([]model.Reminder, error) {
	rows, err := r.db.Query(
		"SELECT id, type, value, exact_at, created_at FROM reminders WHERE task_id = ? ORDER BY created_at", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.Reminder
	for rows.Next() {
		var rm model.Reminder
		if err := rows.Scan(&rm.ID, &rm.Type, &rm.Value, &rm.ExactAt, &rm.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan reminder: %w", err)
		}
		items = append(items, rm)
	}
	if items == nil {
		items = []model.Reminder{}
	}
	return items, rows.Err()
}

// ListAll returns all reminders across all tasks.
func (r *ReminderRepository) ListAll() ([]model.Reminder, error) {
	rows, err := r.db.Query(
		"SELECT id, task_id, type, value, exact_at, created_at FROM reminders ORDER BY created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.Reminder
	for rows.Next() {
		var rm model.Reminder
		if err := rows.Scan(&rm.ID, &rm.TaskID, &rm.Type, &rm.Value, &rm.ExactAt, &rm.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan reminder: %w", err)
		}
		items = append(items, rm)
	}
	if items == nil {
		items = []model.Reminder{}
	}
	return items, rows.Err()
}

func (r *ReminderRepository) Create(taskID string, input model.CreateReminderInput) (*model.Reminder, error) {
	id := input.ID
	if id == "" {
		id = model.NewID()
	}
	_, err := r.db.Exec(
		"INSERT INTO reminders (id, task_id, type, value, exact_at) VALUES (?, ?, ?, ?, ?)",
		id, taskID, input.Type, input.Value, input.ExactAt)
	if err != nil {
		return nil, fmt.Errorf("create reminder: %w", err)
	}

	var rm model.Reminder
	err = r.db.QueryRow(
		"SELECT id, task_id, type, value, exact_at, created_at FROM reminders WHERE id = ?", id).
		Scan(&rm.ID, &rm.TaskID, &rm.Type, &rm.Value, &rm.ExactAt, &rm.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("read back reminder: %w", err)
	}
	logChange(r.changeLog, "reminder", id, "create", nil, &rm, "", "")
	return &rm, nil
}

func (r *ReminderRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM reminders WHERE id = ?", id)
	if err == nil {
		logChange(r.changeLog, "reminder", id, "delete", nil, map[string]string{"id": id}, "", "")
	}
	return err
}

func (r *ReminderRepository) DeleteAllByTask(taskID string) error {
	// Collect reminder IDs before deleting so we can log each deletion
	rows, err := r.db.Query("SELECT id FROM reminders WHERE task_id = ?", taskID)
	if err != nil {
		return fmt.Errorf("collect reminder IDs: %w", err)
	}
	var ids []string
	for rows.Next() {
		var id string
		_ = rows.Scan(&id)
		ids = append(ids, id)
	}
	rows.Close()

	_, err = r.db.Exec("DELETE FROM reminders WHERE task_id = ?", taskID)
	if err != nil {
		return err
	}

	for _, id := range ids {
		logChange(r.changeLog, "reminder", id, "delete", nil, map[string]string{"id": id}, "", "")
	}
	return nil
}

// GetTaskIDForReminder returns the task_id that owns a given reminder.
func (r *ReminderRepository) GetTaskIDForReminder(id string) (string, error) {
	var taskID string
	err := r.db.QueryRow("SELECT task_id FROM reminders WHERE id = ?", id).Scan(&taskID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return taskID, err
}

// HasBeenSent checks the reminder_log to see if this reminder+schedule+fire_at combo was already sent.
func (r *ReminderRepository) HasBeenSent(reminderID, scheduleID, fireAt string) (bool, error) {
	var count int
	err := r.db.QueryRow(
		"SELECT COUNT(*) FROM reminder_log WHERE reminder_id = ? AND schedule_id = ? AND fire_at = ?",
		reminderID, scheduleID, fireAt).Scan(&count)
	return count > 0, err
}

// MarkSent records that a reminder was sent.
// No logChange here — reminder_log is not synced intentionally.
func (r *ReminderRepository) MarkSent(reminderID, scheduleID, fireAt string) error {
	id := model.NewID()
	_, err := r.db.Exec(
		"INSERT OR IGNORE INTO reminder_log (id, reminder_id, schedule_id, fire_at) VALUES (?, ?, ?, ?)",
		id, reminderID, scheduleID, fireAt)
	return err
}

// GetPendingRelative returns all relative reminders joined with their task schedules
// for open tasks with non-completed schedules.
func (r *ReminderRepository) GetPendingRelative() ([]model.PendingReminder, error) {
	rows, err := r.db.Query(`
		SELECT rem.id, rem.type, rem.value, rem.exact_at, rem.task_id,
		       t.title,
		       ts.id, ts.when_date, ts.start_time
		FROM reminders rem
		JOIN tasks t ON t.id = rem.task_id
		JOIN task_schedules ts ON ts.task_id = t.id AND ts.completed = 0
		WHERE t.status = 'open' AND t.deleted_at IS NULL
		  AND rem.type != 'exact'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.PendingReminder
	for rows.Next() {
		var p model.PendingReminder
		if err := rows.Scan(
			&p.Reminder.ID, &p.Reminder.Type, &p.Reminder.Value, &p.Reminder.ExactAt,
			&p.TaskID, &p.TaskTitle,
			&p.ScheduleID, &p.WhenDate, &p.StartTime,
		); err != nil {
			return nil, fmt.Errorf("scan pending reminder: %w", err)
		}
		p.Reminder.TaskID = p.TaskID
		items = append(items, p)
	}
	return items, rows.Err()
}

// GetPendingExact returns all exact-type reminders for open tasks.
func (r *ReminderRepository) GetPendingExact() ([]model.PendingReminder, error) {
	rows, err := r.db.Query(`
		SELECT rem.id, rem.type, rem.value, rem.exact_at, rem.task_id,
		       t.title
		FROM reminders rem
		JOIN tasks t ON t.id = rem.task_id
		WHERE t.status = 'open' AND t.deleted_at IS NULL
		  AND rem.type = 'exact' AND rem.exact_at IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.PendingReminder
	for rows.Next() {
		var p model.PendingReminder
		if err := rows.Scan(
			&p.Reminder.ID, &p.Reminder.Type, &p.Reminder.Value, &p.Reminder.ExactAt,
			&p.TaskID, &p.TaskTitle,
		); err != nil {
			return nil, fmt.Errorf("scan pending exact reminder: %w", err)
		}
		p.Reminder.TaskID = p.TaskID
		items = append(items, p)
	}
	return items, rows.Err()
}
