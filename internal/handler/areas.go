package handler

import (
	"errors"
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type AreaHandler struct {
	repo   *repository.AreaRepository
	broker *sse.Broker
}

func NewAreaHandler(repo *repository.AreaRepository, broker *sse.Broker) *AreaHandler {
	return &AreaHandler{repo: repo, broker: broker}
}

func (h *AreaHandler) List(w http.ResponseWriter, r *http.Request) {
	areas, err := h.repo.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"areas": areas})
}

func (h *AreaHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	area, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if area == nil {
		writeError(w, http.StatusNotFound, "area not found", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, area)
}

func (h *AreaHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.CreateAreaInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required", "VALIDATION")
		return
	}
	area, err := h.repo.Create(input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("area_updated", map[string]interface{}{"id": area.ID, "area": area})
	writeJSON(w, http.StatusCreated, area)
}

func (h *AreaHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateAreaInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	area, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if area == nil {
		writeError(w, http.StatusNotFound, "area not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("area_updated", map[string]interface{}{"id": area.ID, "area": area})
	writeJSON(w, http.StatusOK, area)
}

func (h *AreaHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.DeleteWithTasks(id); err != nil {
		if errors.Is(err, repository.ErrAreaHasProjects) {
			writeError(w, http.StatusConflict, "area still has projects", "HAS_PROJECTS")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("bulk_change", map[string]interface{}{
		"type": "delete", "entity": "area", "ids": []string{id},
	})
	w.WriteHeader(http.StatusNoContent)
}
