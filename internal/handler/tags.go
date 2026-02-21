package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type TagHandler struct {
	repo   *repository.TagRepository
	broker *sse.Broker
}

func NewTagHandler(repo *repository.TagRepository, broker *sse.Broker) *TagHandler {
	return &TagHandler{repo: repo, broker: broker}
}

func (h *TagHandler) List(w http.ResponseWriter, r *http.Request) {
	tags, err := h.repo.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"tags": tags})
}

func (h *TagHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.CreateTagInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required", "VALIDATION")
		return
	}
	input.Title = strings.ToLower(input.Title)
	tag, err := h.repo.Create(input)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateTagName) {
			writeError(w, http.StatusConflict, "There is already a tag with that name", "DUPLICATE_NAME")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("tag_updated", map[string]interface{}{"id": tag.ID, "tag": tag})
	writeJSON(w, http.StatusCreated, tag)
}

func (h *TagHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateTagInput
	raw, err := decodeJSONWithRaw(r, &input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	input.Raw = raw
	if input.Title != nil {
		lower := strings.ToLower(*input.Title)
		input.Title = &lower
	}

	tag, err := h.repo.Update(id, input)
	if err != nil {
		if errors.Is(err, repository.ErrDuplicateTagName) {
			writeError(w, http.StatusConflict, "There is already a tag with that name", "DUPLICATE_NAME")
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if tag == nil {
		writeError(w, http.StatusNotFound, "tag not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("tag_updated", map[string]interface{}{"id": tag.ID, "tag": tag})
	writeJSON(w, http.StatusOK, tag)
}

func (h *TagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("bulk_change", map[string]interface{}{
		"type": "delete", "entity": "tag", "ids": []string{id},
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *TagHandler) GetTasks(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tasks, err := h.repo.GetTasksByTag(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"tasks": tasks})
}
