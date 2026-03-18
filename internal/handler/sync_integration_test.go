package handler_test

import (
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

// TestSyncFlow_PushPull tests the end-to-end push/pull flow:
// create a task via REST, pull it, push an update, pull again and verify.
func TestSyncFlow_PushPull(t *testing.T) {
	client, changeLog, _ := setupSyncRouter(t)

	// Step 1: Create a task via the normal REST API.
	createResp := client.Post("/api/tasks", map[string]string{"title": "Integration task"})
	testutil.AssertStatus(t, createResp, http.StatusCreated)

	var created map[string]interface{}
	createResp.JSON(t, &created)
	taskID := created["id"].(string)

	// Step 2: Pull changes since=0 — should include the task creation.
	pullResp := client.Get("/api/sync/pull?since=0")
	testutil.AssertStatus(t, pullResp, http.StatusOK)

	var pull1 handler.PullResponse
	pullResp.JSON(t, &pull1)

	if len(pull1.Changes) == 0 {
		t.Fatal("expected at least one change after task creation, got 0")
	}

	// Find the task create change.
	found := false
	for _, c := range pull1.Changes {
		if c.Entity == "task" && c.Action == "create" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected a task create change in pull response, got: %+v", pull1.Changes)
	}

	cursor1 := pull1.Cursor
	if cursor1 == 0 {
		t.Error("expected non-zero cursor after task creation")
	}

	// Step 3: Push an update from "device 2".
	pushBody := map[string]interface{}{
		"device_id": "device-2",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         taskID,
				"action":            "update",
				"data":              map[string]interface{}{"title": "Updated by device 2"},
				"fields":            []string{"title"},
				"client_updated_at": "2099-01-01T00:00:00Z",
			},
		},
	}

	pushResp := client.Post("/api/sync/push", pushBody)
	testutil.AssertStatus(t, pushResp, http.StatusOK)

	var pushResult handler.SyncPushResponse
	pushResp.JSON(t, &pushResult)

	if len(pushResult.Results) != 1 {
		t.Fatalf("expected 1 push result, got %d", len(pushResult.Results))
	}
	if pushResult.Results[0].Status != "applied" {
		t.Errorf("expected status 'applied', got %q (error: %s)",
			pushResult.Results[0].Status, pushResult.Results[0].Error)
	}

	// Step 4: Pull again since cursor1 — should include the update.
	pull2Resp := client.Get("/api/sync/pull?since=" + int64String(cursor1))
	testutil.AssertStatus(t, pull2Resp, http.StatusOK)

	var pull2 handler.PullResponse
	pull2Resp.JSON(t, &pull2)

	if len(pull2.Changes) == 0 {
		t.Fatal("expected changes after push update, got 0")
	}

	foundUpdate := false
	for _, c := range pull2.Changes {
		if c.Entity == "task" && c.Action == "update" && c.EntityID == taskID {
			foundUpdate = true
			break
		}
	}
	if !foundUpdate {
		t.Errorf("expected task update change in second pull, got: %+v", pull2.Changes)
	}

	// Step 5: Verify the task has the updated values.
	getResp := client.Get("/api/tasks/" + taskID)
	testutil.AssertStatus(t, getResp, http.StatusOK)
	testutil.AssertJSONField(t, getResp, "title", "Updated by device 2")

	_ = changeLog
}

// TestSyncConflict_LastWriteWins tests LWW conflict resolution:
// old client timestamp => conflict_resolved; future client timestamp => applied.
func TestSyncConflict_LastWriteWins(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// Create a task.
	createResp := client.Post("/api/tasks", map[string]string{"title": "Conflict task"})
	testutil.AssertStatus(t, createResp, http.StatusCreated)

	var created map[string]interface{}
	createResp.JSON(t, &created)
	taskID := created["id"].(string)

	// Push update with client_updated_at=T1 (very old) — server is newer, so conflict_resolved.
	staleBody := map[string]interface{}{
		"device_id": "dev-conflict",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         taskID,
				"action":            "update",
				"data":              map[string]interface{}{"title": "Stale update"},
				"fields":            []string{"title"},
				"client_updated_at": "2000-01-01T00:00:00Z",
			},
		},
	}

	staleResp := client.Post("/api/sync/push", staleBody)
	testutil.AssertStatus(t, staleResp, http.StatusOK)

	var staleResult handler.SyncPushResponse
	staleResp.JSON(t, &staleResult)

	if staleResult.Results[0].Status != "conflict_resolved" {
		t.Errorf("expected status 'conflict_resolved' for stale update, got %q",
			staleResult.Results[0].Status)
	}

	// Push update with client_updated_at=far future — client is newer, so applied.
	freshBody := map[string]interface{}{
		"device_id": "dev-conflict",
		"changes": []map[string]interface{}{
			{
				"entity":            "task",
				"entity_id":         taskID,
				"action":            "update",
				"data":              map[string]interface{}{"title": "Future update"},
				"fields":            []string{"title"},
				"client_updated_at": "2099-12-31T23:59:59Z",
			},
		},
	}

	freshResp := client.Post("/api/sync/push", freshBody)
	testutil.AssertStatus(t, freshResp, http.StatusOK)

	var freshResult handler.SyncPushResponse
	freshResp.JSON(t, &freshResult)

	if freshResult.Results[0].Status != "applied" {
		t.Errorf("expected status 'applied' for future-timestamp update, got %q",
			freshResult.Results[0].Status)
	}

	// Verify the task has the future update (since it was applied).
	getResp := client.Get("/api/tasks/" + taskID)
	testutil.AssertStatus(t, getResp, http.StatusOK)
	testutil.AssertJSONField(t, getResp, "title", "Future update")
}

