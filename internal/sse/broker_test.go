package sse

import (
	"sync"
	"testing"
	"time"
)

func TestSubscribeCreatesChannel(t *testing.T) {
	b := NewBroker()
	ch := b.Subscribe("client1")
	if ch == nil {
		t.Fatal("expected non-nil channel")
	}
}

func TestBroadcastSendsToAllClients(t *testing.T) {
	b := NewBroker()
	ch1 := b.Subscribe("client1")
	ch2 := b.Subscribe("client2")

	event := Event{Type: "task_created", Data: map[string]string{"id": "abc"}}
	b.Broadcast(event, "")

	select {
	case e := <-ch1:
		if e.Type != "task_created" {
			t.Errorf("client1: expected type task_created, got %s", e.Type)
		}
	case <-time.After(time.Second):
		t.Error("client1: timed out waiting for event")
	}

	select {
	case e := <-ch2:
		if e.Type != "task_created" {
			t.Errorf("client2: expected type task_created, got %s", e.Type)
		}
	case <-time.After(time.Second):
		t.Error("client2: timed out waiting for event")
	}
}

func TestBroadcastExcludesSender(t *testing.T) {
	b := NewBroker()
	ch1 := b.Subscribe("client1")
	ch2 := b.Subscribe("client2")

	event := Event{Type: "task_updated", Data: nil}
	b.Broadcast(event, "client1")

	// client1 should NOT receive the event.
	select {
	case <-ch1:
		t.Error("client1 should not have received event")
	case <-time.After(50 * time.Millisecond):
		// expected
	}

	// client2 should receive the event.
	select {
	case e := <-ch2:
		if e.Type != "task_updated" {
			t.Errorf("client2: expected type task_updated, got %s", e.Type)
		}
	case <-time.After(time.Second):
		t.Error("client2: timed out waiting for event")
	}
}

func TestUnsubscribeRemovesClient(t *testing.T) {
	b := NewBroker()
	ch := b.Subscribe("client1")
	b.Unsubscribe("client1")

	// Channel should be closed.
	_, ok := <-ch
	if ok {
		t.Error("expected channel to be closed after unsubscribe")
	}

	// Broadcast should not panic with no clients.
	b.Broadcast(Event{Type: "test", Data: nil}, "")
}

func TestUnsubscribeNonexistentClient(t *testing.T) {
	b := NewBroker()
	// Should not panic.
	b.Unsubscribe("nonexistent")
}

func TestBroadcastWithNoClients(t *testing.T) {
	b := NewBroker()
	// Should not panic.
	b.Broadcast(Event{Type: "test", Data: nil}, "")
}

func TestBroadcastJSON(t *testing.T) {
	b := NewBroker()
	ch := b.Subscribe("client1")

	b.BroadcastJSON("task_deleted", map[string]string{"id": "xyz"})

	select {
	case e := <-ch:
		if e.Type != "task_deleted" {
			t.Errorf("expected type task_deleted, got %s", e.Type)
		}
	case <-time.After(time.Second):
		t.Error("timed out waiting for event")
	}
}

func TestFormatSSE(t *testing.T) {
	event := Event{Type: "task_created", Data: map[string]string{"id": "abc"}}
	data, err := FormatSSE(event)
	if err != nil {
		t.Fatalf("FormatSSE failed: %v", err)
	}
	expected := "event: task_created\ndata: {\"id\":\"abc\"}\n\n"
	if string(data) != expected {
		t.Errorf("expected %q, got %q", expected, string(data))
	}
}

func TestConcurrentSubscribeUnsubscribe(t *testing.T) {
	b := NewBroker()
	var wg sync.WaitGroup

	// Concurrently subscribe, broadcast, and unsubscribe.
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			clientID := "client" + string(rune('A'+id%26)) + string(rune('0'+id/26))
			b.Subscribe(clientID)
			b.Broadcast(Event{Type: "test", Data: nil}, "")
			b.Unsubscribe(clientID)
		}(i)
	}

	wg.Wait()
}

func TestSlowClientDropsEvents(t *testing.T) {
	b := NewBroker()
	ch := b.Subscribe("slow")

	// Fill the channel buffer (capacity 64).
	for i := 0; i < 100; i++ {
		b.Broadcast(Event{Type: "flood", Data: i}, "")
	}

	// Should have exactly 64 events (buffer size), rest dropped.
	count := 0
	for {
		select {
		case <-ch:
			count++
		default:
			goto done
		}
	}
done:
	if count != 64 {
		t.Errorf("expected 64 buffered events, got %d", count)
	}
}
