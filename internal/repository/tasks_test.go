package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func strPtr(s string) *string { return &s }
func boolPtr(b bool) *bool    { return &b }

func TestTaskCreate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	task, err := repo.Create(model.CreateTaskInput{
		Title: "Buy groceries",
		Notes: "Milk, eggs, bread",
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	if task.Title != "Buy groceries" {
		t.Errorf("expected title 'Buy groceries', got %q", task.Title)
	}
	if task.Notes != "Milk, eggs, bread" {
		t.Errorf("expected notes 'Milk, eggs, bread', got %q", task.Notes)
	}
	if task.Status != "open" {
		t.Errorf("expected status 'open', got %q", task.Status)
	}
	if task.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestTaskCreateWithProject(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	// Create a project first.
	_, _ = db.Exec("INSERT INTO projects (id, title) VALUES ('p1', 'My Project')")

	task, err := repo.Create(model.CreateTaskInput{
		Title:     "Project task",
		ProjectID: strPtr("p1"),
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	if task.ProjectID == nil || *task.ProjectID != "p1" {
		t.Error("expected project_id to be 'p1'")
	}
	if task.Project == nil || task.Project.Title != "My Project" {
		t.Error("expected project ref to be populated")
	}
}

func TestTaskCreateWithTags(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	_, _ = db.Exec("INSERT INTO tags (id, title) VALUES ('tag1', 'urgent')")
	_, _ = db.Exec("INSERT INTO tags (id, title) VALUES ('tag2', 'home')")

	task, err := repo.Create(model.CreateTaskInput{
		Title:  "Tagged task",
		TagIDs: []string{"tag1", "tag2"},
	})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}
	if len(task.Tags) != 2 {
		t.Fatalf("expected 2 tags, got %d", len(task.Tags))
	}
}

func TestTaskGetByID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, err := repo.Create(model.CreateTaskInput{Title: "Test task"})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}

	task, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed to get task: %v", err)
	}
	if task == nil {
		t.Fatal("expected non-nil task")
	}
	if task.Title != "Test task" {
		t.Errorf("expected title 'Test task', got %q", task.Title)
	}
}

func TestTaskGetByIDNotFound(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	task, err := repo.GetByID("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if task != nil {
		t.Error("expected nil task for nonexistent ID")
	}
}

func TestTaskUpdate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "Original"})

	newTitle := "Updated"
	updated, err := repo.Update(created.ID, model.UpdateTaskInput{
		Title: &newTitle,
	})
	if err != nil {
		t.Fatalf("failed to update task: %v", err)
	}
	if updated.Title != "Updated" {
		t.Errorf("expected title 'Updated', got %q", updated.Title)
	}
}

func TestTaskDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "To delete"})

	err := repo.Delete(created.ID)
	if err != nil {
		t.Fatalf("failed to delete task: %v", err)
	}

	task, _ := repo.GetByID(created.ID)
	if task != nil {
		t.Error("expected task to be deleted")
	}
}

func TestTaskComplete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "To complete"})

	task, err := repo.Complete(created.ID)
	if err != nil {
		t.Fatalf("failed to complete task: %v", err)
	}
	if task.Status != "completed" {
		t.Errorf("expected status 'completed', got %q", task.Status)
	}
	if task.CompletedAt == nil {
		t.Error("expected completed_at to be set")
	}
}

func TestTaskCancel(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "To cancel"})

	task, err := repo.Cancel(created.ID)
	if err != nil {
		t.Fatalf("failed to cancel task: %v", err)
	}
	if task.Status != "canceled" {
		t.Errorf("expected status 'canceled', got %q", task.Status)
	}
	if task.CanceledAt == nil {
		t.Error("expected canceled_at to be set")
	}
}

func TestTaskWontDo(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "Won't do"})

	task, err := repo.WontDo(created.ID)
	if err != nil {
		t.Fatalf("failed to wont_do task: %v", err)
	}
	if task.Status != "wont_do" {
		t.Errorf("expected status 'wont_do', got %q", task.Status)
	}
}

func TestTaskReopen(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "Reopen me"})
	_, _ = repo.Complete(created.ID)

	task, err := repo.Reopen(created.ID)
	if err != nil {
		t.Fatalf("failed to reopen task: %v", err)
	}
	if task.Status != "open" {
		t.Errorf("expected status 'open', got %q", task.Status)
	}
	if task.CompletedAt != nil {
		t.Error("expected completed_at to be cleared")
	}
}

func TestTaskListEmpty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	tasks, err := repo.List(model.TaskFilters{})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}
}

func TestTaskListAll(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	_, _ = repo.Create(model.CreateTaskInput{Title: "Task 1"})
	_, _ = repo.Create(model.CreateTaskInput{Title: "Task 2"})
	_, _ = repo.Create(model.CreateTaskInput{Title: "Task 3"})

	tasks, err := repo.List(model.TaskFilters{})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 3 {
		t.Errorf("expected 3 tasks, got %d", len(tasks))
	}
}

func TestTaskListFilterByStatus(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	t1, _ := repo.Create(model.CreateTaskInput{Title: "Open task"})
	t2, _ := repo.Create(model.CreateTaskInput{Title: "Completed task"})
	_, _ = repo.Complete(t2.ID)
	_ = t1

	tasks, err := repo.List(model.TaskFilters{Status: strPtr("completed")})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 completed task, got %d", len(tasks))
	}
	if tasks[0].Status != "completed" {
		t.Errorf("expected status 'completed', got %q", tasks[0].Status)
	}
}

