package sse

import (
	"encoding/json"
	"sync"
)

type Event struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Broker struct {
	mu      sync.RWMutex
	clients map[string]chan Event
}

func NewBroker() *Broker {
	return &Broker{
		clients: make(map[string]chan Event),
	}
}

func (b *Broker) Subscribe(clientID string) <-chan Event {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan Event, 64)
	b.clients[clientID] = ch
	return ch
}

func (b *Broker) Unsubscribe(clientID string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if ch, ok := b.clients[clientID]; ok {
		close(ch)
		delete(b.clients, clientID)
	}
}

func (b *Broker) Broadcast(event Event, excludeClient string) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for id, ch := range b.clients {
		if id == excludeClient {
			continue
		}
		select {
		case ch <- event:
		default:
			// Drop event if client is too slow.
		}
	}
}

func (b *Broker) BroadcastJSON(eventType string, data interface{}) {
	b.Broadcast(Event{Type: eventType, Data: data}, "")
}

func FormatSSE(event Event) ([]byte, error) {
	data, err := json.Marshal(event.Data)
	if err != nil {
		return nil, err
	}
	var buf []byte
	buf = append(buf, "event: "...)
	buf = append(buf, event.Type...)
	buf = append(buf, '\n')
	buf = append(buf, "data: "...)
	buf = append(buf, data...)
	buf = append(buf, '\n', '\n')
	return buf, nil
}
