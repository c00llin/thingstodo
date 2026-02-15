package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type AttachmentRepository struct {
	db *sql.DB
}

func NewAttachmentRepository(db *sql.DB) *AttachmentRepository {
	return &AttachmentRepository{db: db}
}

func (r *AttachmentRepository) ListByTask(taskID string) ([]model.Attachment, error) {
	rows, err := r.db.Query(
		"SELECT id, type, title, url, mime_type, file_size, sort_order, created_at FROM attachments WHERE task_id = ? ORDER BY sort_order", taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.Attachment
	for rows.Next() {
		var a model.Attachment
		rows.Scan(&a.ID, &a.Type, &a.Title, &a.URL, &a.MimeType, &a.FileSize, &a.SortOrder, &a.CreatedAt)
		items = append(items, a)
	}
	if items == nil {
		items = []model.Attachment{}
	}
	return items, rows.Err()
}

func (r *AttachmentRepository) GetByID(id string) (*model.Attachment, error) {
	var a model.Attachment
	err := r.db.QueryRow(
		"SELECT id, task_id, type, title, url, mime_type, file_size, sort_order, created_at FROM attachments WHERE id = ?", id,
	).Scan(&a.ID, &a.TaskID, &a.Type, &a.Title, &a.URL, &a.MimeType, &a.FileSize, &a.SortOrder, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AttachmentRepository) Create(taskID string, input model.CreateAttachmentInput) (*model.Attachment, error) {
	id := model.NewID()
	var maxSort float64
	r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM attachments WHERE task_id = ?", taskID).Scan(&maxSort)

	_, err := r.db.Exec(`INSERT INTO attachments (id, task_id, type, title, url, mime_type, file_size, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, taskID, input.Type, input.Title, input.URL, input.MimeType, input.FileSize, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create attachment: %w", err)
	}

	return r.GetByID(id)
}

func (r *AttachmentRepository) Update(id string, input model.UpdateAttachmentInput) (*model.Attachment, error) {
	if input.Title != nil {
		r.db.Exec("UPDATE attachments SET title = ? WHERE id = ?", *input.Title, id)
	}
	if input.SortOrder != nil {
		r.db.Exec("UPDATE attachments SET sort_order = ? WHERE id = ?", *input.SortOrder, id)
	}
	return r.GetByID(id)
}

func (r *AttachmentRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM attachments WHERE id = ?", id)
	return err
}
