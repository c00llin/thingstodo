package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestAreaCreate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewAreaRepository(db)

	area, err := repo.Create(model.CreateAreaInput{Title: "Work"})
	if err != nil {
		t.Fatalf("failed to create area: %v", err)
	}
	if area.Title != "Work" {
		t.Errorf("expected title 'Work', got %q", area.Title)
	}
	if area.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestAreaGetByID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewAreaRepository(db)

	created, _ := repo.Create(model.CreateAreaInput{Title: "Personal"})
	area, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed to get area: %v", err)
	}
	if area == nil {
		t.Fatal("expected non-nil area")
	}
	if area.Title != "Personal" {
		t.Errorf("expected 'Personal', got %q", area.Title)
	}
}

func TestAreaGetByIDNotFound(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewAreaRepository(db)

	area, err := repo.GetByID("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if area != nil {
		t.Error("expected nil for nonexistent area")
	}
}

func TestAreaGetByIDWithProjects(t *testing.T) {
	db := testutil.SetupTestDB(t)
	areaRepo := repository.NewAreaRepository(db)
	projRepo := repository.NewProjectRepository(db)

	area, _ := areaRepo.Create(model.CreateAreaInput{Title: "Work"})
	projRepo.Create(model.CreateProjectInput{Title: "Project 1", AreaID: &area.ID})
	projRepo.Create(model.CreateProjectInput{Title: "Project 2", AreaID: &area.ID})

	detail, _ := areaRepo.GetByID(area.ID)
	if len(detail.Projects) != 2 {
		t.Errorf("expected 2 projects, got %d", len(detail.Projects))
	}
}

func TestAreaGetByIDWithTasks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	areaRepo := repository.NewAreaRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	area, _ := areaRepo.Create(model.CreateAreaInput{Title: "Home"})
	taskRepo.Create(model.CreateTaskInput{Title: "Standalone task", AreaID: &area.ID})

	detail, _ := areaRepo.GetByID(area.ID)
	if len(detail.Tasks) != 1 {
		t.Errorf("expected 1 standalone task, got %d", len(detail.Tasks))
	}
}

func TestAreaUpdate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewAreaRepository(db)

	created, _ := repo.Create(model.CreateAreaInput{Title: "Original"})
	newTitle := "Updated"
	updated, err := repo.Update(created.ID, model.UpdateAreaInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Title != "Updated" {
		t.Errorf("expected 'Updated', got %q", updated.Title)
	}
}

func TestAreaDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewAreaRepository(db)

	created, _ := repo.Create(model.CreateAreaInput{Title: "To delete"})
	err := repo.Delete(created.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	area, _ := repo.GetByID(created.ID)
	if area != nil {
		t.Error("expected area to be deleted")
	}
}

func TestAreaDeleteSetsNullOnProjects(t *testing.T) {
	db := testutil.SetupTestDB(t)
	areaRepo := repository.NewAreaRepository(db)
	projRepo := repository.NewProjectRepository(db)

	area, _ := areaRepo.Create(model.CreateAreaInput{Title: "To delete"})
	created, _ := projRepo.Create(model.CreateProjectInput{Title: "Project", AreaID: &area.ID})

	areaRepo.Delete(area.ID)

	p, _ := projRepo.GetByID(created.ID)
	if p == nil {
		t.Fatal("project should still exist")
	}
	if p.AreaID != nil {
		t.Error("expected area_id to be null after area deletion")
	}
}

func TestAreaListEmpty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewAreaRepository(db)

	areas, err := repo.List()
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(areas) != 0 {
		t.Errorf("expected 0 areas, got %d", len(areas))
	}
}

func TestAreaListWithCounts(t *testing.T) {
	db := testutil.SetupTestDB(t)
	areaRepo := repository.NewAreaRepository(db)
	projRepo := repository.NewProjectRepository(db)
	taskRepo := repository.NewTaskRepository(db)

	area, _ := areaRepo.Create(model.CreateAreaInput{Title: "Work"})
	projRepo.Create(model.CreateProjectInput{Title: "Proj", AreaID: &area.ID})
	taskRepo.Create(model.CreateTaskInput{Title: "Task", AreaID: &area.ID})

	areas, _ := areaRepo.List()
	if len(areas) != 1 {
		t.Fatalf("expected 1 area, got %d", len(areas))
	}
	if areas[0].ProjectCount != 1 {
		t.Errorf("expected project_count=1, got %d", areas[0].ProjectCount)
	}
	if areas[0].TaskCount != 1 {
		t.Errorf("expected task_count=1, got %d", areas[0].TaskCount)
	}
}
