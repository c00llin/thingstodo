package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestSearchByTitle(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	searchRepo := repository.NewSearchRepository(db)

	taskRepo.Create(model.CreateTaskInput{Title: "Buy groceries at the store"})
	taskRepo.Create(model.CreateTaskInput{Title: "Call the dentist"})

	results, err := searchRepo.Search("groceries", 20)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].Task.Title != "Buy groceries at the store" {
		t.Errorf("expected matching task, got %q", results[0].Task.Title)
	}
}

func TestSearchByNotes(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	searchRepo := repository.NewSearchRepository(db)

	taskRepo.Create(model.CreateTaskInput{Title: "Shopping", Notes: "milk eggs bread butter"})
	taskRepo.Create(model.CreateTaskInput{Title: "Reading"})

	results, err := searchRepo.Search("milk", 20)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
}

func TestSearchNoResults(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	searchRepo := repository.NewSearchRepository(db)

	taskRepo.Create(model.CreateTaskInput{Title: "Something"})

	results, err := searchRepo.Search("nonexistent", 20)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(results) != 0 {
		t.Errorf("expected 0 results, got %d", len(results))
	}
}

func TestSearchSnippets(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	searchRepo := repository.NewSearchRepository(db)

	taskRepo.Create(model.CreateTaskInput{Title: "Buy groceries", Notes: "Need to get milk"})

	results, err := searchRepo.Search("groceries", 20)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].TitleSnippet == "" {
		t.Error("expected non-empty title snippet")
	}
}

func TestSearchLimit(t *testing.T) {
	db := testutil.SetupTestDB(t)
	taskRepo := repository.NewTaskRepository(db)
	searchRepo := repository.NewSearchRepository(db)

	for i := 0; i < 5; i++ {
		taskRepo.Create(model.CreateTaskInput{Title: "Test task for search"})
	}

	results, err := searchRepo.Search("test", 3)
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(results) > 3 {
		t.Errorf("expected at most 3 results, got %d", len(results))
	}
}
