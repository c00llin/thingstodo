package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestTagCreate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTagRepository(db)

	tag, err := repo.Create(model.CreateTagInput{Title: "urgent"})
	if err != nil {
		t.Fatalf("failed to create tag: %v", err)
	}
	if tag.Title != "urgent" {
		t.Errorf("expected title 'urgent', got %q", tag.Title)
	}
}

func TestTagCreateUniqueness(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTagRepository(db)

	_, _ = repo.Create(model.CreateTagInput{Title: "urgent"})
	_, err := repo.Create(model.CreateTagInput{Title: "urgent"})
	if err == nil {
		t.Error("expected error for duplicate tag title")
	}
}

func TestTagCreateWithParent(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTagRepository(db)

	parent, _ := repo.Create(model.CreateTagInput{Title: "context"})
	child, err := repo.Create(model.CreateTagInput{Title: "work", ParentTagID: &parent.ID})
	if err != nil {
		t.Fatalf("failed to create child tag: %v", err)
	}
	if child.ParentTagID == nil || *child.ParentTagID != parent.ID {
		t.Error("expected parent_tag_id to match")
	}
}

func TestTagUpdate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTagRepository(db)

	created, _ := repo.Create(model.CreateTagInput{Title: "old"})
	newTitle := "new"
	updated, err := repo.Update(created.ID, model.UpdateTagInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Title != "new" {
		t.Errorf("expected 'new', got %q", updated.Title)
	}
}

func TestTagDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTagRepository(db)

	created, _ := repo.Create(model.CreateTagInput{Title: "to delete"})
	err := repo.Delete(created.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	tags, _ := repo.List()
	if len(tags) != 0 {
		t.Errorf("expected 0 tags after delete, got %d", len(tags))
	}
}

func TestTagDeleteCascadesJunctionRows(t *testing.T) {
	db := testutil.SetupTestDB(t)
	tagRepo := repository.NewTagRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	tag, _ := tagRepo.Create(model.CreateTagInput{Title: "temp"})
	task, _ := taskRepo.Create(model.CreateTaskInput{Title: "Task", TagIDs: []string{tag.ID}})

	_ = tagRepo.Delete(tag.ID)

	// Task should still exist but without the tag.
	detail, _ := taskRepo.GetByID(task.ID)
	if detail == nil {
		t.Fatal("task should still exist")
	}
	if len(detail.Tags) != 0 {
		t.Errorf("expected 0 tags after tag deletion, got %d", len(detail.Tags))
	}
}

func TestTagListEmpty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewTagRepository(db)

	tags, err := repo.List()
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(tags) != 0 {
		t.Errorf("expected 0 tags, got %d", len(tags))
	}
}

func TestTagListWithTaskCount(t *testing.T) {
	db := testutil.SetupTestDB(t)
	tagRepo := repository.NewTagRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	tag, _ := tagRepo.Create(model.CreateTagInput{Title: "important"})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Task 1", TagIDs: []string{tag.ID}})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Task 2", TagIDs: []string{tag.ID}})

	tags, _ := tagRepo.List()
	if len(tags) != 1 {
		t.Fatalf("expected 1 tag, got %d", len(tags))
	}
	if tags[0].TaskCount != 2 {
		t.Errorf("expected task_count=2, got %d", tags[0].TaskCount)
	}
}

func TestTagGetTasksByTag(t *testing.T) {
	db := testutil.SetupTestDB(t)
	tagRepo := repository.NewTagRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	tag, _ := tagRepo.Create(model.CreateTagInput{Title: "work"})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Work task", TagIDs: []string{tag.ID}})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Other task"})

	tasks, err := tagRepo.GetTasksByTag(tag.ID)
	if err != nil {
		t.Fatalf("failed to get tasks by tag: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
	if tasks[0].Title != "Work task" {
		t.Errorf("expected 'Work task', got %q", tasks[0].Title)
	}
}
