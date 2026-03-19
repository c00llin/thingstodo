package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type AttachmentRepository struct {
	db        *sql.DB
	changeLog *ChangeLogRepository
}

func NewAttachmentRepository(db *sql.DB, changeLog *ChangeLogRepository) *AttachmentRepository {
	return &AttachmentRepository{db: db, changeLog: changeLog}
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
		if err := rows.Scan(&a.ID, &a.Type, &a.Title, &a.URL, &a.MimeType, &a.FileSize, &a.SortOrder, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan attachment: %w", err)
		}
		items = append(items, a)
	}
	if items == nil {
		items = []model.Attachment{}
	}
	return items, rows.Err()
}

// ListAll returns all attachments across all tasks.
func (r *AttachmentRepository) ListAll() ([]model.Attachment, error) {
	rows, err := r.db.Query(
		"SELECT id, task_id, type, title, url, mime_type, file_size, sort_order, created_at FROM attachments ORDER BY sort_order")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.Attachment
	for rows.Next() {
		var a model.Attachment
		if err := rows.Scan(&a.ID, &a.TaskID, &a.Type, &a.Title, &a.URL, &a.MimeType, &a.FileSize, &a.SortOrder, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan attachment: %w", err)
		}
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
	id := input.ID
	if id == "" {
		id = model.NewID()
	}
	var maxSort float64
	_ = r.db.QueryRow("SELECT COALESCE(MAX(sort_order), 0) FROM attachments WHERE task_id = ?", taskID).Scan(&maxSort)

	_, err := r.db.Exec(`INSERT INTO attachments (id, task_id, type, title, url, mime_type, file_size, sort_order)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, taskID, input.Type, input.Title, input.URL, input.MimeType, input.FileSize, maxSort+1024)
	if err != nil {
		return nil, fmt.Errorf("create attachment: %w", err)
	}

	attachment, err := r.GetByID(id)
	if err == nil && attachment != nil {
		logChange(r.changeLog, "attachment", id, "create", nil, attachment, "", "")
	}
	return attachment, err
}

func (r *AttachmentRepository) Update(id string, input model.UpdateAttachmentInput) (*model.Attachment, error) {
	if input.Title != nil {
		if _, err := r.db.Exec("UPDATE attachments SET title = ? WHERE id = ?", *input.Title, id); err != nil {
			return nil, fmt.Errorf("update attachment title: %w", err)
		}
	}
	if input.SortOrder != nil {
		if _, err := r.db.Exec("UPDATE attachments SET sort_order = ? WHERE id = ?", *input.SortOrder, id); err != nil {
			return nil, fmt.Errorf("update attachment sort_order: %w", err)
		}
	}
	attachment, err := r.GetByID(id)
	if err == nil && attachment != nil {
		logChange(r.changeLog, "attachment", id, "update", nil, attachment, "", "")
	}
	return attachment, err
}

func (r *AttachmentRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM attachments WHERE id = ?", id)
	if err == nil {
		logChange(r.changeLog, "attachment", id, "delete", nil, map[string]string{"id": id}, "", "")
	}
	return err
}

// DeleteByURL removes all attachment rows that reference the given stored file URL.
func (r *AttachmentRepository) DeleteByURL(url string) error {
	// Collect attachment IDs before deleting so we can log each deletion
	var id string
	err := r.db.QueryRow("SELECT id FROM attachments WHERE type = 'file' AND url = ?", url).Scan(&id)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("lookup attachment by url: %w", err)
	}

	_, execErr := r.db.Exec("DELETE FROM attachments WHERE type = 'file' AND url = ?", url)
	if execErr != nil {
		return execErr
	}

	if err == nil {
		logChange(r.changeLog, "attachment", id, "delete", nil, map[string]string{"id": id}, "", "")
	}
	return nil
}

// CountByURL returns how many file attachments reference the given stored file URL.
func (r *AttachmentRepository) CountByURL(url string) (int, error) {
	var count int
	err := r.db.QueryRow("SELECT COUNT(*) FROM attachments WHERE type = 'file' AND url = ?", url).Scan(&count)
	return count, err
}
