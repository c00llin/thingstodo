package handler_test

import (
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
	"github.com/go-chi/chi/v5"
)

func setupTagRouter(t *testing.T) *testutil.TestClient {
	t.Helper()
	db := testutil.SetupTestDB(t)
	broker := sse.NewBroker()
	tagRepo := repository.NewTagRepository(db)
	tagHandler := handler.NewTagHandler(tagRepo, broker)

	r := chi.NewRouter()
	r.Route("/api/tags", func(r chi.Router) {
		r.Get("/", tagHandler.List)
		r.Post("/", tagHandler.Create)
		r.Route("/{id}", func(r chi.Router) {
			r.Patch("/", tagHandler.Update)
			r.Delete("/", tagHandler.Delete)
			r.Get("/tasks", tagHandler.GetTasks)
		})
	})

	return testutil.NewTestClient(t, r)
}

func TestTagHandlerCreate(t *testing.T) {
	client := setupTagRouter(t)

	resp := client.Post("/api/tags", map[string]string{"title": "urgent"})
	testutil.AssertStatus(t, resp, http.StatusCreated)
	testutil.AssertJSONField(t, resp, "title", "urgent")
}

func TestTagHandlerCreateMissingTitle(t *testing.T) {
	client := setupTagRouter(t)

	resp := client.Post("/api/tags", map[string]string{})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestTagHandlerUpdate(t *testing.T) {
	client := setupTagRouter(t)

	createResp := client.Post("/api/tags", map[string]string{"title": "old"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Patch("/api/tags/"+created["id"].(string), map[string]string{"title": "new"})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "new")
}

func TestTagHandlerDelete(t *testing.T) {
	client := setupTagRouter(t)

	createResp := client.Post("/api/tags", map[string]string{"title": "temp"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Delete("/api/tags/" + created["id"].(string))
	testutil.AssertStatus(t, resp, http.StatusNoContent)
}

func TestTagHandlerList(t *testing.T) {
	client := setupTagRouter(t)

	client.Post("/api/tags", map[string]string{"title": "tag1"})
	client.Post("/api/tags", map[string]string{"title": "tag2"})

	resp := client.Get("/api/tags")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	tags := body["tags"].([]interface{})
	if len(tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(tags))
	}
}

func TestTagHandlerGetTasks(t *testing.T) {
	client := setupTagRouter(t)

	// Create a tag (tasks can't be created through this router, so just verify empty list)
	createResp := client.Post("/api/tags", map[string]string{"title": "work"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Get("/api/tags/" + created["id"].(string) + "/tasks")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	tasks := body["tasks"].([]interface{})
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}
}