func TestTaskListFilterByProject(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	_, _ = db.Exec("INSERT INTO projects (id, title) VALUES ('p1', 'Project 1')")
	_, _ = repo.Create(model.CreateTaskInput{Title: "Project task", ProjectID: strPtr("p1")})
	_, _ = repo.Create(model.CreateTaskInput{Title: "No project task"})

	tasks, err := repo.List(model.TaskFilters{ProjectID: strPtr("p1")})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if tasks[0].Title != "Project task" {
		t.Errorf("expected 'Project task', got %q", tasks[0].Title)
	}
}

func TestTaskListFilterByTag(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	_, _ = db.Exec("INSERT INTO tags (id, title) VALUES ('tag1', 'urgent')")
	_, _ = repo.Create(model.CreateTaskInput{Title: "Tagged", TagIDs: []string{"tag1"}})
	_, _ = repo.Create(model.CreateTaskInput{Title: "Untagged"})

	tasks, err := repo.List(model.TaskFilters{TagIDs: []string{"tag1"}})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if tasks[0].Title != "Tagged" {
		t.Errorf("expected 'Tagged', got %q", tasks[0].Title)
	}
}

func TestTaskListFilterByWhenDate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	_, _ = repo.Create(model.CreateTaskInput{Title: "Today", WhenDate: strPtr("2026-02-15")})
	_, _ = repo.Create(model.CreateTaskInput{Title: "Tomorrow", WhenDate: strPtr("2026-02-16")})
	_, _ = repo.Create(model.CreateTaskInput{Title: "No date"})

	tasks, err := repo.List(model.TaskFilters{WhenDate: strPtr("2026-02-15")})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if tasks[0].Title != "Today" {
		t.Errorf("expected 'Today', got %q", tasks[0].Title)
	}
}

func TestTaskListFilterByEvening(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	_, _ = repo.Create(model.CreateTaskInput{Title: "Evening", WhenEvening: true})
	_, _ = repo.Create(model.CreateTaskInput{Title: "Not evening"})

	tasks, err := repo.List(model.TaskFilters{IsEvening: boolPtr(true)})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 evening task, got %d", len(tasks))
	}
	if tasks[0].Title != "Evening" {
		t.Errorf("expected 'Evening', got %q", tasks[0].Title)
	}
}

func TestTaskReorder(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	t1, _ := repo.Create(model.CreateTaskInput{Title: "Task 1"})
	t2, _ := repo.Create(model.CreateTaskInput{Title: "Task 2"})

	err := repo.Reorder([]model.ReorderItem{
		{ID: t1.ID, SortField: "sort_order_today", SortOrder: 200},
		{ID: t2.ID, SortField: "sort_order_today", SortOrder: 100},
	})
	if err != nil {
		t.Fatalf("failed to reorder: %v", err)
	}

	// After reorder, Task 2 should come first (lower sort_order).
	tasks, _ := repo.List(model.TaskFilters{})
	if len(tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(tasks))
	}
	if tasks[0].Title != "Task 2" {
		t.Errorf("expected Task 2 first, got %q", tasks[0].Title)
	}
}

func TestTaskReorderInvalidField(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	t1, _ := repo.Create(model.CreateTaskInput{Title: "Task 1"})

	err := repo.Reorder([]model.ReorderItem{
		{ID: t1.ID, SortField: "invalid_field", SortOrder: 100},
	})
	if err == nil {
		t.Error("expected error for invalid sort field")
	}
}

func TestTaskGetByIDWithChecklist(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "With checklist"})
	_, _ = db.Exec("INSERT INTO checklist_items (id, task_id, title, sort_order) VALUES ('c1', ?, 'Item 1', 1)", created.ID)
	_, _ = db.Exec("INSERT INTO checklist_items (id, task_id, title, completed, sort_order) VALUES ('c2', ?, 'Item 2', 1, 2)", created.ID)

	task, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed to get task: %v", err)
	}
	if len(task.Checklist) != 2 {
		t.Fatalf("expected 2 checklist items, got %d", len(task.Checklist))
	}
	if task.Checklist[1].Completed != true {
		t.Error("expected second checklist item to be completed")
	}
}

func TestTaskGetByIDWithAttachments(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{Title: "With attachment"})
	_, _ = db.Exec("INSERT INTO attachments (id, task_id, type, url, sort_order) VALUES ('a1', ?, 'link', 'https://example.com', 1)", created.ID)

	task, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed to get task: %v", err)
	}
	if len(task.Attachments) != 1 {
		t.Fatalf("expected 1 attachment, got %d", len(task.Attachments))
	}
	if task.Attachments[0].URL != "https://example.com" {
		t.Errorf("expected URL 'https://example.com', got %q", task.Attachments[0].URL)
	}
}

func TestTaskListItemMetadata(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTaskRepository(db)

	created, _ := repo.Create(model.CreateTaskInput{
		Title: "With metadata",
		Notes: "Has notes",
	})
	_, _ = db.Exec("INSERT INTO checklist_items (id, task_id, title, sort_order) VALUES ('c1', ?, 'Item', 1)", created.ID)
	_, _ = db.Exec("INSERT INTO attachments (id, task_id, type, url, sort_order) VALUES ('a1', ?, 'link', 'https://example.com', 1)", created.ID)

	tasks, err := repo.List(model.TaskFilters{})
	if err != nil {
		t.Fatalf("failed to list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	task := tasks[0]
	if !task.HasNotes {
		t.Error("expected has_notes to be true")
	}
	if !task.HasAttachments {
		t.Error("expected has_attachments to be true")
	}
	if task.ChecklistCount != 1 {
		t.Errorf("expected checklist_count=1, got %d", task.ChecklistCount)
	}
}
