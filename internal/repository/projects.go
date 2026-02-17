package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type ProjectRepository struct {
	db *sql.DB
}

func NewProjectRepository(db *sql.DB) *ProjectRepository {
	return &ProjectRepository{db: db}
}

func (r *ProjectRepository) List(areaID, status *string) ([]model.ProjectListItem, error) {
	query := `
		SELECT p.id, p.title, p.notes, p.area_id, p.status, p.when_date, p.deadline,
			p.sort_order, p.created_at, p.updated_at,
			COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = p.id), 0),
			COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed'), 0)
		FROM projects p`

	var conditions []string
	var args []interface{}
	if areaID != nil {
		conditions = append(conditions, "p.area_id = ?")
		args = append(args, *areaID)
	}
	if status != nil {
		conditions = append(conditions, "p.status = ?")
		args = append(args, *status)
	}
	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}
	query += " ORDER BY p.sort_order ASC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	defer rows.Close()

	var projects []model.ProjectListItem
	for rows.Next() {
		var p model.ProjectListItem
		if err := rows.Scan(
			&p.ID, &p.Title, &p.Notes, &p.AreaID, &p.Status, &p.WhenDate, &p.Deadline,
			&p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
			&p.TaskCount, &p.CompletedTaskCount,
		); err != nil {
			return nil, err
		}
		if p.AreaID != nil {
			p.Area = getRef(r.db, "areas", *p.AreaID)
		}
		p.Tags = getProjectTags(r.db, p.ID)
		projects = append(projects, p)
	}
	if projects == nil {
		projects = []model.ProjectListItem{}
	}
	return projects, rows.Err()
}

