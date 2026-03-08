package push

import (
	"github.com/collinjanssen/thingstodo/internal/repository"
)

// Dispatcher selects the active notification backend at send time.
// It implements Notifier so the scheduler can use it transparently.
type Dispatcher struct {
	webpush      *Sender
	ntfy         *NtfySender
	settingsRepo *repository.UserSettingsRepository
	userRepo     *repository.UserRepository
}

func NewDispatcher(
	webpush *Sender,
	ntfy *NtfySender,
	settingsRepo *repository.UserSettingsRepository,
	userRepo *repository.UserRepository,
) *Dispatcher {
	return &Dispatcher{
		webpush:      webpush,
		ntfy:         ntfy,
		settingsRepo: settingsRepo,
		userRepo:     userRepo,
	}
}

func (d *Dispatcher) Enabled() bool {
	return d.webpush.Enabled() || d.ntfy.Enabled()
}

func (d *Dispatcher) Send(userID string, payload Payload) error {
	settings, err := d.settingsRepo.GetOrCreate(userID)
	if err != nil {
		// Fall back to webpush if settings can't be read
		return d.webpush.Send(userID, payload)
	}
	switch settings.NotificationProvider {
	case "ntfy":
		return d.ntfy.Send(userID, payload)
	case "none":
		return nil
	default: // "webpush"
		return d.webpush.Send(userID, payload)
	}
}

func (d *Dispatcher) SendToAll(payload Payload) error {
	user, err := d.userRepo.GetFirst()
	if err != nil || user == nil {
		return nil
	}
	return d.Send(user.ID, payload)
}
