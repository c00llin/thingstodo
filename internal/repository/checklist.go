package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type ChecklistRepository struct {
	db *sql.DB
}

func NewChecklistRepository(db *sql.DB) *ChecklistRepository {
	return &ChecklistRepository{db: db}
}

func (r *ChecklistRepository) ListByTask(taskID string) ([]model.ChecklistItem, error) {
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
		if err := rows.Scan(&c.ID, &c.Title, &completed, &c.SortOrder); err != nil {
			return nil, fmt.Errorf("scan checklist item: %w", err)
		}
		c.Completed = completed == 1
		items = append(items, c)
	}
	if items == nil {
		items = []model.ChecklistItem{}
	}
	return items, rows.Err()
}

func (r *ChecklistRepository) Create(taskID string, input model.CreateChecklistInput) (*model.ChecklistItem, error) {
	id := model.NewID()
	var maxSort float64
	r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM checklist_items WHERE task_id = ?", taskID).Scan(&maxSort)

	_, err := r.db.Exec("INSERT INTO checklist_items (id, task_id, title, sort_order) VALUES (?, ?, ?, ?)",
		id, taskID, input.Title, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create checklist item: %w", err)
	}

	var c model.ChecklistItem
	var completed int
	r.db.QueryRow("SELECT id, title, completed, sort_order FROM checklist_items WHERE id = ?", id).
		Scan(&c.ID, &c.Title, &completed, &c.SortOrder)
	c.Completed = completed == 1
	return &c, nil
}

func (r *ChecklistRepository) Update(id string, input model.UpdateChecklistInput) (*model.ChecklistItem, error) {
	if input.Title != nil {
		r.db.Exec("UPDATE checklist_items SET title = ? WHERE id = ?", *input.Title, id)
	}
	if input.Completed != nil {
		r.db.Exec("UPDATE checklist_items SET completed = ? WHERE id = ?", boolToInt(*input.Completed), id)
	}
	if input.SortOrder != nil {
		r.db.Exec("UPDATE checklist_items SET sort_order = ? WHERE id = ?", *input.SortOrder, id)
	}

	var c model.ChecklistItem
	var completed int
	err := r.db.QueryRow("SELECT id, title, completed, sort_order FROM checklist_items WHERE id = ?", id).
		Scan(&c.ID, &c.Title, &completed, &c.SortOrder)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	c.Completed = completed == 1
	return &c, err
}

func (r *ChecklistRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM checklist_items WHERE id = ?", id)
	return err
}
