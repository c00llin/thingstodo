package repository_test

import (
	"database/sql"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

// createArea is a test helper that creates an area and returns its ID.
func createArea(t *testing.T, db *sql.DB) string {
	t.Helper()
	repo := repository.NewAreaRepository(db)
	area, err := repo.Create(model.CreateAreaInput{Title: "Test Area"})
	if err != nil {
		t.Fatalf("failed to create area: %v", err)
	}
	return area.ID
}

func TestProjectCreate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaID := createArea(t, db)

	p, err := repo.Create(model.CreateProjectInput{Title: "My Project", Notes: "Some notes", AreaID: &areaID})
	if err != nil {
		t.Fatalf("failed to create project: %v", err)
	}
	if p.Title != "My Project" {
		t.Errorf("expected title 'My Project', got %q", p.Title)
	}
	if p.Status != "open" {
		t.Errorf("expected status 'open', got %q", p.Status)
	}
	if p.ID == "" {
		t.Error("expected non-empty ID")
	}
}

func TestProjectCreateWithArea(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaRepo := repository.NewAreaRepository(db)

	area, _ := areaRepo.Create(model.CreateAreaInput{Title: "Work"})
	p, err := repo.Create(model.CreateProjectInput{Title: "Work Project", AreaID: &area.ID})
	if err != nil {
		t.Fatalf("failed to create project: %v", err)
	}
	if p.AreaID == nil || *p.AreaID != area.ID {
		t.Error("expected area_id to match")
	}
	if p.Area == nil || p.Area.Title != "Work" {
		t.Error("expected area ref to be populated")
	}
}

func TestProjectCreateRequiresArea(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)

	_, err := repo.Create(model.CreateProjectInput{Title: "No Area"})
	if err == nil {
		t.Error("expected error when creating project without area_id")
	}
}

func TestProjectGetByID(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaID := createArea(t, db)

	created, _ := repo.Create(model.CreateProjectInput{Title: "Test", AreaID: &areaID})
	p, err := repo.GetByID(created.ID)
	if err != nil {
		t.Fatalf("failed to get project: %v", err)
	}
	if p == nil {
		t.Fatal("expected non-nil project")
	}
	if p.Title != "Test" {
		t.Errorf("expected title 'Test', got %q", p.Title)
	}
}

func TestProjectGetByIDNotFound(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)

	p, err := repo.GetByID("nonexistent")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p != nil {
		t.Error("expected nil for nonexistent project")
	}
}

func TestProjectGetByIDWithTasks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	projRepo := repository.NewProjectRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	areaID := createArea(t, db)

	created, _ := projRepo.Create(model.CreateProjectInput{Title: "With Tasks", AreaID: &areaID})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Task 1", ProjectID: &created.ID})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Task 2", ProjectID: &created.ID})

	p, _ := projRepo.GetByID(created.ID)
	if p.TaskCount != 2 {
		t.Errorf("expected task_count=2, got %d", p.TaskCount)
	}
	if len(p.TasksWithoutHeading) != 2 {
		t.Errorf("expected 2 tasks without heading, got %d", len(p.TasksWithoutHeading))
	}
}

func TestProjectGetByIDWithHeadings(t *testing.T) {
	db := testutil.SetupTestDB(t)
	projRepo := repository.NewProjectRepository(db)
	headingRepo := repository.NewHeadingRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	areaID := createArea(t, db)

	created, _ := projRepo.Create(model.CreateProjectInput{Title: "With Headings", AreaID: &areaID})
	h, _ := headingRepo.Create(created.ID, model.CreateHeadingInput{Title: "Section 1"})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Headed task", ProjectID: &created.ID, HeadingID: &h.ID})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "No heading task", ProjectID: &created.ID})

	p, _ := projRepo.GetByID(created.ID)
	if len(p.Headings) != 1 {
		t.Fatalf("expected 1 heading, got %d", len(p.Headings))
	}
	if len(p.Headings[0].Tasks) != 1 {
		t.Errorf("expected 1 task under heading, got %d", len(p.Headings[0].Tasks))
	}
	if len(p.TasksWithoutHeading) != 1 {
		t.Errorf("expected 1 task without heading, got %d", len(p.TasksWithoutHeading))
	}
}

