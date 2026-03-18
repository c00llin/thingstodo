package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type TaskRepository struct {
	db        *sql.DB
	changeLog *ChangeLogRepository
}

func NewTaskRepository(db *sql.DB, changeLog *ChangeLogRepository) *TaskRepository {
	return &TaskRepository{db: db, changeLog: changeLog}
}

func (r *TaskRepository) List(f model.TaskFilters) ([]model.TaskListItem, error) {
	query := `
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM reminders WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT type FROM reminders WHERE task_id = t.id ORDER BY created_at LIMIT 1),
			(SELECT value FROM reminders WHERE task_id = t.id ORDER BY created_at LIMIT 1),
			(SELECT exact_at FROM reminders WHERE task_id = t.id ORDER BY created_at LIMIT 1),
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t`

	var conditions []string
	var args []interface{}

	if f.Status != nil {
		conditions = append(conditions, "t.status = ?")
		args = append(args, *f.Status)
	}
	if f.ProjectID != nil {
		conditions = append(conditions, "t.project_id = ?")
		args = append(args, *f.ProjectID)
	}
	if f.AreaID != nil {
		conditions = append(conditions, "t.area_id = ?")
		args = append(args, *f.AreaID)
	}
	if f.HeadingID != nil {
		conditions = append(conditions, "t.heading_id = ?")
		args = append(args, *f.HeadingID)
	}
	if f.WhenDate != nil {
		conditions = append(conditions, "t.when_date = ?")
		args = append(args, *f.WhenDate)
	}
	if f.WhenBefore != nil {
		conditions = append(conditions, "t.when_date < ? AND t.when_date != 'someday'")
		args = append(args, *f.WhenBefore)
	}
	if f.WhenAfter != nil {
		conditions = append(conditions, "t.when_date >= ? AND t.when_date != 'someday'")
		args = append(args, *f.WhenAfter)
	}
	if f.HasDeadline != nil {
		if *f.HasDeadline {
			conditions = append(conditions, "t.deadline IS NOT NULL")
		} else {
			conditions = append(conditions, "t.deadline IS NULL")
		}
	}
	if len(f.TagIDs) > 0 {
		placeholders := make([]string, len(f.TagIDs))
		for i, id := range f.TagIDs {
			placeholders[i] = "?"
			args = append(args, id)
		}
		conditions = append(conditions, fmt.Sprintf(
			"t.id IN (SELECT task_id FROM task_tags WHERE tag_id IN (%s))",
			strings.Join(placeholders, ",")))
	}
	if f.Search != nil {
		conditions = append(conditions, "t.rowid IN (SELECT rowid FROM tasks_fts WHERE tasks_fts MATCH ?)")
		args = append(args, *f.Search)
	}

	conditions = append(conditions, "t.deleted_at IS NULL")

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY t.sort_order_today ASC, t.created_at ASC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []model.TaskListItem
	for rows.Next() {
		var t model.TaskListItem
		var whenEvening, highPriority, hasNotes, hasLinks, hasFiles, hasRepeat, hasReminders int
		if err := rows.Scan(
			&t.ID, &t.Title, &t.Notes, &t.Status, &t.WhenDate, &whenEvening, &highPriority,
			&t.Deadline, &t.ProjectID, &t.AreaID, &t.HeadingID,
			&t.SortOrderToday, &t.SortOrderProject, &t.SortOrderHeading,
			&t.CompletedAt, &t.CanceledAt, &t.DeletedAt, &t.CreatedAt, &t.UpdatedAt,
			&t.ChecklistCount, &t.ChecklistDone,
			&hasNotes, &hasLinks, &hasFiles, &hasRepeat, &hasReminders,
			&t.FirstReminderType, &t.FirstReminderValue, &t.FirstReminderExactAt,
			&t.FirstScheduleTime, &t.FirstScheduleEndTime,
		); err != nil {
			return nil, fmt.Errorf("scan task: %w", err)
		}
		_ = whenEvening // column retained in DB but no longer exposed
		t.HighPriority = highPriority == 1
		t.HasNotes = hasNotes == 1
		t.HasLinks = hasLinks == 1
		t.HasFiles = hasFiles == 1
		t.HasRepeatRule = hasRepeat == 1
		t.HasReminders = hasReminders == 1
		t.Tags, _ = r.getTaskTags(t.ID)
		tasks = append(tasks, t)
	}
	if tasks == nil {
		tasks = []model.TaskListItem{}
	}
	return tasks, rows.Err()
}

