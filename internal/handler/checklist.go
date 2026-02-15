package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type ChecklistHandler struct {
	repo   *repository.ChecklistRepository
	broker *sse.Broker
}

func NewChecklistHandler(repo *repository.ChecklistRepository, broker *sse.Broker) *ChecklistHandler {
	return &ChecklistHandler{repo: repo, broker: broker}
}

func (h *ChecklistHandler) List(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	items, err := h.repo.ListByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items})
}

func (h *ChecklistHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var input model.CreateChecklistInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required", "VALIDATION")
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

func (h *ChecklistHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateChecklistInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	item, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if item == nil {
		writeError(w, http.StatusNotFound, "checklist item not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": id})
	writeJSON(w, http.StatusOK, item)
}

func (h *ChecklistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
