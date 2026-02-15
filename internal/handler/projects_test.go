package handler_test

import (
	"database/sql"
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
	"github.com/go-chi/chi/v5"
)

func setupProjectRouter(t *testing.T) (*testutil.TestClient, *sql.DB) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	broker := sse.NewBroker()
	projRepo := repository.NewProjectRepository(db)
	projHandler := handler.NewProjectHandler(projRepo, broker)

	r := chi.NewRouter()
	r.Route("/api/projects", func(r chi.Router) {
		r.Get("/", projHandler.List)
		r.Post("/", projHandler.Create)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", projHandler.Get)
			r.Patch("/", projHandler.Update)
			r.Delete("/", projHandler.Delete)
			r.Patch("/complete", projHandler.Complete)
		})
	})

	return testutil.NewTestClient(t, r), db
}

func TestProjectHandlerCreate(t *testing.T) {
	client, _ := setupProjectRouter(t)

	resp := client.Post("/api/projects", map[string]string{"title": "My Project"})
	testutil.AssertStatus(t, resp, http.StatusCreated)
	testutil.AssertJSONField(t, resp, "title", "My Project")
	testutil.AssertJSONField(t, resp, "status", "open")
}

func TestProjectHandlerCreateMissingTitle(t *testing.T) {
	client, _ := setupProjectRouter(t)

	resp := client.Post("/api/projects", map[string]string{})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestProjectHandlerGet(t *testing.T) {
	client, _ := setupProjectRouter(t)

	createResp := client.Post("/api/projects", map[string]string{"title": "Test"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Get("/api/projects/" + created["id"].(string))
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "Test")
}

func TestProjectHandlerGetNotFound(t *testing.T) {
	client, _ := setupProjectRouter(t)

	resp := client.Get("/api/projects/nonexistent")
	testutil.AssertStatus(t, resp, http.StatusNotFound)
}

func TestProjectHandlerUpdate(t *testing.T) {
	client, _ := setupProjectRouter(t)

	createResp := client.Post("/api/projects", map[string]string{"title": "Original"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Patch("/api/projects/"+created["id"].(string), map[string]string{"title": "Updated"})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "Updated")
}

func TestProjectHandlerDelete(t *testing.T) {
	client, _ := setupProjectRouter(t)

	createResp := client.Post("/api/projects", map[string]string{"title": "To delete"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Delete("/api/projects/" + created["id"].(string))
	testutil.AssertStatus(t, resp, http.StatusNoContent)

	getResp := client.Get("/api/projects/" + created["id"].(string))
	testutil.AssertStatus(t, getResp, http.StatusNotFound)
}

func TestProjectHandlerComplete(t *testing.T) {
	client, _ := setupProjectRouter(t)

	createResp := client.Post("/api/projects", map[string]string{"title": "To complete"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Patch("/api/projects/"+created["id"].(string)+"/complete", nil)
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "status", "completed")
}

func TestProjectHandlerList(t *testing.T) {
	client, _ := setupProjectRouter(t)

	client.Post("/api/projects", map[string]string{"title": "Project 1"})
	client.Post("/api/projects", map[string]string{"title": "Project 2"})

	resp := client.Get("/api/projects")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	projects := body["projects"].([]interface{})
	if len(projects) != 2 {
		t.Errorf("expected 2 projects, got %d", len(projects))
	}
}

func TestProjectHandlerListEmpty(t *testing.T) {
	client, _ := setupProjectRouter(t)

	resp := client.Get("/api/projects")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	projects := body["projects"].([]interface{})
	if len(projects) != 0 {
		t.Errorf("expected 0 projects, got %d", len(projects))
	}
}