func TestProjectUpdate(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaID := createArea(t, db)

	created, _ := repo.Create(model.CreateProjectInput{Title: "Original", AreaID: &areaID})
	newTitle := "Updated"
	updated, err := repo.Update(created.ID, model.UpdateProjectInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Title != "Updated" {
		t.Errorf("expected 'Updated', got %q", updated.Title)
	}
}

func TestProjectDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaID := createArea(t, db)

	created, _ := repo.Create(model.CreateProjectInput{Title: "To delete", AreaID: &areaID})
	err := repo.Delete(created.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	p, _ := repo.GetByID(created.ID)
	if p != nil {
		t.Error("expected project to be deleted")
	}
}

func TestProjectComplete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaID := createArea(t, db)

	created, _ := repo.Create(model.CreateProjectInput{Title: "To complete", AreaID: &areaID})
	p, err := repo.Complete(created.ID)
	if err != nil {
		t.Fatalf("failed to complete: %v", err)
	}
	if p.Status != "completed" {
		t.Errorf("expected status 'completed', got %q", p.Status)
	}
}

func TestProjectListEmpty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)

	projects, err := repo.List(nil, nil)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(projects) != 0 {
		t.Errorf("expected 0 projects, got %d", len(projects))
	}
}

func TestProjectListFilterByArea(t *testing.T) {
	db := testutil.SetupTestDB(t)
	projRepo := repository.NewProjectRepository(db)
	areaRepo := repository.NewAreaRepository(db)

	area1, _ := areaRepo.Create(model.CreateAreaInput{Title: "Work"})
	area2, _ := areaRepo.Create(model.CreateAreaInput{Title: "Personal"})
	_, _ = projRepo.Create(model.CreateProjectInput{Title: "Work Project", AreaID: &area1.ID})
	_, _ = projRepo.Create(model.CreateProjectInput{Title: "Personal Project", AreaID: &area2.ID})

	projects, _ := projRepo.List(&area1.ID, nil)
	if len(projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(projects))
	}
	if projects[0].Title != "Work Project" {
		t.Errorf("expected 'Work Project', got %q", projects[0].Title)
	}
}

func TestProjectListFilterByStatus(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewProjectRepository(db)
	areaID := createArea(t, db)

	p1, _ := repo.Create(model.CreateProjectInput{Title: "Open", AreaID: &areaID})
	_, _ = repo.Create(model.CreateProjectInput{Title: "Also open", AreaID: &areaID})
	_, _ = repo.Complete(p1.ID)

	completed := "completed"
	projects, _ := repo.List(nil, &completed)
	if len(projects) != 1 {
		t.Fatalf("expected 1 completed project, got %d", len(projects))
	}
}

func TestProjectTaskProgress(t *testing.T) {
	db := testutil.SetupTestDB(t)
	projRepo := repository.NewProjectRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	areaID := createArea(t, db)

	created, _ := projRepo.Create(model.CreateProjectInput{Title: "Progress", AreaID: &areaID})
	t1, _ := taskRepo.Create(model.CreateTaskInput{Title: "Task 1", ProjectID: &created.ID})
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Task 2", ProjectID: &created.ID})
	_, _ = taskRepo.Complete(t1.ID)

	projects, _ := projRepo.List(nil, nil)
	if len(projects) != 1 {
		t.Fatalf("expected 1 project, got %d", len(projects))
	}
	if projects[0].TaskCount != 2 {
		t.Errorf("expected task_count=2, got %d", projects[0].TaskCount)
	}
	if projects[0].CompletedTaskCount != 1 {
		t.Errorf("expected completed_task_count=1, got %d", projects[0].CompletedTaskCount)
	}
}
