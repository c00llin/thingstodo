package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func setupProjectForHeadings(t *testing.T) (*repository.HeadingRepository, string) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	headingRepo := repository.NewHeadingRepository(db)
	projRepo := repository.NewProjectRepository(db)
	proj, err := projRepo.Create(model.CreateProjectInput{Title: "Test Project"})
	if err != nil {
		t.Fatalf("failed to create project: %v", err)
	}
	return headingRepo, proj.ID
}

func TestHeadingCreate(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	h, err := repo.Create(projectID, model.CreateHeadingInput{Title: "Section 1"})
	if err != nil {
		t.Fatalf("failed to create heading: %v", err)
	}
	if h.Title != "Section 1" {
		t.Errorf("expected title 'Section 1', got %q", h.Title)
	}
	if h.ProjectID != projectID {
		t.Errorf("expected project_id=%q, got %q", projectID, h.ProjectID)
	}
}

func TestHeadingListByProject(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	repo.Create(projectID, model.CreateHeadingInput{Title: "Section 1"})
	repo.Create(projectID, model.CreateHeadingInput{Title: "Section 2"})

	headings, err := repo.ListByProject(projectID)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(headings) != 2 {
		t.Errorf("expected 2 headings, got %d", len(headings))
	}
}

func TestHeadingUpdate(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	h, _ := repo.Create(projectID, model.CreateHeadingInput{Title: "Old"})
	newTitle := "New"
	updated, err := repo.Update(h.ID, model.UpdateHeadingInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Title != "New" {
		t.Errorf("expected 'New', got %q", updated.Title)
	}
}

func TestHeadingDelete(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	h, _ := repo.Create(projectID, model.CreateHeadingInput{Title: "To delete"})
	err := repo.Delete(h.ID)
	if err != nil {
		t.Fatalf("failed to delete: %v", err)
	}
	headings, _ := repo.ListByProject(projectID)
	if len(headings) != 0 {
		t.Errorf("expected 0 headings after delete, got %d", len(headings))
	}
}

func TestHeadingSortOrder(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	repo.Create(projectID, model.CreateHeadingInput{Title: "First"})
	repo.Create(projectID, model.CreateHeadingInput{Title: "Second"})

	headings, _ := repo.ListByProject(projectID)
	if len(headings) != 2 {
		t.Fatalf("expected 2 headings, got %d", len(headings))
	}
	if headings[0].SortOrder >= headings[1].SortOrder {
		t.Error("expected first heading to have lower sort_order")
	}
}

func TestHeadingReorder(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	h1, _ := repo.Create(projectID, model.CreateHeadingInput{Title: "First"})
	h2, _ := repo.Create(projectID, model.CreateHeadingInput{Title: "Second"})

	// Swap order by updating sort_order.
	newOrder := float64(0)
	_, _ = repo.Update(h2.ID, model.UpdateHeadingInput{SortOrder: &newOrder})

	headings, _ := repo.ListByProject(projectID)
	if headings[0].ID != h2.ID {
		t.Error("expected h2 to come first after reorder")
	}
	_ = h1
}

func TestHeadingEmptyList(t *testing.T) {
	repo, projectID := setupProjectForHeadings(t)

	headings, err := repo.ListByProject(projectID)
	if err != nil {
		t.Fatalf("failed to list: %v", err)
	}
	if len(headings) != 0 {
		t.Errorf("expected 0 headings, got %d", len(headings))
	}
}

func TestHeadingUpdateNotFound(t *testing.T) {
	repo, _ := setupProjectForHeadings(t)

	newTitle := "test"
	h, err := repo.Update("nonexistent", model.UpdateHeadingInput{Title: &newTitle})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h != nil {
		t.Error("expected nil for nonexistent heading")
	}
}
