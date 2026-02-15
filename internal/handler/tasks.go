package handler

import (
	"net/http"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type TaskHandler struct {
	repo   *repository.TaskRepository
	broker *sse.Broker
}

func NewTaskHandler(repo *repository.TaskRepository, broker *sse.Broker) *TaskHandler {
	return &TaskHandler{repo: repo, broker: broker}
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := model.TaskFilters{}

	if v := q.Get("status"); v != "" {
		f.Status = &v
	}
	if v := q.Get("project_id"); v != "" {
		f.ProjectID = &v
	}
	if v := q.Get("area_id"); v != "" {
		f.AreaID = &v
	}
	if v := q.Get("heading_id"); v != "" {
		f.HeadingID = &v
	}
	if v := q.Get("tag_ids"); v != "" {
		f.TagIDs = strings.Split(v, ",")
	}
	if v := q.Get("when_date"); v != "" {
		f.WhenDate = &v
	}
	if v := q.Get("when_before"); v != "" {
		f.WhenBefore = &v
	}
	if v := q.Get("when_after"); v != "" {
		f.WhenAfter = &v
	}
	if v := q.Get("has_deadline"); v != "" {
		b := v == "true"
		f.HasDeadline = &b
	}
	if v := q.Get("is_evening"); v != "" {
		b := v == "true"
		f.IsEvening = &b
	}
	if v := q.Get("search"); v != "" {
		f.Search = &v
	}

	tasks, err := h.repo.List(f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"tasks": tasks})
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	task, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input model.CreateTaskInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required", "VALIDATION")
		return
	}
	task, err := h.repo.Create(input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("task_created", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusCreated, task)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateTaskInput
	raw, err := decodeJSONWithRaw(r, &input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	input.Raw = raw

	task, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.Delete(id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("task_deleted", map[string]interface{}{"id": id})
	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskHandler) Complete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	task, err := h.repo.Complete(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	task, err := h.repo.Cancel(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) WontDo(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	task, err := h.repo.WontDo(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Reopen(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	task, err := h.repo.Reopen(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Move(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.MoveTaskInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	task, err := h.repo.Move(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found", "NOT_FOUND")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": task.ID, "task": task})
	writeJSON(w, http.StatusOK, task)
}

func (h *TaskHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []model.ReorderItem `json:"items"`
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
		"type": "reorder", "entity": "task", "ids": ids,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
