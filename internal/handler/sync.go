package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"log"

	mw "github.com/collinjanssen/thingstodo/internal/middleware"
	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/scheduler"
)

const (
	defaultPullLimit = 500
	maxPullLimit     = 1000
)

// SyncHandler handles sync pull and push endpoints.
type SyncHandler struct {
	changeLog   *repository.ChangeLogRepository
	tasks       *repository.TaskRepository
	projects    *repository.ProjectRepository
	areas       *repository.AreaRepository
	tags        *repository.TagRepository
	checklist   *repository.ChecklistRepository
	headings    *repository.HeadingRepository
	attachments *repository.AttachmentRepository
	schedules   *repository.ScheduleRepository
	reminders   *repository.ReminderRepository
	repeatRules *repository.RepeatRuleRepository
	scheduler   *scheduler.Scheduler
}

// NewSyncHandler creates a new SyncHandler.
func NewSyncHandler(
	changeLog *repository.ChangeLogRepository,
	tasks *repository.TaskRepository,
	projects *repository.ProjectRepository,
	areas *repository.AreaRepository,
	tags *repository.TagRepository,
	checklist *repository.ChecklistRepository,
	headings *repository.HeadingRepository,
	attachments *repository.AttachmentRepository,
	schedules *repository.ScheduleRepository,
	reminders *repository.ReminderRepository,
	repeatRules *repository.RepeatRuleRepository,
	sched *scheduler.Scheduler,
) *SyncHandler {
	return &SyncHandler{
		changeLog:   changeLog,
		tasks:       tasks,
		projects:    projects,
		areas:       areas,
		tags:        tags,
		checklist:   checklist,
		headings:    headings,
		attachments: attachments,
		schedules:   schedules,
		reminders:   reminders,
		repeatRules: repeatRules,
		scheduler:   sched,
	}
}

// PullResponse is returned by GET /api/sync/pull.
type PullResponse struct {
	Changes []repository.ChangeLogEntry `json:"changes"`
	Cursor  int64                       `json:"cursor"`
	HasMore bool                        `json:"has_more"`
}

// Pull returns changes since a given sequence number.
// GET /api/sync/pull?since={seq}&limit={n}
func (h *SyncHandler) Pull(w http.ResponseWriter, r *http.Request) {
	sinceStr := r.URL.Query().Get("since")
	var since int64
	if sinceStr != "" {
		var err error
		since, err = strconv.ParseInt(sinceStr, 10, 64)
		if err != nil || since < 0 {
			writeError(w, http.StatusBadRequest, "invalid 'since' parameter", "BAD_REQUEST")
			return
		}
	}

	limit := defaultPullLimit
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		l, err := strconv.Atoi(limitStr)
		if err != nil || l < 1 {
			writeError(w, http.StatusBadRequest, "invalid 'limit' parameter", "BAD_REQUEST")
			return
		}
		limit = l
	}
	if limit > maxPullLimit {
		limit = maxPullLimit
	}

	// Detect expired cursor: if the client has a cursor but the oldest entry in the
	// change log is newer than that cursor, the history has been purged and the client
	// must fall back to a full sync.
	if since > 0 {
		oldest, err := h.changeLog.GetOldestSeq()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
			return
		}
		if oldest > 0 && oldest > since {
			writeError(w, http.StatusGone, "cursor expired: change log has been purged, perform a full sync", "CURSOR_EXPIRED")
			return
		}
	}

	// Fetch limit+1 to detect has_more
	entries, err := h.changeLog.GetChangesSince(since, limit+1)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	hasMore := len(entries) > limit
	if hasMore {
		entries = entries[:limit]
	}

	var cursor int64
	if len(entries) > 0 {
		cursor = entries[len(entries)-1].Seq
	} else {
		cursor = since
	}

	writeJSON(w, http.StatusOK, PullResponse{
		Changes: entries,
		Cursor:  cursor,
		HasMore: hasMore,
	})
}

// FullSyncResponse is returned by GET /api/sync/full.
type FullSyncResponse struct {
	Tasks       interface{} `json:"tasks"`
	Projects    interface{} `json:"projects"`
	Areas       interface{} `json:"areas"`
	Tags        interface{} `json:"tags"`
	Headings    interface{} `json:"headings"`
	Checklist   interface{} `json:"checklist"`
	Attachments interface{} `json:"attachments"`
	Schedules   interface{} `json:"schedules"`
	Reminders   interface{} `json:"reminders"`
	RepeatRules interface{} `json:"repeat_rules"`
	Cursor      int64       `json:"cursor"`
}

