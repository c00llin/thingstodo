package handler

import (
	"log"
	"net/http"

	mw "github.com/collinjanssen/thingstodo/internal/middleware"
	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
)

type UserSettingsHandler struct {
	repo *repository.UserSettingsRepository
}

func NewUserSettingsHandler(repo *repository.UserSettingsRepository) *UserSettingsHandler {
	return &UserSettingsHandler{repo: repo}
}

func (h *UserSettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(mw.UserIDKey).(string)
	settings, err := h.repo.GetOrCreate(userID)
	if err != nil {
		log.Printf("ERROR user_settings.Get userID=%s: %v", userID, err)
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *UserSettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(mw.UserIDKey).(string)
	var input model.UpdateUserSettingsInput
	raw, err := decodeJSONWithRaw(r, &input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	input.Raw = raw
	settings, err := h.repo.Update(userID, input)
	if err != nil {
		log.Printf("ERROR user_settings.Update userID=%s: %v", userID, err)
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}
