package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type UserSettingsRepository struct {
	db *sql.DB
}

func NewUserSettingsRepository(db *sql.DB) *UserSettingsRepository {
	return &UserSettingsRepository{db: db}
}

func (r *UserSettingsRepository) GetOrCreate(userID string) (*model.UserSettings, error) {
	var s model.UserSettings
	err := r.db.QueryRow(
		"SELECT play_complete_sound, show_count_main, show_count_projects, show_count_tags FROM user_settings WHERE user_id = ?",
		userID,
	).Scan(&s.PlayCompleteSound, &s.ShowCountMain, &s.ShowCountProjects, &s.ShowCountTags)
	if err == sql.ErrNoRows {
		_, err = r.db.Exec(
			"INSERT INTO user_settings (user_id) VALUES (?)", userID,
		)
		if err != nil {
			return nil, fmt.Errorf("create default settings: %w", err)
		}
		s = model.UserSettings{
			PlayCompleteSound: true,
			ShowCountMain:     true,
			ShowCountProjects: true,
			ShowCountTags:     true,
		}
		return &s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get settings: %w", err)
	}
	return &s, nil
}

func (r *UserSettingsRepository) Update(userID string, input model.UpdateUserSettingsInput) (*model.UserSettings, error) {
	var setClauses []string
	var args []interface{}

	if input.PlayCompleteSound != nil {
		setClauses = append(setClauses, "play_complete_sound = ?")
		args = append(args, *input.PlayCompleteSound)
	}
	if input.ShowCountMain != nil {
		setClauses = append(setClauses, "show_count_main = ?")
		args = append(args, *input.ShowCountMain)
	}
	if input.ShowCountProjects != nil {
		setClauses = append(setClauses, "show_count_projects = ?")
		args = append(args, *input.ShowCountProjects)
	}
	if input.ShowCountTags != nil {
		setClauses = append(setClauses, "show_count_tags = ?")
		args = append(args, *input.ShowCountTags)
	}

	if len(setClauses) > 0 {
		setClauses = append(setClauses, "updated_at = datetime('now')")
		query := fmt.Sprintf("UPDATE user_settings SET %s WHERE user_id = ?", strings.Join(setClauses, ", "))
		args = append(args, userID)
		_, err := r.db.Exec(query, args...)
		if err != nil {
			return nil, fmt.Errorf("update settings: %w", err)
		}
	}

	return r.GetOrCreate(userID)
}