// Full returns all current entities along with the latest change_log cursor.
// GET /api/sync/full
func (h *SyncHandler) Full(w http.ResponseWriter, r *http.Request) {
	tasks, err := h.tasks.List(model.TaskFilters{})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load tasks: "+err.Error(), "INTERNAL")
		return
	}

	projects, err := h.projects.List(nil, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load projects: "+err.Error(), "INTERNAL")
		return
	}

	areas, err := h.areas.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load areas: "+err.Error(), "INTERNAL")
		return
	}

	tags, err := h.tags.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load tags: "+err.Error(), "INTERNAL")
		return
	}

	headings, err := h.headings.ListAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load headings: "+err.Error(), "INTERNAL")
		return
	}

	checklist, err := h.checklist.ListAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load checklist: "+err.Error(), "INTERNAL")
		return
	}

	attachments, err := h.attachments.ListAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load attachments: "+err.Error(), "INTERNAL")
		return
	}

	schedules, err := h.schedules.ListAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load schedules: "+err.Error(), "INTERNAL")
		return
	}

	reminders, err := h.reminders.ListAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load reminders: "+err.Error(), "INTERNAL")
		return
	}

	repeatRules, err := h.repeatRules.ListAll()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load repeat rules: "+err.Error(), "INTERNAL")
		return
	}

	cursor, err := h.changeLog.GetLatestSeq()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get cursor: "+err.Error(), "INTERNAL")
		return
	}

	writeJSON(w, http.StatusOK, FullSyncResponse{
		Tasks:       tasks,
		Projects:    projects,
		Areas:       areas,
		Tags:        tags,
		Headings:    headings,
		Checklist:   checklist,
		Attachments: attachments,
		Schedules:   schedules,
		Reminders:   reminders,
		RepeatRules: repeatRules,
		Cursor:      cursor,
	})
}

// --- Push types ---

// SyncPushRequest is the body for POST /api/sync/push.
type SyncPushRequest struct {
	DeviceID string       `json:"device_id"`
	Changes  []SyncChange `json:"changes"`
}

// SyncChange represents a single change from the client.
type SyncChange struct {
	Entity          string                 `json:"entity"`
	EntityID        string                 `json:"entity_id"`
	Action          string                 `json:"action"` // create, update, delete
	Data            map[string]interface{} `json:"data"`
	Fields          []string               `json:"fields"`
	ClientUpdatedAt string                 `json:"client_updated_at"`
}

// SyncPushResult is the result for a single change in the push response.
type SyncPushResult struct {
	Entity   string `json:"entity"`
	EntityID string `json:"entity_id"`
	Status   string `json:"status"` // applied, conflict_resolved, error
	Seq      int64  `json:"seq"`
	Error    string `json:"error,omitempty"`
}

// SyncPushResponse is returned by POST /api/sync/push.
type SyncPushResponse struct {
	Results []SyncPushResult `json:"results"`
}

// Push applies changes from a client device.
// POST /api/sync/push
func (h *SyncHandler) Push(w http.ResponseWriter, r *http.Request) {
	_ = r.Context().Value(mw.UserIDKey) // verify auth context exists

	var req SyncPushRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}

	if req.DeviceID == "" {
		writeError(w, http.StatusBadRequest, "device_id is required", "VALIDATION")
		return
	}

	results := make([]SyncPushResult, 0, len(req.Changes))
	for _, change := range req.Changes {
		result := h.applyChange(change)
		results = append(results, result)
	}

	writeJSON(w, http.StatusOK, SyncPushResponse{Results: results})
}

func (h *SyncHandler) applyChange(change SyncChange) SyncPushResult {
	switch change.Entity {
	case "task":
		return h.applyTaskChange(change)
	case "project":
		return h.applyProjectChange(change)
	case "area":
		return h.applyAreaChange(change)
	case "tag":
		return h.applyTagChange(change)
	case "schedule":
		return h.applyScheduleChange(change)
	case "checklistItem":
		return h.applyChecklistChange(change)
	case "attachment":
		return h.applyAttachmentChange(change)
	case "reminder":
		return h.applyReminderChange(change)
	case "heading":
		return h.applyHeadingChange(change)
	default:
		return SyncPushResult{
			Entity:   change.Entity,
			EntityID: change.EntityID,
			Status:   "error",
			Error:    "unsupported entity type: " + change.Entity,
		}
	}
}

// --- Task change application ---

