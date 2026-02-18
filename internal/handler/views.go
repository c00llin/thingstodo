package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/repository"
)

type ViewHandler struct {
	repo *repository.ViewRepository
}

func NewViewHandler(repo *repository.ViewRepository) *ViewHandler {
	return &ViewHandler{repo: repo}
}

func (h *ViewHandler) Inbox(w http.ResponseWriter, r *http.Request) {
	tasks, err := h.repo.Inbox()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"tasks": tasks})
}

func (h *ViewHandler) Today(w http.ResponseWriter, r *http.Request) {
	view, err := h.repo.Today()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Upcoming(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from := q.Get("from")
	days := repository.ParseIntDefault(q.Get("days"), 30)
	view, err := h.repo.Upcoming(from, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Anytime(w http.ResponseWriter, r *http.Request) {
	view, err := h.repo.Anytime()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Someday(w http.ResponseWriter, r *http.Request) {
	view, err := h.repo.Someday()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Logbook(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := repository.ParseIntDefault(q.Get("limit"), 50)
	offset := repository.ParseIntDefault(q.Get("offset"), 0)
	view, err := h.repo.Logbook(limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Trash(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := repository.ParseIntDefault(q.Get("limit"), 50)
	offset := repository.ParseIntDefault(q.Get("offset"), 0)
	view, err := h.repo.Trash(limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Counts(w http.ResponseWriter, r *http.Request) {
	counts, err := h.repo.Counts()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, counts)
}