func (r *TaskRepository) GetByID(id string) (*model.TaskDetail, error) {
	var t model.TaskDetail
	var whenEvening, highPriority int
	err := r.db.QueryRow(`
		SELECT id, title, notes, status, when_date, when_evening, high_priority,
			deadline, project_id, area_id, heading_id,
			sort_order_today, sort_order_project, sort_order_heading,
			completed_at, canceled_at, deleted_at, created_at, updated_at
		FROM tasks WHERE id = ?`, id).Scan(
		&t.ID, &t.Title, &t.Notes, &t.Status, &t.WhenDate, &whenEvening, &highPriority,
		&t.Deadline, &t.ProjectID, &t.AreaID, &t.HeadingID,
		&t.SortOrderToday, &t.SortOrderProject, &t.SortOrderHeading,
		&t.CompletedAt, &t.CanceledAt, &t.DeletedAt, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get task: %w", err)
	}
	_ = whenEvening // column retained in DB but no longer exposed
	t.HighPriority = highPriority == 1

	// Load related refs
	if t.ProjectID != nil {
		t.Project = r.getRef("projects", *t.ProjectID)
	}
	if t.AreaID != nil {
		t.Area = r.getRef("areas", *t.AreaID)
	}
	if t.HeadingID != nil {
		t.HeadingRef = r.getRef("headings", *t.HeadingID)
	}

	t.Tags, _ = r.getTaskTags(id)
	t.Checklist, _ = r.getChecklist(id)
	t.Attachments, _ = r.getAttachments(id)
	t.RepeatRule, _ = r.getRepeatRule(id)
	t.Schedules, _ = r.getSchedules(id)
	t.Reminders, _ = r.getReminders(id)

	return &t, nil
}

