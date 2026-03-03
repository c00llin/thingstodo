package repository

import (
	"database/sql"
	"fmt"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type PushSubscriptionRepository struct {
	db *sql.DB
}

func NewPushSubscriptionRepository(db *sql.DB) *PushSubscriptionRepository {
	return &PushSubscriptionRepository{db: db}
}

func (r *PushSubscriptionRepository) ListByUser(userID string) ([]model.PushSubscription, error) {
	rows, err := r.db.Query(
		"SELECT id, endpoint, p256dh, auth, user_agent, created_at FROM push_subscriptions WHERE user_id = ? ORDER BY created_at", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.PushSubscription
	for rows.Next() {
		var s model.PushSubscription
		if err := rows.Scan(&s.ID, &s.Endpoint, &s.P256dh, &s.Auth, &s.UserAgent, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan push subscription: %w", err)
		}
		s.UserID = userID
		items = append(items, s)
	}
	if items == nil {
		items = []model.PushSubscription{}
	}
	return items, rows.Err()
}

// Upsert creates or replaces a push subscription keyed on endpoint.
func (r *PushSubscriptionRepository) Upsert(userID string, input model.CreatePushSubscriptionInput) (*model.PushSubscription, error) {
	// Delete any existing subscription with same endpoint (across all users)
	_, _ = r.db.Exec("DELETE FROM push_subscriptions WHERE endpoint = ?", input.Endpoint)

	id := model.NewID()
	_, err := r.db.Exec(
		"INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
		id, userID, input.Endpoint, input.P256dh, input.Auth, input.UserAgent)
	if err != nil {
		return nil, fmt.Errorf("upsert push subscription: %w", err)
	}

	var s model.PushSubscription
	err = r.db.QueryRow(
		"SELECT id, endpoint, p256dh, auth, user_agent, created_at FROM push_subscriptions WHERE id = ?", id).
		Scan(&s.ID, &s.Endpoint, &s.P256dh, &s.Auth, &s.UserAgent, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("read back push subscription: %w", err)
	}
	s.UserID = userID
	return &s, nil
}

// DeleteByEndpoint removes a subscription by its endpoint URL.
func (r *PushSubscriptionRepository) DeleteByEndpoint(endpoint string) error {
	_, err := r.db.Exec("DELETE FROM push_subscriptions WHERE endpoint = ?", endpoint)
	return err
}

// Delete removes a subscription by ID.
func (r *PushSubscriptionRepository) Delete(id string) error {
	_, err := r.db.Exec("DELETE FROM push_subscriptions WHERE id = ?", id)
	return err
}

// ListAll returns all push subscriptions across all users.
func (r *PushSubscriptionRepository) ListAll() ([]model.PushSubscription, error) {
	rows, err := r.db.Query(
		"SELECT id, user_id, endpoint, p256dh, auth, user_agent, created_at FROM push_subscriptions ORDER BY created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.PushSubscription
	for rows.Next() {
		var s model.PushSubscription
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth, &s.UserAgent, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan push subscription: %w", err)
		}
		items = append(items, s)
	}
	if items == nil {
		items = []model.PushSubscription{}
	}
	return items, rows.Err()
}

// GetAllUsers returns all distinct user IDs that have push subscriptions.
func (r *PushSubscriptionRepository) GetAllUsers() ([]string, error) {
	rows, err := r.db.Query("SELECT DISTINCT user_id FROM push_subscriptions")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var uid string
		if err := rows.Scan(&uid); err != nil {
			return nil, err
		}
		users = append(users, uid)
	}
	return users, rows.Err()
}
