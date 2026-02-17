package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type AttachmentHandler struct {
	repo            *repository.AttachmentRepository
	broker          *sse.Broker
	attachmentsPath string
	maxUploadSize   int64
}

func NewAttachmentHandler(repo *repository.AttachmentRepository, broker *sse.Broker, attachmentsPath string, maxUploadSize int64) *AttachmentHandler {
	return &AttachmentHandler{
		repo:            repo,
		broker:          broker,
		attachmentsPath: attachmentsPath,
		maxUploadSize:   maxUploadSize,
	}
}

func (h *AttachmentHandler) List(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	items, err := h.repo.ListByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"attachments": items})
}

func (h *AttachmentHandler) Create(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")

	contentType := r.Header.Get("Content-Type")
	if len(contentType) >= 19 && contentType[:19] == "multipart/form-data" {
		h.createFile(w, r, taskID)
		return
	}

	// JSON link attachment
	var input model.CreateAttachmentInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if input.Type == "" {
		input.Type = "link"
	}
	if input.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required", "VALIDATION")
		return
	}
	att, err := h.repo.Create(taskID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	writeJSON(w, http.StatusCreated, att)
}

func (h *AttachmentHandler) createFile(w http.ResponseWriter, r *http.Request, taskID string) {
	r.Body = http.MaxBytesReader(w, r.Body, h.maxUploadSize)
	if err := r.ParseMultipartForm(h.maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "file too large", "FILE_TOO_LARGE")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file field required", "BAD_REQUEST")
		return
	}
	defer file.Close()

	// Generate unique filename
	fileID := model.NewID()
	ext := filepath.Ext(header.Filename)
	storedName := fileID + ext
	storedPath := filepath.Join(h.attachmentsPath, storedName)

	if err := os.MkdirAll(h.attachmentsPath, 0o755); err != nil {
		writeError(w, http.StatusInternalServerError, "cannot create attachments dir", "INTERNAL")
		return
	}

	dst, err := os.Create(storedPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cannot save file", "INTERNAL")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cannot write file", "INTERNAL")
		return
	}

	input := model.CreateAttachmentInput{
		Type:     "file",
		Title:    header.Filename,
		URL:      storedName,
		MimeType: header.Header.Get("Content-Type"),
		FileSize: written,
	}

	att, err := h.repo.Create(taskID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	writeJSON(w, http.StatusCreated, att)
}

func (h *AttachmentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input model.UpdateAttachmentInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	att, err := h.repo.Update(id, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if att == nil {
		writeError(w, http.StatusNotFound, "attachment not found", "NOT_FOUND")
		return
	}
	writeJSON(w, http.StatusOK, att)
}

func (h *AttachmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	// Get attachment to find file path before deleting
	att, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	if att != nil && att.Type == "file" {
		// Delete all attachment rows sharing this file, then remove the file from disk
		if err := h.repo.DeleteByURL(att.URL); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
			return
		}
		os.Remove(filepath.Join(h.attachmentsPath, att.URL))
	} else {
		if err := h.repo.Delete(id); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *AttachmentHandler) Download(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	att, err := h.repo.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	if att == nil {
		writeError(w, http.StatusNotFound, "attachment not found", "NOT_FOUND")
		return
	}
	if att.Type != "file" {
		writeError(w, http.StatusBadRequest, "not a file attachment", "BAD_REQUEST")
		return
	}

	filePath := filepath.Join(h.attachmentsPath, att.URL)
	f, err := os.Open(filePath)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found on disk", "NOT_FOUND")
		return
	}
	defer f.Close()

	if att.MimeType != "" {
		w.Header().Set("Content-Type", att.MimeType)
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, att.Title))
	_, _ = io.Copy(w, f)
}
