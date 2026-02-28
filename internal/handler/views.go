package handler

import (
	"log"
	"net/http"

	mw "github.com/collinjanssen/thingstodo/internal/middleware"
	"github.com/collinjanssen/thingstodo/internal/repository"
)

type ViewHandler struct {
	repo         *repository.ViewRepository
	settingsRepo *repository.UserSettingsRepository
}

func NewViewHandler(repo *repository.ViewRepository, settingsRepo *repository.UserSettingsRepository) *ViewHandler {
	return &ViewHandler{repo: repo, settingsRepo: settingsRepo}
}

func (h *ViewHandler) getReviewDays(r *http.Request) *int {
	userID, ok := r.Context().Value(mw.UserIDKey).(string)
	if !ok || userID == "" {
		return nil
	}
	settings, err := h.settingsRepo.GetOrCreate(userID)
	if err != nil {
		log.Printf("WARN views.getReviewDays: %v", err)
		return nil
	}
	return settings.ReviewAfterDays
}

func (h *ViewHandler) Inbox(w http.ResponseWriter, r *http.Request) {
	view, err := h.repo.Inbox(h.getReviewDays(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) getEveningStartsAt(r *http.Request) string {
	userID, ok := r.Context().Value(mw.UserIDKey).(string)
	if !ok || userID == "" {
		return "18:00"
	}
	settings, err := h.settingsRepo.GetOrCreate(userID)
	if err != nil {
		return "18:00"
	}
	return settings.EveningStartsAt
}

func (h *ViewHandler) Today(w http.ResponseWriter, r *http.Request) {
	view, err := h.repo.Today(h.getEveningStartsAt(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, view)
}

func (h *ViewHandler) Upcoming(w http.ResponseWriter, r *http.Request) {
	from := r.URL.Query().Get("from")
	view, err := h.repo.Upcoming(from)
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
	counts, err := h.repo.Counts(h.getReviewDays(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, counts)
}
