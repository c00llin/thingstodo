package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func setupTaskForAttachments(t *testing.T) (*repository.AttachmentRepository, string) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	attachRepo := repository.NewAttachmentRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	task, err := taskRepo.Create(model.CreateTaskInput{Title: "Parent task"})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	return attachRepo, task.ID
}

func TestAttachmentCreateLink(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	att, err := repo.Create(taskID, model.CreateAttachmentInput{
		Type:  "link",
		Title: "Example",
		URL:   "https://example.com",
	})
	if err != nil {
		t.Fatalf("failed to create attachment: %v", err)
	}
	if att.Type != "link" {
		t.Errorf("expected type 'link', got %q", att.Type)
	}
	if att.URL != "https://example.com" {
		t.Errorf("expected URL 'https://example.com', got %q", att.URL)
	}
}

func TestAttachmentCreateFile(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	att, err := repo.Create(taskID, model.CreateAttachmentInput{
		Type:     "file",
		Title:    "document.pdf",
		URL:      "/attachments/abc123.pdf",
		MimeType: "application/pdf",
		FileSize: 1024,
	})
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}
	if att.Type != "file" {
		t.Errorf("expected type 'file', got %q", att.Type)
	}
	if att.FileSize != 1024 {
		t.Errorf("expected file_size=1024, got %d", att.FileSize)
	}
}

func TestAttachmentGetByID(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	created, _ := repo.Create(taskID, model.CreateAttachmentInput{
		Type: "link", URL: "https://example.com",
	})

	att, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed to get: %v", err)
	}
	if att == nil {
		t.Fatal("expected non-nil attachment")
	}
	if att.TaskID != taskID {
		t.Errorf("expected task_id=%q, got %q", taskID, att.TaskID)
	}
}

func TestAttachmentGetByIDNotFound(t *testing.T) {
	repo, _ := setupTaskForAttachments(t)

	att, err := repo.GetByID("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if att != nil {
		t.Error("expected nil for nonexistent attachment")
	}
}

func TestAttachmentListByTask(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	repo.Create(taskID, model.CreateAttachmentInput{Type: "link", URL: "https://a.com"})
	repo.Create(taskID, model.CreateAttachmentInput{Type: "link", URL: "https://b.com"})

	items, err := repo.ListByTask(taskID)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2 attachments, got %d", len(items))
	}
}

func TestAttachmentUpdate(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	created, _ := repo.Create(taskID, model.CreateAttachmentInput{
		Type: "link", Title: "Old", URL: "https://example.com",
	})
	newTitle := "New"
	updated, err := repo.Update(created.ID, model.UpdateAttachmentInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Title != "New" {
		t.Errorf("expected 'New', got %q", updated.Title)
	}
}

func TestAttachmentDelete(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	created, _ := repo.Create(taskID, model.CreateAttachmentInput{Type: "link", URL: "https://example.com"})
	err := repo.Delete(created.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}

	items, _ := repo.ListByTask(taskID)
	if len(items) != 0 {
		t.Errorf("expected 0 attachments after delete, got %d", len(items))
	}
}

func TestAttachmentEmptyList(t *testing.T) {
	repo, taskID := setupTaskForAttachments(t)

	items, err := repo.ListByTask(taskID)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}
