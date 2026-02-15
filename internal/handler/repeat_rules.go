package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type RepeatRuleHandler struct {
	repo   *repository.RepeatRuleRepository
	broker *sse.Broker
}

func NewRepeatRuleHandler(repo *repository.RepeatRuleRepository, broker *sse.Broker) *RepeatRuleHandler {
	return &RepeatRuleHandler{repo: repo, broker: broker}
}

func (h *RepeatRuleHandler) Get(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	rule, err := h.repo.GetByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"repeat_rule": rule})
}

func (h *RepeatRuleHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var input model.CreateRepeatRuleInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Frequency == "" || input.Mode == "" {
		writeError(w, http.StatusBadRequest, "frequency and mode are required", "VALIDATION")
		return
	}
	if input.IntervalValue <= 0 {
		input.IntervalValue = 1
	}

	rule, err := h.repo.Upsert(taskID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	writeJSON(w, http.StatusOK, rule)
}

func (h *RepeatRuleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	if err := h.repo.DeleteByTask(taskID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
