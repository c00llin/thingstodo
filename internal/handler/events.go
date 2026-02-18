package handler

import (
	"fmt"
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/sse"
)

type EventHandler struct {
	broker *sse.Broker
}

func NewEventHandler(broker *sse.Broker) *EventHandler {
	return &EventHandler{broker: broker}
}

func (h *EventHandler) Stream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		// Reverse proxies may not support streaming; return 204 so the
		// frontend can fall back to polling instead of seeing a 500.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	clientID := model.NewID()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ch := h.broker.Subscribe(clientID)
	defer h.broker.Unsubscribe(clientID)

	// Send initial connected event
	fmt.Fprintf(w, "event: connected\ndata: {\"client_id\":\"%s\"}\n\n", clientID)
	flusher.Flush()

	for {
		select {
		case <-r.Context().Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, err := sse.FormatSSE(event)
			if err != nil {
				continue
			}
			_, _ = w.Write(data)
			flusher.Flush()
		}
	}
}