func (h *SyncHandler) applyTaskChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "task", EntityID: change.EntityID}

	switch change.Action {
	case "create":
		// Check if task already exists (idempotency — client may re-push)
		existing, _ := h.tasks.GetByID(change.EntityID)
		if existing != nil {
			result.Status = "applied"
			return result
		}

		input := model.CreateTaskInput{
			ID:    change.EntityID, // use client-provided ID
			Title: stringFromData(change.Data, "title"),
			Notes: stringFromData(change.Data, "notes"),
		}
		if v, ok := change.Data["when_date"]; ok && v != nil {
			s := v.(string)
			input.WhenDate = &s
		}
		if v, ok := change.Data["high_priority"]; ok {
			if b, ok := v.(bool); ok {
				input.HighPriority = b
			}
		}
		if v, ok := change.Data["deadline"]; ok && v != nil {
			s := v.(string)
			input.Deadline = &s
		}
		if v, ok := change.Data["project_id"]; ok && v != nil {
			s := v.(string)
			input.ProjectID = &s
		}
		if v, ok := change.Data["area_id"]; ok && v != nil {
			s := v.(string)
			input.AreaID = &s
		}
		if v, ok := change.Data["heading_id"]; ok && v != nil {
			s := v.(string)
			input.HeadingID = &s
		}
		if v, ok := change.Data["tag_ids"]; ok && v != nil {
			if arr, ok := v.([]interface{}); ok {
				for _, item := range arr {
					if s, ok := item.(string); ok {
						input.TagIDs = append(input.TagIDs, s)
					}
				}
			}
		}

		task, err := h.tasks.Create(input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		_ = task
		result.Status = "applied"

	case "update":
		existing, err := h.tasks.GetByID(change.EntityID)
		if err != nil || existing == nil {
			result.Status = "error"
			result.Error = "task not found"
			return result
		}

		// LWW: compare client_updated_at vs server updated_at
		status := "applied"
		clientTime, err := time.Parse(time.RFC3339, change.ClientUpdatedAt)
		if err != nil {
			// Try alternate format (SQLite datetime)
			clientTime, err = time.Parse("2006-01-02 15:04:05", change.ClientUpdatedAt)
			if err != nil {
				result.Status = "error"
				result.Error = "invalid client_updated_at format"
				return result
			}
		}

		serverTime, err := time.Parse("2006-01-02 15:04:05", existing.UpdatedAt)
		if err != nil {
			serverTime, _ = time.Parse(time.RFC3339, existing.UpdatedAt)
		}

		// If server is strictly newer, it's a conflict resolution
		if serverTime.After(clientTime) {
			status = "conflict_resolved"
		}

		// Build update input only for specified fields
		input := model.UpdateTaskInput{
			Raw: make(map[string]json.RawMessage),
		}
		for _, field := range change.Fields {
			val := change.Data[field]
			rawVal, _ := json.Marshal(val)
			input.Raw[field] = rawVal

			switch field {
			case "title":
				s := stringFromData(change.Data, "title")
				input.Title = &s
			case "notes":
				s := stringFromData(change.Data, "notes")
				input.Notes = &s
			case "when_date":
				if val != nil {
					s := val.(string)
					input.WhenDate = &s
				}
			case "high_priority":
				if b, ok := val.(bool); ok {
					input.HighPriority = &b
				}
			case "deadline":
				if val != nil {
					s := val.(string)
					input.Deadline = &s
				}
			case "project_id":
				if val != nil {
					s := val.(string)
					input.ProjectID = &s
				}
			case "area_id":
				if val != nil {
					s := val.(string)
					input.AreaID = &s
				}
			case "heading_id":
				if val != nil {
					s := val.(string)
					input.HeadingID = &s
				}
			case "tag_ids":
				if val != nil {
					if arr, ok := val.([]interface{}); ok {
						tagIDs := make([]string, 0, len(arr))
						for _, item := range arr {
							if s, ok := item.(string); ok {
								tagIDs = append(tagIDs, s)
							}
						}
						input.TagIDs = tagIDs
					}
				} else {
					// Explicit null → clear all tags
					input.TagIDs = []string{}
				}
			case "status":
				if s, ok := val.(string); ok {
					switch s {
					case "completed":
						h.cleanupSchedules(change.EntityID)
						if _, cErr := h.tasks.Complete(change.EntityID); cErr != nil {
							result.Status = "error"
							result.Error = cErr.Error()
							return result
						}
						if h.scheduler != nil {
							h.scheduler.HandleTaskDone(change.EntityID)
						}
						result.Status = status
						return result
					case "canceled":
						h.cleanupSchedules(change.EntityID)
						if _, cErr := h.tasks.Cancel(change.EntityID); cErr != nil {
							result.Status = "error"
							result.Error = cErr.Error()
							return result
						}
						if h.scheduler != nil {
							h.scheduler.HandleTaskDone(change.EntityID)
						}
						result.Status = status
						return result
					case "open":
						if _, cErr := h.tasks.Reopen(change.EntityID); cErr != nil {
							result.Status = "error"
							result.Error = cErr.Error()
							return result
						}
						result.Status = status
						return result
					case "wont_do":
						h.cleanupSchedules(change.EntityID)
						if _, cErr := h.tasks.WontDo(change.EntityID); cErr != nil {
							result.Status = "error"
							result.Error = cErr.Error()
							return result
						}
						if h.scheduler != nil {
							h.scheduler.HandleTaskDone(change.EntityID)
						}
						result.Status = status
						return result
					}
				}
			case "deleted_at":
				if val != nil {
					// Soft-delete
					if cErr := h.tasks.Delete(change.EntityID); cErr != nil {
						result.Status = "error"
						result.Error = cErr.Error()
						return result
					}
					result.Status = status
					return result
				}
				// Restore (deleted_at = null)
				if _, cErr := h.tasks.Restore(change.EntityID); cErr != nil {
					result.Status = "error"
					result.Error = cErr.Error()
					return result
				}
				result.Status = status
				return result
			}
		}

		if len(input.Raw) > 0 {
			_, err = h.tasks.Update(change.EntityID, input)
			if err != nil {
				result.Status = "error"
				result.Error = err.Error()
				return result
			}
		}
		result.Status = status

	case "delete":
		err := h.tasks.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}

	return result
}

