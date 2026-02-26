package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

const maxSavedFiltersPerView = 10

type SavedFilterRepository struct {
	db *sql.DB
}

func NewSavedFilterRepository(db *sql.DB) *SavedFilterRepository {
	return &SavedFilterRepository{db: db}
}

// List returns all saved filters for a user and view, sorted A-Z by name.
func (r *SavedFilterRepository) List(userID, view string) ([]model.SavedFilter, error) {
	rows, err := r.db.Query(
		`SELECT id, view, name, config, created_at
		 FROM saved_filters
		 WHERE user_id = ? AND view = ?
		 ORDER BY name ASC`,
		userID, view,
	)
	if err != nil {
		return nil, fmt.Errorf("list saved filters: %w", err)
	}
	defer rows.Close()

	filters := []model.SavedFilter{}
	for rows.Next() {
		var f model.SavedFilter
		if err := rows.Scan(&f.ID, &f.View, &f.Name, &f.Config, &f.CreatedAt); err != nil {
			return nil, err
		}
		filters = append(filters, f)
	}
	return filters, rows.Err()
}

// Create inserts a new saved filter, enforcing the per-view limit.
func (r *SavedFilterRepository) Create(userID string, input model.CreateSavedFilterInput) (*model.SavedFilter, error) {
	var count int
	if err := r.db.QueryRow(
		`SELECT COUNT(*) FROM saved_filters WHERE user_id = ? AND view = ?`,
		userID, input.View,
	).Scan(&count); err != nil {
		return nil, fmt.Errorf("count saved filters: %w", err)
	}
	if count >= maxSavedFiltersPerView {
		return nil, ErrSavedFilterLimitReached
	}

	id := model.NewID()
	_, err := r.db.Exec(
		`INSERT INTO saved_filters (id, user_id, view, name, config) VALUES (?, ?, ?, ?, ?)`,
		id, userID, input.View, input.Name, input.Config,
	)
	if err != nil {
		return nil, fmt.Errorf("create saved filter: %w", err)
	}

	var f model.SavedFilter
	if err := r.db.QueryRow(
		`SELECT id, view, name, config, created_at FROM saved_filters WHERE id = ?`, id,
	).Scan(&f.ID, &f.View, &f.Name, &f.Config, &f.CreatedAt); err != nil {
		return nil, fmt.Errorf("fetch saved filter: %w", err)
	}
	return &f, nil
}

// GetView returns the view name for a saved filter, scoped to a user.
func (r *SavedFilterRepository) GetView(userID, id string) (string, error) {
	var view string
	err := r.db.QueryRow(
		`SELECT view FROM saved_filters WHERE id = ? AND user_id = ?`, id, userID,
	).Scan(&view)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("saved filter not found")
	}
	return view, err
}

// Delete removes a saved filter, scoped to userID.
func (r *SavedFilterRepository) Delete(userID, id string) error {
	res, err := r.db.Exec(
		`DELETE FROM saved_filters WHERE id = ? AND user_id = ?`, id, userID,
	)
	if err != nil {
		return fmt.Errorf("delete saved filter: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("saved filter not found")
	}
	return nil
}
