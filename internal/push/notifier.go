package push

// Notifier abstracts notification delivery so the scheduler
// does not need to know which backend is active.
type Notifier interface {
	Send(userID string, payload Payload) error
	SendToAll(payload Payload) error
	Enabled() bool
}