// --- Project change application ---

func (h *SyncHandler) applyProjectChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "project", EntityID: change.EntityID}

	switch change.Action {
	case "create":
		input := model.CreateProjectInput{
			Title: stringFromData(change.Data, "title"),
			Notes: stringFromData(change.Data, "notes"),
		}
		if v, ok := change.Data["area_id"]; ok && v != nil {
			s := v.(string)
			input.AreaID = &s
		}
		if v, ok := change.Data["when_date"]; ok && v != nil {
			s := v.(string)
			input.WhenDate = &s
		}
		if v, ok := change.Data["deadline"]; ok && v != nil {
			s := v.(string)
			input.Deadline = &s
		}

		_, err := h.projects.Create(input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "update":
		existing, err := h.projects.GetByID(change.EntityID)
		if err != nil || existing == nil {
			result.Status = "error"
			result.Error = "project not found"
			return result
		}

		status := "applied"
		clientTime, serverTime := parseTimes(change.ClientUpdatedAt, existing.UpdatedAt)
		if serverTime.After(clientTime) {
			status = "conflict_resolved"
		}

		input := model.UpdateProjectInput{
			Raw: make(map[string]json.RawMessage),
		}
		for _, field := range change.Fields {
			val := change.Data[field]
			rawVal, _ := json.Marshal(val)
			input.Raw[field] = rawVal

			switch field {
			case "title":
				s := stringFromData(change.Data, "title")
				input.Title = &s
			case "notes":
				s := stringFromData(change.Data, "notes")
				input.Notes = &s
			case "area_id":
				if val != nil {
					s := val.(string)
					input.AreaID = &s
				}
			case "status":
				if val != nil {
					s := val.(string)
					input.Status = &s
				}
			case "when_date":
				if val != nil {
					s := val.(string)
					input.WhenDate = &s
				}
			case "deadline":
				if val != nil {
					s := val.(string)
					input.Deadline = &s
				}
			}
		}

		if len(input.Raw) > 0 {
			_, err = h.projects.Update(change.EntityID, input)
			if err != nil {
				result.Status = "error"
				result.Error = err.Error()
				return result
			}
		}
		result.Status = status

	case "delete":
		err := h.projects.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}

	return result
}

// --- Area change application ---

