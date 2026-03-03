package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type ReminderHandler struct {
	repo   *repository.ReminderRepository
	broker *sse.Broker
}

func NewReminderHandler(repo *repository.ReminderRepository, broker *sse.Broker) *ReminderHandler {
	return &ReminderHandler{repo: repo, broker: broker}
}

func (h *ReminderHandler) List(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	items, err := h.repo.ListByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *ReminderHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var input model.CreateReminderInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	switch input.Type {
	case model.ReminderAtStart, model.ReminderOnDay, model.ReminderMinutesBefore,
		model.ReminderHoursBefore, model.ReminderDaysBefore, model.ReminderExact:
		// valid
	default:
		writeError(w, http.StatusBadRequest, "invalid reminder type", "VALIDATION")
		return
	}
	if input.Type == model.ReminderExact && input.ExactAt == nil {
		writeError(w, http.StatusBadRequest, "exact_at is required for exact type", "VALIDATION")
		return
	}
	item, err := h.repo.Create(taskID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	writeJSON(w, http.StatusCreated, item)
}

func (h *ReminderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	taskID, err := h.repo.GetTaskIDForReminder(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if taskID != "" {
		h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	}
	w.WriteHeader(http.StatusNoContent)
}