// TestSyncFullSync tests the full sync endpoint returns all entities and a valid cursor.
func TestSyncFullSync(t *testing.T) {
	client, _, _ := setupSyncRouter(t)

	// Create several tasks via the normal API.
	titles := []string{"Full sync task 1", "Full sync task 2", "Full sync task 3"}
	for _, title := range titles {
		resp := client.Post("/api/tasks", map[string]string{"title": title})
		testutil.AssertStatus(t, resp, http.StatusCreated)
	}

	// Create an area via sync push.
	areaResp := client.Post("/api/sync/push", map[string]interface{}{
		"device_id": "dev-full",
		"changes": []map[string]interface{}{
			{
				"entity":            "area",
				"entity_id":         "full-area-1",
				"action":            "create",
				"data":              map[string]interface{}{"title": "Full Sync Area"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	})
	testutil.AssertStatus(t, areaResp, http.StatusOK)

	// Create a tag via sync push.
	tagResp := client.Post("/api/sync/push", map[string]interface{}{
		"device_id": "dev-full",
		"changes": []map[string]interface{}{
			{
				"entity":            "tag",
				"entity_id":         "full-tag-1",
				"action":            "create",
				"data":              map[string]interface{}{"title": "full-tag"},
				"fields":            []string{"title"},
				"client_updated_at": "2026-01-01T00:00:00Z",
			},
		},
	})
	testutil.AssertStatus(t, tagResp, http.StatusOK)

	// Get the latest cursor from pull so we can compare.
	pullResp := client.Get("/api/sync/pull?since=0")
	testutil.AssertStatus(t, pullResp, http.StatusOK)
	var pullResult handler.PullResponse
	pullResp.JSON(t, &pullResult)
	latestCursor := pullResult.Cursor

	// Call GET /api/sync/full.
	fullResp := client.Get("/api/sync/full")
	testutil.AssertStatus(t, fullResp, http.StatusOK)

	var fullResult handler.FullSyncResponse
	fullResp.JSON(t, &fullResult)

	// Verify cursor matches latest change_log seq.
	if fullResult.Cursor != latestCursor {
		t.Errorf("expected cursor %d, got %d", latestCursor, fullResult.Cursor)
	}

	// Verify tasks are returned.
	tasksRaw, ok := fullResult.Tasks.([]interface{})
	if !ok || len(tasksRaw) < len(titles) {
		t.Errorf("expected at least %d tasks in full sync, got %v", len(titles), fullResult.Tasks)
	}

	// Verify areas are returned.
	areasRaw, ok := fullResult.Areas.([]interface{})
	if !ok || len(areasRaw) == 0 {
		t.Errorf("expected at least 1 area in full sync, got %v", fullResult.Areas)
	}

	// Verify tags are returned.
	tagsRaw, ok := fullResult.Tags.([]interface{})
	if !ok || len(tagsRaw) == 0 {
		t.Errorf("expected at least 1 tag in full sync, got %v", fullResult.Tags)
	}
}

// TestSyncCursorExpired tests that pulling with an expired cursor returns 410 Gone.
func TestSyncCursorExpired(t *testing.T) {
	client, changeLog, _, db := setupSyncRouterWithDB(t)

	// Insert some old changes to populate the log.
	seq1, _ := changeLog.AppendChange("task", "old-t1", "create", nil, `{"id":"old-t1"}`, "", "")
	_, _ = changeLog.AppendChange("task", "old-t2", "create", nil, `{"id":"old-t2"}`, "", "")

	// Use the first seq as the "old cursor" the client has.
	oldCursor := seq1

	// Delete all current change_log entries to simulate a purge, leaving a gap.
	_, err := db.Exec(`DELETE FROM change_log`)
	if err != nil {
		t.Fatalf("failed to purge change_log: %v", err)
	}

	// Insert a fresh change so the table is non-empty (required for cursor expiry detection).
	// The oldest remaining seq will be higher than oldCursor.
	_, _ = changeLog.AppendChange("task", "new-t1", "create", nil, `{"id":"new-t1"}`, "", "")

	// Pull with the old cursor — oldest seq is now > oldCursor, so 410 Gone expected.
	pullResp := client.Get("/api/sync/pull?since=" + int64String(oldCursor))
	testutil.AssertStatus(t, pullResp, http.StatusGone)
}

// int64String converts an int64 to its decimal string representation.
func int64String(n int64) string {
	if n == 0 {
		return "0"
	}
	// Use strconv-style manual conversion for no extra import.
	buf := make([]byte, 0, 20)
	neg := n < 0
	if neg {
		n = -n
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}