func (h *SyncHandler) applyAreaChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "area", EntityID: change.EntityID}

	switch change.Action {
	case "create":
		input := model.CreateAreaInput{
			Title: stringFromData(change.Data, "title"),
		}
		_, err := h.areas.Create(input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "update":
		existing, err := h.areas.GetByID(change.EntityID)
		if err != nil || existing == nil {
			result.Status = "error"
			result.Error = "area not found"
			return result
		}

		status := "applied"
		clientTime, serverTime := parseTimes(change.ClientUpdatedAt, existing.UpdatedAt)
		if serverTime.After(clientTime) {
			status = "conflict_resolved"
		}

		input := model.UpdateAreaInput{}
		for _, field := range change.Fields {
			val := change.Data[field]
			switch field {
			case "title":
				s := stringFromData(change.Data, "title")
				input.Title = &s
			case "sort_order":
				if f, ok := val.(float64); ok {
					input.SortOrder = &f
				}
			}
		}

		_, err = h.areas.Update(change.EntityID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = status

	case "delete":
		err := h.areas.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}

	return result
}

// --- Tag change application ---

func (h *SyncHandler) applyTagChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "tag", EntityID: change.EntityID}

	switch change.Action {
	case "create":
		input := model.CreateTagInput{
			Title: stringFromData(change.Data, "title"),
		}
		if v, ok := change.Data["parent_tag_id"]; ok && v != nil {
			s := v.(string)
			input.ParentTagID = &s
		}
		_, err := h.tags.Create(input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "update":
		// Tags don't have an updated_at for LWW comparison in the repo,
		// so we apply directly (last write wins by default).
		input := model.UpdateTagInput{
			Raw: make(map[string]json.RawMessage),
		}
		for _, field := range change.Fields {
			val := change.Data[field]
			rawVal, _ := json.Marshal(val)
			input.Raw[field] = rawVal

			switch field {
			case "title":
				s := stringFromData(change.Data, "title")
				input.Title = &s
			case "color":
				if val != nil {
					s := val.(string)
					input.Color = &s
				}
			case "parent_tag_id":
				if val != nil {
					s := val.(string)
					input.ParentTagID = &s
				}
			case "sort_order":
				if f, ok := val.(float64); ok {
					input.SortOrder = &f
				}
			}
		}

		_, err := h.tags.Update(change.EntityID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "delete":
		err := h.tags.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}

	return result
}

// --- Schedule change application ---

func (h *SyncHandler) applyScheduleChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "schedule", EntityID: change.EntityID}
	taskID := stringFromData(change.Data, "task_id")

	switch change.Action {
	case "create":
		if taskID == "" {
			result.Status = "error"
			result.Error = "task_id is required"
			return result
		}
		input := model.CreateTaskScheduleInput{
			ID:       change.EntityID,
			WhenDate: stringFromData(change.Data, "when_date"),
		}
		if v, ok := change.Data["start_time"]; ok && v != nil {
			s := v.(string)
			input.StartTime = &s
		}
		if v, ok := change.Data["end_time"]; ok && v != nil {
			s := v.(string)
			input.EndTime = &s
		}
		_, err := h.schedules.Create(taskID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "update":
		input := model.UpdateTaskScheduleInput{
			Raw: make(map[string]json.RawMessage),
		}
		for _, field := range change.Fields {
			val := change.Data[field]
			rawVal, _ := json.Marshal(val)
			input.Raw[field] = rawVal
			switch field {
			case "when_date":
				if val != nil {
					s := val.(string)
					input.WhenDate = &s
				}
			case "start_time":
				if val != nil {
					s := val.(string)
					input.StartTime = &s
				}
			case "end_time":
				if val != nil {
					s := val.(string)
					input.EndTime = &s
				}
			case "completed":
				if b, ok := val.(bool); ok {
					input.Completed = &b
				}
			case "sort_order":
				if f, ok := val.(float64); ok {
					input.SortOrder = &f
				}
			}
		}
		_, err := h.schedules.Update(change.EntityID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "delete":
		err := h.schedules.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}
	return result
}

// --- Checklist change application ---

func (h *SyncHandler) applyChecklistChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "checklistItem", EntityID: change.EntityID}
	taskID := stringFromData(change.Data, "task_id")

	switch change.Action {
	case "create":
		if taskID == "" {
			result.Status = "error"
			result.Error = "task_id is required"
			return result
		}
		input := model.CreateChecklistInput{
			ID:    change.EntityID,
			Title: stringFromData(change.Data, "title"),
		}
		_, err := h.checklist.Create(taskID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "update":
		input := model.UpdateChecklistInput{}
		for _, field := range change.Fields {
			val := change.Data[field]
			switch field {
			case "title":
				s := stringFromData(change.Data, "title")
				input.Title = &s
			case "completed":
				if b, ok := val.(bool); ok {
					input.Completed = &b
				}
			case "sort_order":
				if f, ok := val.(float64); ok {
					input.SortOrder = &f
				}
			}
		}
		_, err := h.checklist.Update(change.EntityID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "delete":
		err := h.checklist.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}
	return result
}

// --- Attachment change application ---

func (h *SyncHandler) applyAttachmentChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "attachment", EntityID: change.EntityID}
	taskID := stringFromData(change.Data, "task_id")

	switch change.Action {
	case "create":
		if taskID == "" {
			result.Status = "error"
			result.Error = "task_id is required"
			return result
		}
		input := model.CreateAttachmentInput{
			ID:       change.EntityID,
			Type:     stringFromData(change.Data, "type"),
			Title:    stringFromData(change.Data, "title"),
			URL:      stringFromData(change.Data, "url"),
			MimeType: stringFromData(change.Data, "mime_type"),
		}
		if v, ok := change.Data["file_size"]; ok {
			if f, ok := v.(float64); ok {
				input.FileSize = int64(f)
			}
		}
		_, err := h.attachments.Create(taskID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "delete":
		err := h.attachments.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}
	return result
}

