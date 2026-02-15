package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type HeadingHandler struct {
	repo   *repository.HeadingRepository
	broker *sse.Broker
}

func NewHeadingHandler(repo *repository.HeadingRepository, broker *sse.Broker) *HeadingHandler {
	return &HeadingHandler{repo: repo, broker: broker}
}

func (h *HeadingHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	headings, err := h.repo.ListByProject(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"headings": headings})
}

func (h *HeadingHandler) Create(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	var input model.CreateHeadingInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required", "VALIDATION")
		return
	}
	heading, err := h.repo.Create(projectID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("project_updated", map[string]interface{}{"id": projectID})
	writeJSON(w, http.StatusCreated, heading)
}

func (h *HeadingHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateHeadingInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	heading, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if heading == nil {
		writeError(w, http.StatusNotFound, "heading not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("project_updated", map[string]interface{}{"id": heading.ProjectID})
	writeJSON(w, http.StatusOK, heading)
}

func (h *HeadingHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []model.SimpleReorderItem `json:"items"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if err := h.repo.Reorder(body.Items); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	ids := make([]string, len(body.Items))
	for i, item := range body.Items {
		ids[i] = item.ID
	}
	h.broker.BroadcastJSON("bulk_change", map[string]interface{}{
		"type": "reorder", "entity": "heading", "ids": ids,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *HeadingHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
