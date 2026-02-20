package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type TagRepository struct {
	db *sql.DB
}

func NewTagRepository(db *sql.DB) *TagRepository {
	return &TagRepository{db: db}
}

func (r *TagRepository) List() ([]model.Tag, error) {
	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.color, t.parent_tag_id, t.sort_order,
			COALESCE((SELECT COUNT(*) FROM task_tags tt2 JOIN tasks tk ON tk.id = tt2.task_id WHERE tt2.tag_id = t.id AND tk.deleted_at IS NULL), 0)
		FROM tags t ORDER BY t.sort_order ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []model.Tag
	for rows.Next() {
		var t model.Tag
		_ = rows.Scan(&t.ID, &t.Title, &t.Color, &t.ParentTagID, &t.SortOrder, &t.TaskCount)
		tags = append(tags, t)
	}
	if tags == nil {
		tags = []model.Tag{}
	}
	return tags, rows.Err()
}

func (r *TagRepository) Create(input model.CreateTagInput) (*model.Tag, error) {
	id := model.NewID()
	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM tags").Scan(&maxSort)

	_, err := r.db.Exec("INSERT INTO tags (id, title, parent_tag_id, sort_order) VALUES (?, ?, ?, ?)",
		id, input.Title, input.ParentTagID, maxSort+1024)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return nil, ErrDuplicateTagName
		}
		return nil, fmt.Errorf("create tag: %w", err)
	}

	var t model.Tag
	_ = r.db.QueryRow("SELECT id, title, color, parent_tag_id, sort_order FROM tags WHERE id = ?", id).
		Scan(&t.ID, &t.Title, &t.Color, &t.ParentTagID, &t.SortOrder)
	return &t, nil
}

func (r *TagRepository) Update(id string, input model.UpdateTagInput) (*model.Tag, error) {
	if input.Title != nil {
		_, err := r.db.Exec("UPDATE tags SET title = ? WHERE id = ?", *input.Title, id)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE constraint failed") {
				return nil, ErrDuplicateTagName
			}
			return nil, err
		}
	}
	if _, ok := input.Raw["color"]; ok {
		_, _ = r.db.Exec("UPDATE tags SET color = ? WHERE id = ?", input.Color, id)
	}
	if _, ok := input.Raw["parent_tag_id"]; ok {
		_, _ = r.db.Exec("UPDATE tags SET parent_tag_id = ? WHERE id = ?", input.ParentTagID, id)
	}
	if input.SortOrder != nil {
		_, _ = r.db.Exec("UPDATE tags SET sort_order = ? WHERE id = ?", *input.SortOrder, id)
	}

	var t model.Tag
	err := r.db.QueryRow("SELECT id, title, color, parent_tag_id, sort_order FROM tags WHERE id = ?", id).
		Scan(&t.ID, &t.Title, &t.Color, &t.ParentTagID, &t.SortOrder)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &t, err
}

func (r *TagRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM tags WHERE id = ?", id)
	return err
}

func (r *TagRepository) GetTasksByTag(tagID string) ([]model.TaskListItem, error) {
	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		JOIN task_tags tt ON t.id = tt.task_id
		WHERE tt.tag_id = ? AND t.deleted_at IS NULL AND t.status = 'open'
		ORDER BY t.sort_order_today`, tagID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTaskListItems(r.db, rows), nil
}