func (r *ProjectRepository) GetByID(id string) (*model.ProjectDetail, error) {
	var p model.ProjectDetail
	err := r.db.QueryRow(`
		SELECT p.id, p.title, p.notes, p.area_id, p.status, p.when_date, p.deadline,
			p.sort_order, p.created_at, p.updated_at,
			COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = p.id), 0),
			COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed'), 0)
		FROM projects p WHERE p.id = ?`, id).Scan(
		&p.ID, &p.Title, &p.Notes, &p.AreaID, &p.Status, &p.WhenDate, &p.Deadline,
		&p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		&p.TaskCount, &p.CompletedTaskCount,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if p.AreaID != nil {
		p.Area = getRef(r.db, "areas", *p.AreaID)
	}
	p.Tags = getProjectTags(r.db, id)

	// Load headings with tasks
	headingRows, err := r.db.Query(
		"SELECT id, title, project_id, sort_order FROM headings WHERE project_id = ? ORDER BY sort_order", id)
	if err != nil {
		return nil, err
	}
	defer headingRows.Close()

	var headings []model.HeadingWithTasks
	for headingRows.Next() {
		var h model.HeadingWithTasks
		if err := headingRows.Scan(&h.ID, &h.Title, &h.ProjectID, &h.SortOrder); err != nil {
			return nil, fmt.Errorf("scan heading: %w", err)
		}
		h.Tasks = getTaskListItems(r.db, "heading_id", h.ID)
		headings = append(headings, h)
	}
	if headings == nil {
		headings = []model.HeadingWithTasks{}
	}
	p.Headings = headings

	// Tasks without heading
	p.TasksWithoutHeading = getTaskListItemsNoHeading(r.db, id)

	return &p, nil
}

func (r *ProjectRepository) Create(input model.CreateProjectInput) (*model.ProjectDetail, error) {
	id := model.NewID()
	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM projects").Scan(&maxSort)

	_, err := r.db.Exec(`
		INSERT INTO projects (id, title, notes, area_id, when_date, deadline, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, input.Title, input.Notes, input.AreaID, input.WhenDate, input.Deadline, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create project: %w", err)
	}
	if len(input.TagIDs) > 0 {
		setProjectTags(r.db, id, input.TagIDs)
	}
	return r.GetByID(id)
}

func (r *ProjectRepository) Update(id string, input model.UpdateProjectInput) (*model.ProjectDetail, error) {
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
	if _, ok := input.Raw["area_id"]; ok {
		sets = append(sets, "area_id = ?")
		args = append(args, input.AreaID)
	}
	if input.Status != nil {
		sets = append(sets, "status = ?")
		args = append(args, *input.Status)
	}
	if _, ok := input.Raw["when_date"]; ok {
		sets = append(sets, "when_date = ?")
		args = append(args, input.WhenDate)
	}
	if _, ok := input.Raw["deadline"]; ok {
		sets = append(sets, "deadline = ?")
		args = append(args, input.Deadline)
	}

	if len(sets) > 0 {
		sets = append(sets, "updated_at = datetime('now')")
		args = append(args, id)
		_, err := r.db.Exec("UPDATE projects SET "+strings.Join(sets, ", ")+" WHERE id = ?", args...)
		if err != nil {
			return nil, err
		}
	}
	if input.TagIDs != nil {
		setProjectTags(r.db, id, input.TagIDs)
	}
	return r.GetByID(id)
}

func (r *ProjectRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM projects WHERE id = ?", id)
	return err
}

func (r *ProjectRepository) Complete(id string) (*model.ProjectDetail, error) {
	_, err := r.db.Exec(
		"UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ?", id)
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *ProjectRepository) Reorder(items []model.SimpleReorderItem) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, item := range items {
		_, err := tx.Exec("UPDATE projects SET sort_order = ? WHERE id = ?", item.SortOrder, item.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

// --- shared helpers ---

func getRef(db *sql.DB, table, id string) *model.Ref {
	var ref model.Ref
	err := db.QueryRow("SELECT id, title FROM "+table+" WHERE id = ?", id).Scan(&ref.ID, &ref.Title)
	if err != nil {
		return nil
	}
	return &ref
}

func getProjectTags(db *sql.DB, projectID string) []model.TagRef {
	rows, err := db.Query(
		"SELECT t.id, t.title FROM tags t JOIN project_tags pt ON t.id = pt.tag_id WHERE pt.project_id = ? ORDER BY t.sort_order", projectID)
	if err != nil {
		return []model.TagRef{}
	}
	defer rows.Close()
	var tags []model.TagRef
	for rows.Next() {
		var t model.TagRef
		_ = rows.Scan(&t.ID, &t.Title)
		tags = append(tags, t)
	}
	if tags == nil {
		return []model.TagRef{}
	}
	return tags
}

func setProjectTags(db *sql.DB, projectID string, tagIDs []string) {
	_, _ = db.Exec("DELETE FROM project_tags WHERE project_id = ?", projectID)
	for _, tagID := range tagIDs {
		_, _ = db.Exec("INSERT OR IGNORE INTO project_tags (project_id, tag_id) VALUES (?, ?)", projectID, tagID)
	}
}

func getTaskListItems(db *sql.DB, filterCol, filterVal string) []model.TaskListItem {
	rows, err := db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id) THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t WHERE t.`+filterCol+` = ? AND t.status = 'open'
		ORDER BY t.sort_order_project ASC`, filterVal)
	if err != nil {
		return []model.TaskListItem{}
	}
	defer rows.Close()
	return scanTaskListItems(db, rows)
}

func getTaskListItemsNoHeading(db *sql.DB, projectID string) []model.TaskListItem {
	rows, err := db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id) THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t WHERE t.project_id = ? AND t.heading_id IS NULL AND t.status = 'open'
		ORDER BY t.sort_order_project ASC`, projectID)
	if err != nil {
		return []model.TaskListItem{}
	}
	defer rows.Close()
	return scanTaskListItems(db, rows)
}

func scanTaskListItems(db *sql.DB, rows *sql.Rows) []model.TaskListItem {
	var tasks []model.TaskListItem
	for rows.Next() {
		var t model.TaskListItem
		var whenEvening, hasNotes, hasAttach, hasRepeat int
		_ = rows.Scan(
			&t.ID, &t.Title, &t.Notes, &t.Status, &t.WhenDate, &whenEvening,
			&t.Deadline, &t.ProjectID, &t.AreaID, &t.HeadingID,
			&t.SortOrderToday, &t.SortOrderProject, &t.SortOrderHeading,
			&t.CompletedAt, &t.CanceledAt, &t.CreatedAt, &t.UpdatedAt,
			&t.ChecklistCount, &t.ChecklistDone,
			&hasNotes, &hasAttach, &hasRepeat,
		)
		t.WhenEvening = whenEvening == 1
		t.HasNotes = hasNotes == 1
		t.HasAttachments = hasAttach == 1
		t.HasRepeatRule = hasRepeat == 1
		// Get tags
		tagRows, _ := db.Query(
			"SELECT t.id, t.title FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ?", t.ID)
		if tagRows != nil {
			var tags []model.TagRef
			for tagRows.Next() {
				var tag model.TagRef
				_ = tagRows.Scan(&tag.ID, &tag.Title)
				tags = append(tags, tag)
			}
			tagRows.Close()
			if tags == nil {
				tags = []model.TagRef{}
			}
			t.Tags = tags
		} else {
			t.Tags = []model.TagRef{}
		}
		// Resolve project/area names
		if t.ProjectID != nil {
			var name string
			if err := db.QueryRow("SELECT title FROM projects WHERE id = ?", *t.ProjectID).Scan(&name); err == nil {
				t.ProjectName = &name
			}
		}
		if t.AreaID != nil {
			var name string
			if err := db.QueryRow("SELECT title FROM areas WHERE id = ?", *t.AreaID).Scan(&name); err == nil {
				t.AreaName = &name
			}
		}
		tasks = append(tasks, t)
	}
	if tasks == nil {
		tasks = []model.TaskListItem{}
	}
	return tasks
}
