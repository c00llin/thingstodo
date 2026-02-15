package handler

import (
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/repository"
)

type SearchHandler struct {
	repo *repository.SearchRepository
}

func NewSearchHandler(repo *repository.SearchRepository) *SearchHandler {
	return &SearchHandler{repo: repo}
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeError(w, http.StatusBadRequest, "q parameter is required", "VALIDATION")
		return
	}
	limit := repository.ParseIntDefault(r.URL.Query().Get("limit"), 20)

	results, err := h.repo.Search(q, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"results": results})
}
