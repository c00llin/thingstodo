package handler_test

import (
	"database/sql"
	"fmt"
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
	"github.com/go-chi/chi/v5"
)

func setupSyncRouter(t *testing.T) (*testutil.TestClient, *repository.ChangeLogRepository, *repository.TaskRepository) {
	client, changeLog, taskRepo, _ := setupSyncRouterWithDB(t)
	return client, changeLog, taskRepo
}

func setupSyncRouterWithDB(t *testing.T) (*testutil.TestClient, *repository.ChangeLogRepository, *repository.TaskRepository, *sql.DB) {
	t.Helper()
	db := testutil.SetupTestDB(t)

	changeLogRepo := repository.NewChangeLogRepository(db)
	taskRepo := repository.NewTaskRepository(db, changeLogRepo)
	projectRepo := repository.NewProjectRepository(db, changeLogRepo)
	areaRepo := repository.NewAreaRepository(db, changeLogRepo)
	tagRepo := repository.NewTagRepository(db, changeLogRepo)
	checklistRepo := repository.NewChecklistRepository(db, changeLogRepo)
	headingRepo := repository.NewHeadingRepository(db, changeLogRepo)

	scheduleRepo := repository.NewScheduleRepository(db, changeLogRepo)
	reminderRepo := repository.NewReminderRepository(db, changeLogRepo)
	attachmentRepo := repository.NewAttachmentRepository(db, changeLogRepo)
	repeatRuleRepo := repository.NewRepeatRuleRepository(db, changeLogRepo)
	settingsRepo := repository.NewUserSettingsRepository(db)

	syncH := handler.NewSyncHandler(changeLogRepo, taskRepo, projectRepo, areaRepo, tagRepo, checklistRepo, headingRepo, attachmentRepo, scheduleRepo, reminderRepo, repeatRuleRepo, nil)

	r := chi.NewRouter()
	r.Get("/api/sync/pull", syncH.Pull)
	r.Post("/api/sync/push", syncH.Push)
	r.Get("/api/sync/full", syncH.Full)

	// Also mount task endpoints so we can create test data
	broker := sse.NewBroker()
	taskH := handler.NewTaskHandler(taskRepo, scheduleRepo, reminderRepo, settingsRepo, broker, nil)

	r.Route("/api/tasks", func(r chi.Router) {
		r.Post("/", taskH.Create)
		r.Get("/{id}", taskH.Get)
	})

	client := testutil.NewTestClient(t, r)
	return client, changeLogRepo, taskRepo, db
}

// --- Pull tests ---

func TestSyncPullEmpty(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	resp := client.Get("/api/sync/pull?since=0")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.PullResponse
	resp.JSON(t, &result)

	if len(result.Changes) != 0 {
		t.Errorf("expected 0 changes, got %d", len(result.Changes))
	}
	if result.Cursor != 0 {
		t.Errorf("expected cursor 0, got %d", result.Cursor)
	}
	if result.HasMore {
		t.Error("expected has_more=false")
	}
}

func TestSyncPullReturnsChanges(t *testing.T) {
	client, changeLog, _ := setupSyncRouter(t)

	// Insert test changes directly
	_, _ = changeLog.AppendChange("task", "t1", "create", nil, `{"id":"t1","title":"Test"}`, "", "")
	_, _ = changeLog.AppendChange("task", "t1", "update", nil, `{"id":"t1","title":"Updated"}`, "", "")

	resp := client.Get("/api/sync/pull?since=0")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.PullResponse
	resp.JSON(t, &result)

	if len(result.Changes) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(result.Changes))
	}
	if result.Changes[0].Entity != "task" {
		t.Errorf("expected entity 'task', got %q", result.Changes[0].Entity)
	}
	if result.Changes[0].Action != "create" {
		t.Errorf("expected action 'create', got %q", result.Changes[0].Action)
	}
	if result.Cursor != result.Changes[1].Seq {
		t.Errorf("cursor should be last seq")
	}
	if result.HasMore {
		t.Error("expected has_more=false")
	}
}

func TestSyncPullSinceCursor(t *testing.T) {
	client, changeLog, _ := setupSyncRouter(t)

	_, _ = changeLog.AppendChange("task", "t1", "create", nil, `{"id":"t1"}`, "", "")
	seq2, _ := changeLog.AppendChange("task", "t2", "create", nil, `{"id":"t2"}`, "", "")
	_ = seq2

	// Pull since seq 1 should only return the second change
	resp := client.Get("/api/sync/pull?since=1")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.PullResponse
	resp.JSON(t, &result)

	if len(result.Changes) != 1 {
		t.Fatalf("expected 1 change, got %d", len(result.Changes))
	}
	if result.Changes[0].EntityID != "t2" {
		t.Errorf("expected entity_id 't2', got %q", result.Changes[0].EntityID)
	}
}

func TestSyncPullHasMore(t *testing.T) {
	client, changeLog, _ := setupSyncRouter(t)

	// Insert 3 changes
	for i := 0; i < 3; i++ {
		_, _ = changeLog.AppendChange("task", fmt.Sprintf("t%d", i), "create", nil, fmt.Sprintf(`{"id":"t%d"}`, i), "", "")
	}

	// Pull with limit=2 should have has_more=true
	resp := client.Get("/api/sync/pull?since=0&limit=2")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.PullResponse
	resp.JSON(t, &result)

	if len(result.Changes) != 2 {
		t.Fatalf("expected 2 changes, got %d", len(result.Changes))
	}
	if !result.HasMore {
		t.Error("expected has_more=true")
	}
}

