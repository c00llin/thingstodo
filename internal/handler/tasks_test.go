package handler_test

import (
	"database/sql"
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/scheduler"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
	"github.com/go-chi/chi/v5"
)

func setupTaskRouter(t *testing.T) (*testutil.TestClient, *sql.DB) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	broker := sse.NewBroker()
	taskRepo := repository.NewTaskRepository(db)
	ruleRepo := repository.NewRepeatRuleRepository(db)
	checklistRepo := repository.NewChecklistRepository(db)
	attachRepo := repository.NewAttachmentRepository(db)
	scheduleRepo := repository.NewScheduleRepository(db)
	sched := scheduler.New(db, taskRepo, ruleRepo, checklistRepo, attachRepo, scheduleRepo)
	taskHandler := handler.NewTaskHandler(taskRepo, broker, sched)

	r := chi.NewRouter()
	r.Route("/api/tasks", func(r chi.Router) {
		r.Get("/", taskHandler.List)
		r.Post("/", taskHandler.Create)
		r.Patch("/reorder", taskHandler.Reorder)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", taskHandler.Get)
			r.Patch("/", taskHandler.Update)
			r.Delete("/", taskHandler.Delete)
			r.Patch("/complete", taskHandler.Complete)
			r.Patch("/cancel", taskHandler.Cancel)
			r.Patch("/wontdo", taskHandler.WontDo)
			r.Patch("/reopen", taskHandler.Reopen)
		})
	})

	client := testutil.NewTestClient(t, r)
	return client, db
}

func TestTaskHandlerCreate(t *testing.T) {
	client, _ := setupTaskRouter(t)

	resp := client.Post("/api/tasks", map[string]string{"title": "Buy groceries"})
	testutil.AssertStatus(t, resp, http.StatusCreated)
	testutil.AssertJSONField(t, resp, "title", "Buy groceries")
	testutil.AssertJSONField(t, resp, "status", "open")
}

func TestTaskHandlerCreateMissingTitle(t *testing.T) {
	client, _ := setupTaskRouter(t)

	resp := client.Post("/api/tasks", map[string]string{})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
	testutil.AssertJSONField(t, resp, "code", "VALIDATION")
}

func TestTaskHandlerCreateInvalidJSON(t *testing.T) {
	client, _ := setupTaskRouter(t)

	// Send raw request with invalid body
	resp := client.Post("/api/tasks", "not json")
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestTaskHandlerGet(t *testing.T) {
	client, _ := setupTaskRouter(t)

	// Create a task first
	createResp := client.Post("/api/tasks", map[string]string{"title": "Test task"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	resp := client.Get("/api/tasks/" + id)
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "Test task")
}

func TestTaskHandlerGetNotFound(t *testing.T) {
	client, _ := setupTaskRouter(t)

	resp := client.Get("/api/tasks/nonexistent")
	testutil.AssertStatus(t, resp, http.StatusNotFound)
	testutil.AssertJSONField(t, resp, "code", "NOT_FOUND")
}

func TestTaskHandlerUpdate(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "Original"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	resp := client.Patch("/api/tasks/"+id, map[string]string{"title": "Updated"})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "Updated")
}

func TestTaskHandlerDelete(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "To delete"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	resp := client.Delete("/api/tasks/" + id)
	testutil.AssertStatus(t, resp, http.StatusNoContent)

	// Soft-deleted task is still retrievable by direct GET (for trash view)
	getResp := client.Get("/api/tasks/" + id)
	testutil.AssertStatus(t, getResp, http.StatusOK)

	// But it should not appear in list
	listResp := client.Get("/api/tasks")
	var listBody struct {
		Tasks []map[string]interface{} `json:"tasks"`
	}
	listResp.JSON(t, &listBody)
	for _, task := range listBody.Tasks {
		if task["id"] == id {
			t.Error("soft-deleted task should not appear in task list")
		}
	}
}

func TestTaskHandlerComplete(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "To complete"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	resp := client.Patch("/api/tasks/"+id+"/complete", nil)
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "status", "completed")
}

func TestTaskHandlerCancel(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "To cancel"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	resp := client.Patch("/api/tasks/"+id+"/cancel", nil)
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "status", "canceled")
}

func TestTaskHandlerWontDo(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "Won't do"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	resp := client.Patch("/api/tasks/"+id+"/wontdo", nil)
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "status", "wont_do")
}

func TestTaskHandlerReopen(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "Reopen me"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	id := created["id"].(string)

	client.Patch("/api/tasks/"+id+"/complete", nil)
	resp := client.Patch("/api/tasks/"+id+"/reopen", nil)
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "status", "open")
}

func TestTaskHandlerList(t *testing.T) {
	client, _ := setupTaskRouter(t)

	client.Post("/api/tasks", map[string]string{"title": "Task 1"})
	client.Post("/api/tasks", map[string]string{"title": "Task 2"})

	resp := client.Get("/api/tasks")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	tasks := body["tasks"].([]interface{})
	if len(tasks) != 2 {
		t.Errorf("expected 2 tasks, got %d", len(tasks))
	}
}

func TestTaskHandlerListFilterByStatus(t *testing.T) {
	client, _ := setupTaskRouter(t)

	createResp := client.Post("/api/tasks", map[string]string{"title": "Task 1"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	client.Post("/api/tasks", map[string]string{"title": "Task 2"})
	client.Patch("/api/tasks/"+created["id"].(string)+"/complete", nil)

	resp := client.Get("/api/tasks?status=open")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	tasks := body["tasks"].([]interface{})
	if len(tasks) != 1 {
		t.Errorf("expected 1 open task, got %d", len(tasks))
	}
}

func TestTaskHandlerListEmpty(t *testing.T) {
	client, _ := setupTaskRouter(t)

	resp := client.Get("/api/tasks")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	tasks := body["tasks"].([]interface{})
	if len(tasks) != 0 {
		t.Errorf("expected 0 tasks, got %d", len(tasks))
	}
}

func TestTaskHandlerReorder(t *testing.T) {
	client, _ := setupTaskRouter(t)

	r1 := client.Post("/api/tasks", map[string]string{"title": "Task 1"})
	r2 := client.Post("/api/tasks", map[string]string{"title": "Task 2"})

	var t1, t2 map[string]interface{}
	r1.JSON(t, &t1)
	r2.JSON(t, &t2)

	resp := client.Patch("/api/tasks/reorder", map[string]interface{}{
		"items": []map[string]interface{}{
			{"id": t1["id"], "sort_field": "sort_order_today", "sort_order": 200},
			{"id": t2["id"], "sort_field": "sort_order_today", "sort_order": 100},
		},
	})
	testutil.AssertStatus(t, resp, http.StatusOK)
}
