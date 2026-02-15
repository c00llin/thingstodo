package handler_test

import (
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
	"github.com/go-chi/chi/v5"
)

func setupChecklistRouter(t *testing.T) (*testutil.TestClient, string) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	broker := sse.NewBroker()
	checkRepo := repository.NewChecklistRepository(db)
	checkHandler := handler.NewChecklistHandler(checkRepo, broker)
	taskRepo := repository.NewTaskRepository(db)

	// Create a task to attach checklist items to.
	task, err := taskRepo.Create(model.CreateTaskInput{Title: "Parent task"})
	if err != nil {
		t.Fatalf("failed to create task: %v", err)
	}

	r := chi.NewRouter()
	r.Route("/api/tasks/{id}/checklist", func(r chi.Router) {
		r.Get("/", checkHandler.List)
		r.Post("/", checkHandler.Create)
	})
	r.Patch("/api/checklist/{id}", checkHandler.Update)
	r.Delete("/api/checklist/{id}", checkHandler.Delete)

	return testutil.NewTestClient(t, r), task.ID
}

func TestChecklistHandlerCreate(t *testing.T) {
	client, taskID := setupChecklistRouter(t)

	resp := client.Post("/api/tasks/"+taskID+"/checklist", map[string]string{"title": "Buy milk"})
	testutil.AssertStatus(t, resp, http.StatusCreated)
	testutil.AssertJSONField(t, resp, "title", "Buy milk")
}

func TestChecklistHandlerCreateMissingTitle(t *testing.T) {
	client, taskID := setupChecklistRouter(t)

	resp := client.Post("/api/tasks/"+taskID+"/checklist", map[string]string{})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestChecklistHandlerList(t *testing.T) {
	client, taskID := setupChecklistRouter(t)

	client.Post("/api/tasks/"+taskID+"/checklist", map[string]string{"title": "Item 1"})
	client.Post("/api/tasks/"+taskID+"/checklist", map[string]string{"title": "Item 2"})

	resp := client.Get("/api/tasks/" + taskID + "/checklist")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	items := body["items"].([]interface{})
	if len(items) != 2 {
		t.Errorf("expected 2 items, got %d", len(items))
	}
}

func TestChecklistHandlerUpdate(t *testing.T) {
	client, taskID := setupChecklistRouter(t)

	createResp := client.Post("/api/tasks/"+taskID+"/checklist", map[string]string{"title": "Toggle me"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Patch("/api/checklist/"+created["id"].(string), map[string]interface{}{"completed": true})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "completed", true)
}

func TestChecklistHandlerDelete(t *testing.T) {
	client, taskID := setupChecklistRouter(t)

	createResp := client.Post("/api/tasks/"+taskID+"/checklist", map[string]string{"title": "Delete me"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Delete("/api/checklist/" + created["id"].(string))
	testutil.AssertStatus(t, resp, http.StatusNoContent)

	listResp := client.Get("/api/tasks/" + taskID + "/checklist")
	var body map[string]interface{}
	listResp.JSON(t, &body)
	items := body["items"].([]interface{})
	if len(items) != 0 {
		t.Errorf("expected 0 items after delete, got %d", len(items))
	}
}
