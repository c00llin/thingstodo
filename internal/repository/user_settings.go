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
		"SELECT play_complete_sound, show_count_main, show_count_projects, show_count_tags, review_after_days, sort_areas, sort_tags, evening_starts_at, default_time_gap, show_time_badge, time_format FROM user_settings WHERE user_id = ?",
		userID,
	).Scan(&s.PlayCompleteSound, &s.ShowCountMain, &s.ShowCountProjects, &s.ShowCountTags, &s.ReviewAfterDays, &s.SortAreas, &s.SortTags, &s.EveningStartsAt, &s.DefaultTimeGap, &s.ShowTimeBadge, &s.TimeFormat)
	if err == sql.ErrNoRows {
		_, err = r.db.Exec(
			"INSERT INTO user_settings (user_id) VALUES (?)", userID,
		)
		if err != nil {
			return nil, fmt.Errorf("create default settings: %w", err)
		}
		defaultDays := 7
		s = model.UserSettings{
			PlayCompleteSound: true,
			ShowCountMain:     true,
			ShowCountProjects: true,
			ShowCountTags:     true,
			ReviewAfterDays:   &defaultDays,
			SortAreas:         "manual",
			SortTags:          "manual",
			EveningStartsAt:   "18:00",
			DefaultTimeGap:    60,
			ShowTimeBadge:     true,
			TimeFormat:        "12h",
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
	if _, ok := input.Raw["review_after_days"]; ok {
		setClauses = append(setClauses, "review_after_days = ?")
		if input.ReviewAfterDays != nil {
			args = append(args, *input.ReviewAfterDays)
		} else {
			args = append(args, nil)
		}
	}
	if input.SortAreas != nil {
		setClauses = append(setClauses, "sort_areas = ?")
		args = append(args, *input.SortAreas)
	}
	if input.SortTags != nil {
		setClauses = append(setClauses, "sort_tags = ?")
		args = append(args, *input.SortTags)
	}
	if input.EveningStartsAt != nil {
		setClauses = append(setClauses, "evening_starts_at = ?")
		args = append(args, *input.EveningStartsAt)
	}
	if input.DefaultTimeGap != nil {
		setClauses = append(setClauses, "default_time_gap = ?")
		args = append(args, *input.DefaultTimeGap)
	}
	if input.ShowTimeBadge != nil {
		setClauses = append(setClauses, "show_time_badge = ?")
		args = append(args, boolToInt(*input.ShowTimeBadge))
	}
	if input.TimeFormat != nil {
		setClauses = append(setClauses, "time_format = ?")
		args = append(args, *input.TimeFormat)
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
