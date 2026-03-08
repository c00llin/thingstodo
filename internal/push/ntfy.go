package push

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/collinjanssen/thingstodo/internal/repository"
)

type NtfySender struct {
	settingsRepo *repository.UserSettingsRepository
	userRepo     *repository.UserRepository
	httpClient   *http.Client
}

func NewNtfySender(settingsRepo *repository.UserSettingsRepository, userRepo *repository.UserRepository) *NtfySender {
	return &NtfySender{
		settingsRepo: settingsRepo,
		userRepo:     userRepo,
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (n *NtfySender) Enabled() bool {
	user, err := n.userRepo.GetFirst()
	if err != nil || user == nil {
		return false
	}
	settings, err := n.settingsRepo.GetOrCreate(user.ID)
	if err != nil {
		return false
	}
	return settings.NotificationProvider == "ntfy" &&
		settings.NtfyTopic != "" &&
		settings.NtfyServerURL != ""
}

func (n *NtfySender) Send(userID string, payload Payload) error {
	settings, err := n.settingsRepo.GetOrCreate(userID)
	if err != nil {
		return fmt.Errorf("ntfy: get settings: %w", err)
	}
	if settings.NotificationProvider != "ntfy" || settings.NtfyTopic == "" {
		return nil
	}

	body := map[string]interface{}{
		"topic":   settings.NtfyTopic,
		"title":   payload.Title,
		"message": payload.Body,
	}
	if payload.URL != "" && settings.BaseURL != "" {
		body["click"] = settings.BaseURL + payload.URL
	}
	if payload.Tag != "" {
		body["tags"] = []string{payload.Tag}
	}

	data, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("ntfy: marshal payload: %w", err)
	}

	req, err := http.NewRequest("POST", settings.NtfyServerURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("ntfy: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if settings.NtfyAccessToken != "" {
		req.Header.Set("Authorization", "Bearer "+settings.NtfyAccessToken)
	}

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("ntfy: send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("ntfy: server returned %d for topic %s", resp.StatusCode, settings.NtfyTopic)
		return fmt.Errorf("ntfy: server returned %d", resp.StatusCode)
	}
	return nil
}

func (n *NtfySender) SendToAll(payload Payload) error {
	user, err := n.userRepo.GetFirst()
	if err != nil || user == nil {
		return nil
	}
	return n.Send(user.ID, payload)
}
