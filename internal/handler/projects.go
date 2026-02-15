package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type ProjectHandler struct {
	repo   *repository.ProjectRepository
	broker *sse.Broker
}

func NewProjectHandler(repo *repository.ProjectRepository, broker *sse.Broker) *ProjectHandler {
	return &ProjectHandler{repo: repo, broker: broker}
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var areaID, status *string
	if v := q.Get("area_id"); v != "" {
		areaID = &v
	}
	if v := q.Get("status"); v != "" {
		status = &v
	}
	projects, err := h.repo.List(areaID, status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"projects": projects})
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	project, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.CreateProjectInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required", "VALIDATION")
		return
	}
	project, err := h.repo.Create(input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("project_updated", map[string]interface{}{"id": project.ID, "project": project})
	writeJSON(w, http.StatusCreated, project)
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateProjectInput
	raw, err := decodeJSONWithRaw(r, &input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	input.Raw = raw

	project, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("project_updated", map[string]interface{}{"id": project.ID, "project": project})
	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("bulk_change", map[string]interface{}{
		"type": "delete", "entity": "project", "ids": []string{id},
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectHandler) Reorder(w http.ResponseWriter, r *http.Request) {
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
		"type": "reorder", "entity": "project", "ids": ids,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *ProjectHandler) Complete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	project, err := h.repo.Complete(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("project_updated", map[string]interface{}{"id": project.ID, "project": project})
	writeJSON(w, http.StatusOK, project)
}