func (r *TaskRepository) Create(input model.CreateTaskInput) (*model.TaskDetail, error) {
	id := input.ID
	if id == "" {
		id = model.NewID()
	}

	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order_today), 0) FROM tasks").Scan(&maxSort)

	_, err := r.db.Exec(`
		INSERT INTO tasks (id, title, notes, when_date, high_priority, deadline,
			project_id, area_id, heading_id, sort_order_today, sort_order_project, sort_order_heading)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, input.Title, input.Notes, input.WhenDate,
		boolToInt(input.HighPriority), input.Deadline, input.ProjectID, input.AreaID, input.HeadingID,
		maxSort+1024, maxSort+1024, maxSort+1024,
	)
	if err != nil {
		return nil, fmt.Errorf("create task: %w", err)
	}

	if len(input.TagIDs) > 0 {
		if err := r.setTaskTags(id, input.TagIDs); err != nil {
			return nil, fmt.Errorf("set task tags: %w", err)
		}
	}

	// Create first schedule entry if when_date is set
	if input.WhenDate != nil {
		_ = r.syncFirstScheduleDate(id, input.WhenDate)
	}

	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "create", nil, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) Update(id string, input model.UpdateTaskInput) (*model.TaskDetail, error) {
	var sets []string
	var args []interface{}

	if input.Title != nil {
		sets = append(sets, "title = ?")
		args = append(args, *input.Title)
	}
	if input.Notes != nil {
		sets = append(sets, "notes = ?")
		args = append(args, *input.Notes)
	}
	if _, ok := input.Raw["when_date"]; ok {
		sets = append(sets, "when_date = ?")
		args = append(args, input.WhenDate)
	}
	if input.HighPriority != nil {
		sets = append(sets, "high_priority = ?")
		args = append(args, boolToInt(*input.HighPriority))
	}
	if _, ok := input.Raw["deadline"]; ok {
		sets = append(sets, "deadline = ?")
		args = append(args, input.Deadline)
	}
	if _, ok := input.Raw["project_id"]; ok {
		sets = append(sets, "project_id = ?")
		args = append(args, input.ProjectID)
	}
	if _, ok := input.Raw["area_id"]; ok {
		sets = append(sets, "area_id = ?")
		args = append(args, input.AreaID)
	}
	if _, ok := input.Raw["heading_id"]; ok {
		sets = append(sets, "heading_id = ?")
		args = append(args, input.HeadingID)
	}

	if len(sets) > 0 {
		sets = append(sets, "updated_at = datetime('now')")
		args = append(args, id)
		_, err := r.db.Exec(
			"UPDATE tasks SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...)
		if err != nil {
			return nil, fmt.Errorf("update task: %w", err)
		}
	}

	if input.TagIDs != nil {
		if err := r.setTaskTags(id, input.TagIDs); err != nil {
			return nil, fmt.Errorf("set task tags: %w", err)
		}
	}

	// Sync first schedule entry when when_date changes
	if _, ok := input.Raw["when_date"]; ok {
		if err := r.syncFirstScheduleDate(id, input.WhenDate); err != nil {
			return nil, err
		}
	}

	task, err := r.GetByID(id)
	if err == nil && task != nil {
		var changedFields []string
		for k := range input.Raw {
			changedFields = append(changedFields, k)
		}
		if input.TagIDs != nil {
			changedFields = append(changedFields, "tag_ids")
		}
		logChange(r.changeLog, "task", id, "update", changedFields, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) Move(id string, input model.MoveTaskInput) (*model.TaskDetail, error) {
	var sets []string
	var args []interface{}

	sets = append(sets, "project_id = ?")
	args = append(args, input.ProjectID)

	sets = append(sets, "area_id = ?")
	args = append(args, input.AreaID)

	sets = append(sets, "heading_id = ?")
	args = append(args, input.HeadingID)

	if input.WhenDate != nil {
		sets = append(sets, "when_date = ?")
		args = append(args, *input.WhenDate)
	}

	sets = append(sets, "updated_at = datetime('now')")
	args = append(args, id)
	_, err := r.db.Exec("UPDATE tasks SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...)
	if err != nil {
		return nil, fmt.Errorf("move task: %w", err)
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"project_id", "area_id", "heading_id"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) Delete(id string) error {
	_, err := r.db.Exec("UPDATE tasks SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", id)
	if err == nil {
		logChange(r.changeLog, "task", id, "delete", nil, map[string]string{"id": id}, "", "")
	}
	return err
}

func (r *TaskRepository) Restore(id string) (*model.TaskDetail, error) {
	_, err := r.db.Exec("UPDATE tasks SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"deleted_at"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) PermanentDelete(id string) error {
	_, err := r.db.Exec("DELETE FROM tasks WHERE id = ?", id)
	if err == nil {
		logChange(r.changeLog, "task", id, "delete", nil, map[string]string{"id": id}, "", "")
	}
	return err
}

func (r *TaskRepository) Complete(id string) (*model.TaskDetail, error) {
	_, err := r.db.Exec(
		"UPDATE tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"status", "completed_at"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) Cancel(id string) (*model.TaskDetail, error) {
	_, err := r.db.Exec(
		"UPDATE tasks SET status = 'canceled', canceled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"status", "canceled_at"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) WontDo(id string) (*model.TaskDetail, error) {
	_, err := r.db.Exec(
		"UPDATE tasks SET status = 'wont_do', updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"status"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) Reopen(id string) (*model.TaskDetail, error) {
	_, err := r.db.Exec(
		"UPDATE tasks SET status = 'open', completed_at = NULL, canceled_at = NULL, updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"status", "completed_at", "canceled_at"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) MarkReviewed(id string) (*model.TaskDetail, error) {
	_, err := r.db.Exec("UPDATE tasks SET updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	task, err := r.GetByID(id)
	if err == nil && task != nil {
		logChange(r.changeLog, "task", id, "update", []string{"updated_at"}, task, "", "")
	}
	return task, err
}

func (r *TaskRepository) Reorder(items []model.ReorderItem) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, item := range items {
		field := item.SortField
		if field != "sort_order_today" && field != "sort_order_project" && field != "sort_order_heading" {
			return fmt.Errorf("invalid sort field: %s", field)
		}
		_, err := tx.Exec("UPDATE tasks SET "+field+" = ? WHERE id = ?", item.SortOrder, item.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *TaskRepository) BulkAction(input model.BulkActionInput) (int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	affected := 0
	now := "datetime('now')"

	for _, id := range input.TaskIDs {
		var execErr error
		switch input.Action {
		case "complete":
			_, execErr = tx.Exec(
				"UPDATE tasks SET status = 'completed', completed_at = "+now+", updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "cancel":
			_, execErr = tx.Exec(
				"UPDATE tasks SET status = 'canceled', canceled_at = "+now+", updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "wontdo":
			_, execErr = tx.Exec(
				"UPDATE tasks SET status = 'wont_do', updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "delete":
			_, execErr = tx.Exec(
				"UPDATE tasks SET deleted_at = "+now+", updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "set_when":
			whenDate, _ := input.Params["when_date"].(string)
			_, execErr = tx.Exec(
				"UPDATE tasks SET when_date = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL",
				bulkNilIfEmpty(whenDate), id)
		case "set_deadline":
			deadline, _ := input.Params["deadline"].(string)
			_, execErr = tx.Exec(
				"UPDATE tasks SET deadline = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL",
				bulkNilIfEmpty(deadline), id)
		case "set_priority":
			priority, _ := input.Params["priority"].(float64)
			p := int(priority)
			_, execErr = tx.Exec(
				"UPDATE tasks SET high_priority = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", p, id)
		case "toggle_priority":
			_, execErr = tx.Exec(
				"UPDATE tasks SET high_priority = CASE WHEN high_priority = 1 THEN 0 ELSE 1 END, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "move_project":
			projectID, _ := input.Params["project_id"].(string)
			areaID, _ := input.Params["area_id"].(string)
			_, execErr = tx.Exec(
				"UPDATE tasks SET project_id = ?, area_id = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL",
				bulkNilIfEmpty(projectID), bulkNilIfEmpty(areaID), id)
		case "add_tags":
			tagIDs, ok := input.Params["tag_ids"].([]interface{})
			if ok {
				for _, rawTagID := range tagIDs {
					tagID, _ := rawTagID.(string)
					if tagID != "" {
						_, execErr = tx.Exec(
							"INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", id, tagID)
						if execErr != nil {
							break
						}
					}
				}
			}
		case "remove_tags":
			tagIDs, ok := input.Params["tag_ids"].([]interface{})
			if ok {
				for _, rawTagID := range tagIDs {
					tagID, _ := rawTagID.(string)
					if tagID != "" {
						_, execErr = tx.Exec(
							"DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?", id, tagID)
						if execErr != nil {
							break
						}
					}
				}
			}
		case "toggle_tags":
			tagIDs, ok := input.Params["tag_ids"].([]interface{})
			if ok {
				for _, rawTagID := range tagIDs {
					tagID, _ := rawTagID.(string)
					if tagID != "" {
						var exists int
						_ = tx.QueryRow("SELECT COUNT(*) FROM task_tags WHERE task_id = ? AND tag_id = ?", id, tagID).Scan(&exists)
						if exists > 0 {
							_, execErr = tx.Exec("DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?", id, tagID)
						} else {
							_, execErr = tx.Exec("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", id, tagID)
						}
						if execErr != nil {
							break
						}
					}
				}
			}
		case "mark_reviewed":
			_, execErr = tx.Exec(
				"UPDATE tasks SET updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL AND status = 'open'", id)
		default:
			return 0, fmt.Errorf("unknown bulk action: %s", input.Action)
		}
		if execErr != nil {
			return 0, execErr
		}
		affected++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	// Sync schedule entries after commit for date changes
	if input.Action == "set_when" {
		whenDate, _ := input.Params["when_date"].(string)
		for _, id := range input.TaskIDs {
			wd := whenDate
			_ = r.syncFirstScheduleDate(id, &wd)
		}
	}

	return affected, nil
}

func bulkNilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// --- helpers ---

func (r *TaskRepository) getTaskTags(taskID string) ([]model.TagRef, error) {
	rows, err := r.db.Query(
		"SELECT t.id, t.title, t.color FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ? ORDER BY t.sort_order", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []model.TagRef
	for rows.Next() {
		var t model.TagRef
		_ = rows.Scan(&t.ID, &t.Title, &t.Color)
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []model.TagRef{}
	}
	return tags, nil
}

func (r *TaskRepository) setTaskTags(taskID string, tagIDs []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec("DELETE FROM task_tags WHERE task_id = ?", taskID); err != nil {
		return fmt.Errorf("delete task tags: %w", err)
	}
	for _, tagID := range tagIDs {
		if _, err := tx.Exec("INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", taskID, tagID); err != nil {
			return fmt.Errorf("insert task tag: %w", err)
		}
	}
	return tx.Commit()
}

func (r *TaskRepository) getChecklist(taskID string) ([]model.ChecklistItem, error) {
	rows, err := r.db.Query(
		"SELECT id, title, completed, sort_order FROM checklist_items WHERE task_id = ? ORDER BY sort_order", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.ChecklistItem
	for rows.Next() {
		var c model.ChecklistItem
		var completed int
		_ = rows.Scan(&c.ID, &c.Title, &completed, &c.SortOrder)
		c.Completed = completed == 1
		items = append(items, c)
	}
	if items == nil {
		items = []model.ChecklistItem{}
	}
	return items, nil
}

func (r *TaskRepository) getReminders(taskID string) ([]model.Reminder, error) {
	rows, err := r.db.Query(
		"SELECT id, type, value, exact_at, created_at FROM reminders WHERE task_id = ? ORDER BY created_at", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.Reminder
	for rows.Next() {
		var rm model.Reminder
		_ = rows.Scan(&rm.ID, &rm.Type, &rm.Value, &rm.ExactAt, &rm.CreatedAt)
		items = append(items, rm)
	}
	if items == nil {
		items = []model.Reminder{}
	}
	return items, nil
}

func (r *TaskRepository) getAttachments(taskID string) ([]model.Attachment, error) {
	rows, err := r.db.Query(
		"SELECT id, type, title, url, mime_type, file_size, sort_order, created_at FROM attachments WHERE task_id = ? ORDER BY sort_order", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.Attachment
	for rows.Next() {
		var a model.Attachment
		_ = rows.Scan(&a.ID, &a.Type, &a.Title, &a.URL, &a.MimeType, &a.FileSize, &a.SortOrder, &a.CreatedAt)
		items = append(items, a)
	}
	if items == nil {
		items = []model.Attachment{}
	}
	return items, nil
}

func (r *TaskRepository) getRepeatRule(taskID string) (*model.RepeatRule, error) {
	var rr model.RepeatRule
	var patternJSON string
	err := r.db.QueryRow(
		"SELECT id, pattern FROM repeat_rules WHERE task_id = ?", taskID,
	).Scan(&rr.ID, &patternJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if patternJSON != "" {
		if err := json.Unmarshal([]byte(patternJSON), &rr.Pattern); err != nil {
			return nil, fmt.Errorf("unmarshal repeat pattern: %w", err)
		}
	}
	// Populate deprecated flat fields for backwards compat
	rr.Mode = string(rr.Pattern.Mode)
	rr.IntervalValue = rr.Pattern.Every
	rr.Frequency = patternToFrequency(rr.Pattern.Type)
	if rr.Pattern.Type == model.PatternWeekly {
		rr.DayConstraints = rr.Pattern.On
	}
	if rr.DayConstraints == nil {
		rr.DayConstraints = []string{}
	}
	return &rr, nil
}

// syncFirstScheduleDate keeps the first task_schedules entry in sync with the task's when_date.
// If when_date is non-null and no schedule entry exists, creates one.
// If when_date is non-null and a schedule entry exists, updates its when_date.
// If when_date is null, deletes all schedule entries.
// Returns an error if the update would create a duplicate timeless date.
func (r *TaskRepository) syncFirstScheduleDate(taskID string, whenDate *string) error {
	if whenDate == nil {
		// Clear all schedule entries
		_, err := r.db.Exec("DELETE FROM task_schedules WHERE task_id = ?", taskID)
		return err
	}
	// Check if first entry exists
	var existingID string
	var startTime sql.NullString
	err := r.db.QueryRow(
		"SELECT id, start_time FROM task_schedules WHERE task_id = ? ORDER BY sort_order ASC LIMIT 1", taskID,
	).Scan(&existingID, &startTime)
	if err == sql.ErrNoRows {
		// Create first entry
		id := model.NewID()
		_, err = r.db.Exec(
			"INSERT INTO task_schedules (id, task_id, when_date, sort_order) VALUES (?, ?, ?, 0)",
			id, taskID, *whenDate)
		return err
	} else if err != nil {
		return err
	}
	// Block duplicate timeless dates
	if !startTime.Valid && *whenDate != "someday" {
		var count int
		_ = r.db.QueryRow(
			"SELECT COUNT(*) FROM task_schedules WHERE task_id = ? AND when_date = ? AND start_time IS NULL AND id != ?",
			taskID, *whenDate, existingID).Scan(&count)
		if count > 0 {
			return fmt.Errorf("duplicate timeless date")
		}
	}
	// Update existing first entry's date
	_, err = r.db.Exec("UPDATE task_schedules SET when_date = ? WHERE id = ?", *whenDate, existingID)
	return err
}

func (r *TaskRepository) getSchedules(taskID string) ([]model.TaskSchedule, error) {
	rows, err := r.db.Query(
		"SELECT id, when_date, start_time, end_time, completed, sort_order FROM task_schedules WHERE task_id = ? ORDER BY sort_order", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.TaskSchedule
	for rows.Next() {
		var s model.TaskSchedule
		_ = rows.Scan(&s.ID, &s.WhenDate, &s.StartTime, &s.EndTime, &s.Completed, &s.SortOrder)
		items = append(items, s)
	}
	if items == nil {
		items = []model.TaskSchedule{}
	}
	return items, nil
}

func patternToFrequency(pt model.PatternType) string {
	switch pt {
	case model.PatternDaily, model.PatternDailyWeekday, model.PatternDailyWeekend:
		return "daily"
	case model.PatternWeekly:
		return "weekly"
	case model.PatternMonthlyDOM, model.PatternMonthlyDOW, model.PatternMonthlyWorkday:
		return "monthly"
	case model.PatternYearlyDate, model.PatternYearlyDOW:
		return "yearly"
	default:
		return "daily"
	}
}

func (r *TaskRepository) getRef(table, id string) *model.Ref {
	if !validRefTables[table] {
		return nil
	}
	var ref model.Ref
	err := r.db.QueryRow("SELECT id, title FROM "+table+" WHERE id = ?", id).Scan(&ref.ID, &ref.Title)
	if err != nil {
		return nil
	}
	return &ref
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
