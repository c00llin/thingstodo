package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type AreaRepository struct {
	db *sql.DB
}

func NewAreaRepository(db *sql.DB) *AreaRepository {
	return &AreaRepository{db: db}
}

func (r *AreaRepository) List() ([]model.Area, error) {
	rows, err := r.db.Query(`
		SELECT a.id, a.title, a.sort_order, a.created_at, a.updated_at,
			COALESCE((SELECT COUNT(*) FROM projects WHERE area_id = a.id), 0),
			COALESCE((SELECT COUNT(*) FROM tasks WHERE area_id = a.id AND deleted_at IS NULL), 0),
			COALESCE((SELECT COUNT(*) FROM tasks WHERE area_id = a.id AND project_id IS NULL AND status = 'open' AND deleted_at IS NULL), 0)
		FROM areas a ORDER BY a.sort_order ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var areas []model.Area
	for rows.Next() {
		var a model.Area
		if err := rows.Scan(&a.ID, &a.Title, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt, &a.ProjectCount, &a.TaskCount, &a.StandaloneTaskCount); err != nil {
			return nil, fmt.Errorf("scan area: %w", err)
		}
		areas = append(areas, a)
	}
	if areas == nil {
		areas = []model.Area{}
	}
	return areas, rows.Err()
}

func (r *AreaRepository) GetByID(id string) (*model.AreaDetail, error) {
	var a model.AreaDetail
	err := r.db.QueryRow(
		"SELECT id, title, sort_order, created_at, updated_at FROM areas WHERE id = ?", id,
	).Scan(&a.ID, &a.Title, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// Projects in this area
	projRows, err := r.db.Query(`
		SELECT p.id, p.title, p.notes, p.area_id, p.status, p.when_date, p.deadline,
			p.sort_order, p.created_at, p.updated_at,
			COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND deleted_at IS NULL), 0),
			COALESCE((SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed' AND deleted_at IS NULL), 0)
		FROM projects p WHERE p.area_id = ? AND p.status = 'open' ORDER BY p.sort_order`, id)
	if err != nil {
		return nil, err
	}
	defer projRows.Close()

	var projects []model.ProjectListItem
	for projRows.Next() {
		var p model.ProjectListItem
		if err := projRows.Scan(&p.ID, &p.Title, &p.Notes, &p.AreaID, &p.Status, &p.WhenDate, &p.Deadline,
			&p.SortOrder, &p.CreatedAt, &p.UpdatedAt, &p.TaskCount, &p.CompletedTaskCount); err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		p.Tags = getProjectTags(r.db, p.ID)
		projects = append(projects, p)
	}
	if projects == nil {
		projects = []model.ProjectListItem{}
	}
	a.Projects = projects

	// Standalone tasks in this area (no project)
	taskRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t WHERE t.area_id = ? AND t.project_id IS NULL AND t.status = 'open' AND t.deleted_at IS NULL
		ORDER BY t.sort_order_today`, id)
	if err != nil {
		return nil, err
	}
	defer taskRows.Close()
	a.Tasks = scanTaskListItems(r.db, taskRows)

	return &a, nil
}

func (r *AreaRepository) Create(input model.CreateAreaInput) (*model.Area, error) {
	id := model.NewID()
	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM areas").Scan(&maxSort)

	_, err := r.db.Exec("INSERT INTO areas (id, title, sort_order) VALUES (?, ?, ?)",
		id, input.Title, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create area: %w", err)
	}

	var a model.Area
	_ = r.db.QueryRow("SELECT id, title, sort_order, created_at, updated_at FROM areas WHERE id = ?", id).
		Scan(&a.ID, &a.Title, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt)
	return &a, nil
}

func (r *AreaRepository) Update(id string, input model.UpdateAreaInput) (*model.Area, error) {
	if input.Title != nil {
		_, _ = r.db.Exec("UPDATE areas SET title = ?, updated_at = datetime('now') WHERE id = ?", *input.Title, id)
	}
	if input.SortOrder != nil {
		_, _ = r.db.Exec("UPDATE areas SET sort_order = ?, updated_at = datetime('now') WHERE id = ?", *input.SortOrder, id)
	}
	var a model.Area
	err := r.db.QueryRow("SELECT id, title, sort_order, created_at, updated_at FROM areas WHERE id = ?", id).
		Scan(&a.ID, &a.Title, &a.SortOrder, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

var ErrAreaHasProjects = fmt.Errorf("area still has projects")

func (r *AreaRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM areas WHERE id = ?", id)
	return err
}

func (r *AreaRepository) DeleteWithTasks(id string) error {
	var count int
	if err := r.db.QueryRow("SELECT COUNT(*) FROM projects WHERE area_id = ?", id).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return ErrAreaHasProjects
	}

	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec("DELETE FROM tasks WHERE area_id = ? AND project_id IS NULL", id); err != nil {
		return fmt.Errorf("delete area tasks: %w", err)
	}
	if _, err := tx.Exec("DELETE FROM areas WHERE id = ?", id); err != nil {
		return fmt.Errorf("delete area: %w", err)
	}
	return tx.Commit()
}
