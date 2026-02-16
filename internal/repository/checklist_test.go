package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func setupTaskForChecklist(t *testing.T) (*repository.ChecklistRepository, *repository.TaskRepository, string) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	checkRepo := repository.NewChecklistRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	task, err := taskRepo.Create(model.CreateTaskInput{Title: "Parent task"})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	return checkRepo, taskRepo, task.ID
}

func TestChecklistCreate(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	item, err := repo.Create(taskID, model.CreateChecklistInput{Title: "Buy milk"})
	if err != nil {
		t.Fatalf("failed to create checklist item: %v", err)
	}
	if item.Title != "Buy milk" {
		t.Errorf("expected title 'Buy milk', got %q", item.Title)
	}
	if item.Completed {
		t.Error("expected new item to be uncompleted")
	}
}

func TestChecklistListByTask(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	_, _ = repo.Create(taskID, model.CreateChecklistInput{Title: "Item 1"})
	_, _ = repo.Create(taskID, model.CreateChecklistInput{Title: "Item 2"})

	items, err := repo.ListByTask(taskID)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(items) != 2 {
		t.Errorf("expected 2 items, got %d", len(items))
	}
}

func TestChecklistToggle(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	item, _ := repo.Create(taskID, model.CreateChecklistInput{Title: "Toggle me"})

	completed := true
	updated, err := repo.Update(item.ID, model.UpdateChecklistInput{Completed: &completed})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if !updated.Completed {
		t.Error("expected item to be completed")
	}

	uncompleted := false
	updated, _ = repo.Update(item.ID, model.UpdateChecklistInput{Completed: &uncompleted})
	if updated.Completed {
		t.Error("expected item to be uncompleted")
	}
}

func TestChecklistUpdateTitle(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	item, _ := repo.Create(taskID, model.CreateChecklistInput{Title: "Old"})
	newTitle := "New"
	updated, _ := repo.Update(item.ID, model.UpdateChecklistInput{Title: &newTitle})
	if updated.Title != "New" {
		t.Errorf("expected 'New', got %q", updated.Title)
	}
}

func TestChecklistDelete(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	item, _ := repo.Create(taskID, model.CreateChecklistInput{Title: "Delete me"})
	err := repo.Delete(item.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}

	items, _ := repo.ListByTask(taskID)
	if len(items) != 0 {
		t.Errorf("expected 0 items after delete, got %d", len(items))
	}
}

func TestChecklistSortOrder(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	_, _ = repo.Create(taskID, model.CreateChecklistInput{Title: "First"})
	_, _ = repo.Create(taskID, model.CreateChecklistInput{Title: "Second"})

	items, _ := repo.ListByTask(taskID)
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	if items[0].SortOrder >= items[1].SortOrder {
		t.Error("expected first item to have lower sort_order")
	}
}

func TestChecklistEmptyList(t *testing.T) {
	repo, _, taskID := setupTaskForChecklist(t)

	items, err := repo.ListByTask(taskID)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 items, got %d", len(items))
	}
}
