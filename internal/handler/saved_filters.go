package handler

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	mw "github.com/collinjanssen/thingstodo/internal/middleware"
	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
)

var validViews = map[string]bool{
	"today": true, "upcoming": true, "anytime": true,
	"someday": true, "logbook": true,
}

type SavedFilterHandler struct {
	repo   *repository.SavedFilterRepository
	broker *sse.Broker
}

func NewSavedFilterHandler(repo *repository.SavedFilterRepository, broker *sse.Broker) *SavedFilterHandler {
	return &SavedFilterHandler{repo: repo, broker: broker}
}

// List handles GET /api/saved-filters?view=today
func (h *SavedFilterHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(mw.UserIDKey).(string)
	if !ok || userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "UNAUTHORIZED")
		return
	}
	view := r.URL.Query().Get("view")
	if view == "" {
		writeError(w, http.StatusBadRequest, "view query param is required", "BAD_REQUEST")
		return
	}
	filters, err := h.repo.List(userID, view)
	if err != nil {
		log.Printf("ERROR saved_filters.List userID=%s view=%s: %v", userID, view, err)
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"saved_filters": filters})
}

// Create handles POST /api/saved-filters
func (h *SavedFilterHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(mw.UserIDKey).(string)
	if !ok || userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "UNAUTHORIZED")
		return
	}
	var input model.CreateSavedFilterInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.View == "" || input.Name == "" || input.Config == "" {
		writeError(w, http.StatusBadRequest, "view, name, and config are required", "VALIDATION")
		return
	}
	if !validViews[input.View] {
		writeError(w, http.StatusBadRequest, "invalid view", "VALIDATION")
		return
	}
	f, err := h.repo.Create(userID, input)
	if err != nil {
		if errors.Is(err, repository.ErrSavedFilterLimitReached) {
			writeError(w, http.StatusUnprocessableEntity, "maximum 10 saved filters per view", "LIMIT_REACHED")
			return
		}
		log.Printf("ERROR saved_filters.Create userID=%s: %v", userID, err)
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("saved_filter_changed", map[string]interface{}{"view": f.View})
	writeJSON(w, http.StatusCreated, f)
}

// Delete handles DELETE /api/saved-filters/{id}
func (h *SavedFilterHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(mw.UserIDKey).(string)
	if !ok || userID == "" {
		writeError(w, http.StatusUnauthorized, "unauthorized", "UNAUTHORIZED")
		return
	}
	id := chi.URLParam(r, "id")

	// Fetch the view before deleting so we can broadcast the correct SSE event
	view, err := h.repo.GetView(userID, id)
	if err != nil {
		log.Printf("WARN saved_filters.Delete could not fetch view for id=%s: %v", id, err)
	}

	if err := h.repo.Delete(userID, id); err != nil {
		if strings.Contains(err.Error(), "saved filter not found") {
			writeError(w, http.StatusNotFound, "saved filter not found", "NOT_FOUND")
		} else {
			log.Printf("ERROR saved_filters.Delete userID=%s id=%s: %v", userID, id, err)
			writeError(w, http.StatusInternalServerError, "internal error", "INTERNAL")
		}
		return
	}
	if view != "" {
		h.broker.BroadcastJSON("saved_filter_changed", map[string]interface{}{"view": view})
	}
	w.WriteHeader(http.StatusNoContent)
}
