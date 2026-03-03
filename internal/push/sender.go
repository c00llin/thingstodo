package push

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/collinjanssen/thingstodo/internal/repository"
)

type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url,omitempty"`
	Tag   string `json:"tag,omitempty"`
}

type Sender struct {
	subRepo    *repository.PushSubscriptionRepository
	privateKey string
	publicKey  string
	contact    string
}

func NewSender(subRepo *repository.PushSubscriptionRepository, privateKey, publicKey, contact string) *Sender {
	return &Sender{
		subRepo:    subRepo,
		privateKey: privateKey,
		publicKey:  publicKey,
		contact:    contact,
	}
}

func (s *Sender) Enabled() bool {
	return s.privateKey != "" && s.publicKey != ""
}

func (s *Sender) Send(userID string, payload Payload) error {
	if !s.Enabled() {
		return nil
	}

	subs, err := s.subRepo.ListByUser(userID)
	if err != nil {
		return fmt.Errorf("list push subscriptions: %w", err)
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal push payload: %w", err)
	}

	for _, sub := range subs {
		ws := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}
		resp, err := webpush.SendNotification(data, ws, &webpush.Options{
			Subscriber:      s.contact,
			VAPIDPublicKey:  s.publicKey,
			VAPIDPrivateKey: s.privateKey,
			TTL:             3600,
		})
		if err != nil {
			log.Printf("push send error for endpoint %s: %v", sub.Endpoint, err)
			continue
		}
		_ = resp.Body.Close()

		if resp.StatusCode == http.StatusGone {
			log.Printf("push subscription gone, removing: %s", sub.Endpoint)
			if err := s.subRepo.DeleteByEndpoint(sub.Endpoint); err != nil {
				log.Printf("failed to delete gone subscription: %v", err)
			}
		}
	}
	return nil
}

func (s *Sender) SendToAll(payload Payload) error {
	if !s.Enabled() {
		return nil
	}

	subs, err := s.subRepo.ListAll()
	if err != nil {
		return fmt.Errorf("list all push subscriptions: %w", err)
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal push payload: %w", err)
	}

	for _, sub := range subs {
		ws := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}
		resp, err := webpush.SendNotification(data, ws, &webpush.Options{
			Subscriber:      s.contact,
			VAPIDPublicKey:  s.publicKey,
			VAPIDPrivateKey: s.privateKey,
			TTL:             3600,
		})
		if err != nil {
			log.Printf("push send error for endpoint %s: %v", sub.Endpoint, err)
			continue
		}
		_ = resp.Body.Close()

		if resp.StatusCode == http.StatusGone {
			log.Printf("push subscription gone, removing: %s", sub.Endpoint)
			if err := s.subRepo.DeleteByEndpoint(sub.Endpoint); err != nil {
				log.Printf("failed to delete gone subscription: %v", err)
			}
		}
	}
	return nil
}
