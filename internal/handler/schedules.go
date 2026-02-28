package handler

import (
	"log"
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type ScheduleHandler struct {
	repo   *repository.ScheduleRepository
	broker *sse.Broker
}

func NewScheduleHandler(repo *repository.ScheduleRepository, broker *sse.Broker) *ScheduleHandler {
	return &ScheduleHandler{repo: repo, broker: broker}
}

func (h *ScheduleHandler) List(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	items, err := h.repo.ListByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *ScheduleHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var input model.CreateTaskScheduleInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.WhenDate == "" {
		writeError(w, http.StatusBadRequest, "when_date is required", "VALIDATION")
		return
	}

	// Validate max 12 entries
	count, err := h.repo.CountByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if count >= 12 {
		writeError(w, http.StatusBadRequest, "maximum 12 schedule entries per task", "VALIDATION")
		return
	}

	// Non-first entries cannot be 'someday'
	if count > 0 && input.WhenDate == "someday" {
		writeError(w, http.StatusBadRequest, "only the first schedule entry can be 'someday'", "VALIDATION")
		return
	}

	// start_time requires end_time
	if input.StartTime != nil && input.EndTime == nil {
		writeError(w, http.StatusBadRequest, "end_time is required when start_time is set", "VALIDATION")
		return
	}

	// Block duplicate timeless dates
	if input.StartTime == nil && input.WhenDate != "someday" {
		dup, err := h.repo.HasDuplicateTimelessDate(taskID, input.WhenDate, "")
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
			return
		}
		if dup {
			writeError(w, http.StatusBadRequest, "a schedule for this date already exists without a time", "VALIDATION")
			return
		}
	}

	item, err := h.repo.Create(taskID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	if err := h.repo.SyncPrimary(taskID); err != nil {
		log.Printf("WARN schedules.Create syncPrimary: %v", err)
	}

	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	writeJSON(w, http.StatusCreated, item)
}

func (h *ScheduleHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateTaskScheduleInput
	raw, err := decodeJSONWithRaw(r, &input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	input.Raw = raw

	// Block duplicate timeless dates when changing date or clearing time
	if input.WhenDate != nil || input.Raw["start_time"] != nil {
		// Look up the current entry to determine the final state
		taskID, err := h.repo.GetTaskIDForSchedule(id)
		if err != nil {
			writeError(w, http.StatusNotFound, "schedule entry not found", "NOT_FOUND")
			return
		}
		// Determine what the date and start_time will be after this update
		var currentDate string
		var currentStartTime *string
		_ = h.repo.GetScheduleFields(id, &currentDate, &currentStartTime)
		finalDate := currentDate
		if input.WhenDate != nil {
			finalDate = *input.WhenDate
		}
		finalHasTime := currentStartTime != nil
		if _, ok := input.Raw["start_time"]; ok {
			finalHasTime = input.StartTime != nil
		}
		if !finalHasTime && finalDate != "someday" {
			dup, err := h.repo.HasDuplicateTimelessDate(taskID, finalDate, id)
			if err != nil {
				writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
				return
			}
			if dup {
				writeError(w, http.StatusBadRequest, "a schedule for this date already exists without a time", "VALIDATION")
				return
			}
		}
	}

	item, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if item == nil {
		writeError(w, http.StatusNotFound, "schedule entry not found", "NOT_FOUND")
		return
	}

	if err := h.repo.SyncPrimary(item.TaskID); err != nil {
		log.Printf("WARN schedules.Update syncPrimary: %v", err)
	}

	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": item.TaskID})
	writeJSON(w, http.StatusOK, item)
}

func (h *ScheduleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	taskID, err := h.repo.GetTaskIDForSchedule(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "schedule entry not found", "NOT_FOUND")
		return
	}

	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	if err := h.repo.SyncPrimary(taskID); err != nil {
		log.Printf("WARN schedules.Delete syncPrimary: %v", err)
	}

	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	w.WriteHeader(http.StatusNoContent)
}

func (h *ScheduleHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var items []model.SimpleReorderItem
	if err := decodeJSON(r, &items); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if err := h.repo.Reorder(items); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	if err := h.repo.SyncPrimary(taskID); err != nil {
		log.Printf("WARN schedules.Reorder syncPrimary: %v", err)
	}

	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	w.WriteHeader(http.StatusNoContent)
}
