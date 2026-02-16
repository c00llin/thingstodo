package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type HeadingRepository struct {
	db *sql.DB
}

func NewHeadingRepository(db *sql.DB) *HeadingRepository {
	return &HeadingRepository{db: db}
}

func (r *HeadingRepository) ListByProject(projectID string) ([]model.Heading, error) {
	rows, err := r.db.Query(
		"SELECT id, title, project_id, sort_order FROM headings WHERE project_id = ? ORDER BY sort_order", projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var headings []model.Heading
	for rows.Next() {
		var h model.Heading
		if err := rows.Scan(&h.ID, &h.Title, &h.ProjectID, &h.SortOrder); err != nil {
			return nil, fmt.Errorf("scan heading: %w", err)
		}
		headings = append(headings, h)
	}
	if headings == nil {
		headings = []model.Heading{}
	}
	return headings, rows.Err()
}

func (r *HeadingRepository) Create(projectID string, input model.CreateHeadingInput) (*model.Heading, error) {
	id := model.NewID()
	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM headings WHERE project_id = ?", projectID).Scan(&maxSort)

	_, err := r.db.Exec("INSERT INTO headings (id, title, project_id, sort_order) VALUES (?, ?, ?, ?)",
		id, input.Title, projectID, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create heading: %w", err)
	}

	var h model.Heading
	_ = r.db.QueryRow("SELECT id, title, project_id, sort_order FROM headings WHERE id = ?", id).
		Scan(&h.ID, &h.Title, &h.ProjectID, &h.SortOrder)
	return &h, nil
}

func (r *HeadingRepository) Update(id string, input model.UpdateHeadingInput) (*model.Heading, error) {
	if input.Title != nil {
		_, _ = r.db.Exec("UPDATE headings SET title = ? WHERE id = ?", *input.Title, id)
	}
	if input.SortOrder != nil {
		_, _ = r.db.Exec("UPDATE headings SET sort_order = ? WHERE id = ?", *input.SortOrder, id)
	}

	var h model.Heading
	err := r.db.QueryRow("SELECT id, title, project_id, sort_order FROM headings WHERE id = ?", id).
		Scan(&h.ID, &h.Title, &h.ProjectID, &h.SortOrder)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &h, err
}

func (r *HeadingRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM headings WHERE id = ?", id)
	return err
}

func (r *HeadingRepository) Reorder(items []model.SimpleReorderItem) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, item := range items {
		_, err := tx.Exec("UPDATE headings SET sort_order = ? WHERE id = ?", item.SortOrder, item.ID)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}