// --- Reminder change application ---

func (h *SyncHandler) applyReminderChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "reminder", EntityID: change.EntityID}
	taskID := stringFromData(change.Data, "task_id")

	switch change.Action {
	case "create":
		if taskID == "" {
			result.Status = "error"
			result.Error = "task_id is required"
			return result
		}
		input := model.CreateReminderInput{
			ID:    change.EntityID,
			Type:  model.ReminderType(stringFromData(change.Data, "type")),
			Value: int(floatFromData(change.Data, "value")),
		}
		if v, ok := change.Data["exact_at"]; ok && v != nil {
			s := v.(string)
			input.ExactAt = &s
		}
		_, err := h.reminders.Create(taskID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "delete":
		err := h.reminders.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}
	return result
}

// --- Heading change application ---

func (h *SyncHandler) applyHeadingChange(change SyncChange) SyncPushResult {
	result := SyncPushResult{Entity: "heading", EntityID: change.EntityID}
	projectID := stringFromData(change.Data, "project_id")

	switch change.Action {
	case "create":
		if projectID == "" {
			result.Status = "error"
			result.Error = "project_id is required"
			return result
		}
		input := model.CreateHeadingInput{
			ID:    change.EntityID,
			Title: stringFromData(change.Data, "title"),
		}
		_, err := h.headings.Create(projectID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "update":
		input := model.UpdateHeadingInput{}
		for _, field := range change.Fields {
			val := change.Data[field]
			switch field {
			case "title":
				s := stringFromData(change.Data, "title")
				input.Title = &s
			case "sort_order":
				if f, ok := val.(float64); ok {
					input.SortOrder = &f
				}
			}
		}
		_, err := h.headings.Update(change.EntityID, input)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	case "delete":
		err := h.headings.Delete(change.EntityID)
		if err != nil {
			result.Status = "error"
			result.Error = err.Error()
			return result
		}
		result.Status = "applied"

	default:
		result.Status = "error"
		result.Error = "unsupported action: " + change.Action
	}
	return result
}

// --- Helpers ---

func stringFromData(data map[string]interface{}, key string) string {
	if v, ok := data[key]; ok && v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func floatFromData(data map[string]interface{}, key string) float64 {
	if v, ok := data[key]; ok && v != nil {
		if f, ok := v.(float64); ok {
			return f
		}
	}
	return 0
}

func parseTimes(clientUpdatedAt, serverUpdatedAt string) (time.Time, time.Time) {
	clientTime, err := time.Parse(time.RFC3339, clientUpdatedAt)
	if err != nil {
		clientTime, _ = time.Parse("2006-01-02 15:04:05", clientUpdatedAt)
	}
	serverTime, err := time.Parse("2006-01-02 15:04:05", serverUpdatedAt)
	if err != nil {
		serverTime, _ = time.Parse(time.RFC3339, serverUpdatedAt)
	}
	return clientTime, serverTime
}

// cleanupSchedules completes past uncompleted schedule entries and deletes
// today + future entries when a task is completed/canceled/wontdo.
func (h *SyncHandler) cleanupSchedules(taskID string) {
	today := time.Now().Format("2006-01-02")
	if err := h.schedules.CleanupOnTaskDone(taskID, today); err != nil {
		log.Printf("schedule cleanup for task %s: %v", taskID, err)
	}
}
