package repository_test

import (
	"testing"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestViewInboxShowsOnlyUnassignedOpenTasks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	viewRepo := repository.NewViewRepository(db)

	// Inbox task: no project, no area, no when_date, status=open
	taskRepo.Create(model.CreateTaskInput{Title: "Inbox task"})

	// Non-inbox: has project
	db.Exec("INSERT INTO projects (id, title) VALUES ('p1', 'Project')")
	taskRepo.Create(model.CreateTaskInput{Title: "Project task", ProjectID: strPtr("p1")})

	// Non-inbox: has when_date
	taskRepo.Create(model.CreateTaskInput{Title: "Scheduled", WhenDate: strPtr("2026-03-01")})

	// Non-inbox: has area
	db.Exec("INSERT INTO areas (id, title) VALUES ('a1', 'Work')")
	taskRepo.Create(model.CreateTaskInput{Title: "Area task", AreaID: strPtr("a1")})

	tasks, err := viewRepo.Inbox()
	if err != nil {
		t.Fatalf("failed to get inbox: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 inbox task, got %d", len(tasks))
	}
	if tasks[0].Title != "Inbox task" {
		t.Errorf("expected 'Inbox task', got %q", tasks[0].Title)
	}
}

func TestViewInboxExcludesCompletedTasks(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	viewRepo := repository.NewViewRepository(db)

	task, _ := taskRepo.Create(model.CreateTaskInput{Title: "Done"})
	_, _ = taskRepo.Complete(task.ID)
	_, _ = taskRepo.Create(model.CreateTaskInput{Title: "Open"})

	tasks, _ := viewRepo.Inbox()
	if len(tasks) != 1 {
		t.Fatalf("expected 1 open inbox task, got %d", len(tasks))
	}
}

func TestViewInboxEmpty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	viewRepo := repository.NewViewRepository(db)

	tasks, err := viewRepo.Inbox()
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}
}

func TestViewTodayStructure(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	viewRepo := repository.NewViewRepository(db)

	today := time.Now().Format("2006-01-02")
	taskRepo.Create(model.CreateTaskInput{Title: "Today task", WhenDate: &today})
	taskRepo.Create(model.CreateTaskInput{Title: "Evening task", WhenDate: &today, WhenEvening: true})

	view, err := viewRepo.Today()
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if len(view.Sections) != 2 {
		t.Fatalf("expected 2 sections, got %d", len(view.Sections))
	}
	if view.Sections[0].Title != "Today" {
		t.Errorf("expected first section 'Today', got %q", view.Sections[0].Title)
	}
	if view.Sections[1].Title != "This Evening" {
		t.Errorf("expected second section 'This Evening', got %q", view.Sections[1].Title)
	}
}

func TestViewLogbook(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	viewRepo := repository.NewViewRepository(db)

	t1, _ := taskRepo.Create(model.CreateTaskInput{Title: "Completed"})
	_, _ = taskRepo.Complete(t1.ID)
	t2, _ := taskRepo.Create(model.CreateTaskInput{Title: "Canceled"})
	_, _ = taskRepo.Cancel(t2.ID)
	taskRepo.Create(model.CreateTaskInput{Title: "Still open"})

	view, err := viewRepo.Logbook(50, 0)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if view.Total != 2 {
		t.Errorf("expected total=2, got %d", view.Total)
	}
	// All groups should have tasks
	totalTasks := 0
	for _, g := range view.Groups {
		totalTasks += len(g.Tasks)
	}
	if totalTasks != 2 {
		t.Errorf("expected 2 tasks in groups, got %d", totalTasks)
	}
}

func TestViewLogbookEmpty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	viewRepo := repository.NewViewRepository(db)

	view, err := viewRepo.Logbook(50, 0)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if view.Total != 0 {
		t.Errorf("expected total=0, got %d", view.Total)
	}
	if len(view.Groups) != 0 {
		t.Errorf("expected 0 groups, got %d", len(view.Groups))
	}
}

func TestViewUpcoming(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	viewRepo := repository.NewViewRepository(db)

	tomorrow := time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	nextWeek := time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	taskRepo.Create(model.CreateTaskInput{Title: "Tomorrow", WhenDate: &tomorrow})
	taskRepo.Create(model.CreateTaskInput{Title: "Next week", WhenDate: &nextWeek})

	today := time.Now().Format("2006-01-02")
	view, err := viewRepo.Upcoming(today, 30)
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if len(view.Dates) != 2 {
		t.Fatalf("expected 2 date groups, got %d", len(view.Dates))
	}
	// First date should be tomorrow
	if view.Dates[0].Date != tomorrow {
		t.Errorf("expected first date=%q, got %q", tomorrow, view.Dates[0].Date)
	}
}
