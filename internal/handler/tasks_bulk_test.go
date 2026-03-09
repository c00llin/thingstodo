package handler_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func bulkCreateTask(t *testing.T, client *testutil.TestClient, title string) string {
	t.Helper()
	resp := client.Post("/api/tasks", map[string]string{"title": title})
	testutil.AssertStatus(t, resp, http.StatusCreated)
	var m map[string]interface{}
	if err := json.Unmarshal(resp.Body, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	return m["id"].(string)
}

func TestBulkAction_Complete(t *testing.T) {
	client, _ := setupTaskRouter(t)

	id1 := bulkCreateTask(t, client, "Task 1")
	id2 := bulkCreateTask(t, client, "Task 2")

	resp := client.Post("/api/tasks/bulk", map[string]interface{}{
		"task_ids": []string{id1, id2},
		"action":   "complete",
	})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "affected", float64(2))

	resp1 := client.Get("/api/tasks/" + id1)
	testutil.AssertStatus(t, resp1, http.StatusOK)
	testutil.AssertJSONField(t, resp1, "status", "completed")

	resp2 := client.Get("/api/tasks/" + id2)
	testutil.AssertStatus(t, resp2, http.StatusOK)
	testutil.AssertJSONField(t, resp2, "status", "completed")
}

func TestBulkAction_Delete(t *testing.T) {
	client, _ := setupTaskRouter(t)

	id1 := bulkCreateTask(t, client, "Task A")
	id2 := bulkCreateTask(t, client, "Task B")

	resp := client.Post("/api/tasks/bulk", map[string]interface{}{
		"task_ids": []string{id1, id2},
		"action":   "delete",
	})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "affected", float64(2))
}

func TestBulkAction_InvalidAction(t *testing.T) {
	client, _ := setupTaskRouter(t)

	resp := client.Post("/api/tasks/bulk", map[string]interface{}{
		"task_ids": []string{"abc"},
		"action":   "explode",
	})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestBulkAction_EmptyTaskIDs(t *testing.T) {
	client, _ := setupTaskRouter(t)

	resp := client.Post("/api/tasks/bulk", map[string]interface{}{
		"task_ids": []string{},
		"action":   "complete",
	})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestBulkAction_SetPriority(t *testing.T) {
	client, _ := setupTaskRouter(t)

	id1 := bulkCreateTask(t, client, "Priority Task")

	resp := client.Post("/api/tasks/bulk", map[string]interface{}{
		"task_ids": []string{id1},
		"action":   "set_priority",
		"params":   map[string]interface{}{"priority": 1},
	})
	testutil.AssertStatus(t, resp, http.StatusOK)

	resp1 := client.Get("/api/tasks/" + id1)
	testutil.AssertStatus(t, resp1, http.StatusOK)
	testutil.AssertJSONField(t, resp1, "high_priority", true)
}