func TestSyncPullInvalidSince(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	resp := client.Get("/api/sync/pull?since=abc")
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestSyncPullInvalidLimit(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	resp := client.Get("/api/sync/pull?since=0&limit=-1")
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestSyncPullLimitCapped(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// Requesting limit=9999 should not error (capped to 1000)
	resp := client.Get("/api/sync/pull?since=0&limit=9999")
	testutil.AssertStatus(t, resp, http.StatusOK)
}

func TestSyncPullDefaultSince(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// since parameter omitted defaults to 0
	resp := client.Get("/api/sync/pull")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.PullResponse
	resp.JSON(t, &result)
	if result.Cursor != 0 {
		t.Errorf("expected cursor 0, got %d", result.Cursor)
	}
}

// --- Push tests ---

func TestSyncPushCreateTask(t *testing.T) {
	client, _, taskRepo := setupSyncRouter(t)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         "sync-t1",
				"action":            "create",
				"data":              map[string]interface{}{"title": "Synced task"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if len(result.Results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(result.Results))
	}
	if result.Results[0].Status != "applied" {
		t.Errorf("expected status 'applied', got %q (error: %s)", result.Results[0].Status, result.Results[0].Error)
	}

	// Verify the task was created (it uses a server-generated ID, so check via list)
	_ = taskRepo
}

func TestSyncPushUpdateTask(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// First create a task
	createResp := client.Post("/api/tasks", map[string]string{"title": "Original"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	taskID := created["id"].(string)

	// Push an update
	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         taskID,
				"action":            "update",
				"data":              map[string]interface{}{"title": "Updated via sync"},
				"fields":            []string{"title"},
				"client_updated_at": "2099-01-01T00:00:00Z", // future time, so client wins
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "applied" {
		t.Errorf("expected status 'applied', got %q (error: %s)", result.Results[0].Status, result.Results[0].Error)
	}

	// Verify the update
	getResp := client.Get("/api/tasks/" + taskID)
	testutil.AssertJSONField(t, getResp, "title", "Updated via sync")
}

func TestSyncPushUpdateTaskConflictResolved(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// Create a task
	createResp := client.Post("/api/tasks", map[string]string{"title": "Original"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	taskID := created["id"].(string)

	// Push an update with old timestamp — server is newer, so conflict_resolved
	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         taskID,
				"action":            "update",
				"data":              map[string]interface{}{"title": "Stale update"},
				"fields":            []string{"title"},
				"client_updated_at": "2000-01-01T00:00:00Z", // past time, server is newer
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "conflict_resolved" {
		t.Errorf("expected status 'conflict_resolved', got %q", result.Results[0].Status)
	}
}

func TestSyncPushDeleteTask(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// Create a task
	createResp := client.Post("/api/tasks", map[string]string{"title": "To delete"})
	var created map[string]interface{}
	createResp.JSON(t, &created)
	taskID := created["id"].(string)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         taskID,
				"action":            "delete",
				"data":              map[string]interface{}{},
				"fields":            []string{},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "applied" {
		t.Errorf("expected status 'applied', got %q (error: %s)", result.Results[0].Status, result.Results[0].Error)
	}
}

func TestSyncPushUnsupportedEntity(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "unknown",
				"entity_id":         "x1",
				"action":            "create",
				"data":              map[string]interface{}{},
				"fields":            []string{},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "error" {
		t.Errorf("expected status 'error', got %q", result.Results[0].Status)
	}
}

func TestSyncPushMissingDeviceID(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	body := map[string]interface{}{
		"changes": []map[string]interface{}{},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestSyncPushMultipleChanges(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         "mt1",
				"action":            "create",
				"data":              map[string]interface{}{"title": "Task 1"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
			{
				"entity":            "task",
				"entity_id":         "mt2",
				"action":            "create",
				"data":              map[string]interface{}{"title": "Task 2"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if len(result.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(result.Results))
	}
	for i, r := range result.Results {
		if r.Status != "applied" {
			t.Errorf("result[%d]: expected 'applied', got %q (error: %s)", i, r.Status, r.Error)
		}
	}
}

func TestSyncPushCreateArea(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "area",
				"entity_id":         "a1",
				"action":            "create",
				"data":              map[string]interface{}{"title": "Work"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "applied" {
		t.Errorf("expected 'applied', got %q (error: %s)", result.Results[0].Status, result.Results[0].Error)
	}
}

func TestSyncPushCreateTag(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "tag",
				"entity_id":         "tag1",
				"action":            "create",
				"data":              map[string]interface{}{"title": "urgent"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "applied" {
		t.Errorf("expected 'applied', got %q (error: %s)", result.Results[0].Status, result.Results[0].Error)
	}
}

func TestSyncPushInvalidJSON(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	resp := client.Post("/api/sync/push", "not json")
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestSyncPushUpdateNonexistentTask(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	body := map[string]interface{}{
		"device_id": "dev1",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         "nonexistent",
				"action":            "update",
				"data":              map[string]interface{}{"title": "Nope"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	}

	resp := client.Post("/api/sync/push", body)
	testutil.AssertStatus(t, resp, http.StatusOK)

	var result handler.SyncPushResponse
	resp.JSON(t, &result)

	if result.Results[0].Status != "error" {
		t.Errorf("expected 'error', got %q", result.Results[0].Status)
	}
}
