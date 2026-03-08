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
		"SELECT play_complete_sound, show_count_main, show_count_projects, show_count_tags, review_after_days, sort_areas, sort_tags, evening_starts_at, default_time_gap, show_time_badge, time_format, font_size, default_reminder_type, default_reminder_value, copy_reminders_to_recurring, notification_provider, ntfy_server_url, ntfy_topic, ntfy_access_token, base_url, privacy_mode FROM user_settings WHERE user_id = ?",
		userID,
	).Scan(&s.PlayCompleteSound, &s.ShowCountMain, &s.ShowCountProjects, &s.ShowCountTags, &s.ReviewAfterDays, &s.SortAreas, &s.SortTags, &s.EveningStartsAt, &s.DefaultTimeGap, &s.ShowTimeBadge, &s.TimeFormat, &s.FontSize, &s.DefaultReminderType, &s.DefaultReminderValue, &s.CopyRemindersToRecurring, &s.NotificationProvider, &s.NtfyServerURL, &s.NtfyTopic, &s.NtfyAccessToken, &s.BaseURL, &s.PrivacyMode)
	if err == sql.ErrNoRows {
		_, err = r.db.Exec(
			"INSERT INTO user_settings (user_id) VALUES (?)", userID,
		)
		if err != nil {
			return nil, fmt.Errorf("create default settings: %w", err)
		}
		defaultDays := 7
		s = model.UserSettings{
			PlayCompleteSound:        true,
			ShowCountMain:            true,
			ShowCountProjects:        true,
			ShowCountTags:            true,
			ReviewAfterDays:          &defaultDays,
			SortAreas:                "manual",
			SortTags:                 "manual",
			EveningStartsAt:          "18:00",
			DefaultTimeGap:           60,
			ShowTimeBadge:            true,
			TimeFormat:               "12h",
			FontSize:                 16,
			CopyRemindersToRecurring: true,
			NotificationProvider:     "webpush",
			NtfyServerURL:            "https://ntfy.sh",
			NtfyTopic:                "thingstodo",
			PrivacyMode:              false,
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
	if input.FontSize != nil {
		setClauses = append(setClauses, "font_size = ?")
		args = append(args, *input.FontSize)
	}
	if _, ok := input.Raw["default_reminder_type"]; ok {
		setClauses = append(setClauses, "default_reminder_type = ?")
		if input.DefaultReminderType != nil {
			args = append(args, *input.DefaultReminderType)
		} else {
			args = append(args, nil)
		}
	}
	if input.DefaultReminderValue != nil {
		setClauses = append(setClauses, "default_reminder_value = ?")
		args = append(args, *input.DefaultReminderValue)
	}
	if input.CopyRemindersToRecurring != nil {
		setClauses = append(setClauses, "copy_reminders_to_recurring = ?")
		args = append(args, boolToInt(*input.CopyRemindersToRecurring))
	}
	if input.NotificationProvider != nil {
		setClauses = append(setClauses, "notification_provider = ?")
		args = append(args, *input.NotificationProvider)
	}
	if input.NtfyServerURL != nil {
		setClauses = append(setClauses, "ntfy_server_url = ?")
		args = append(args, *input.NtfyServerURL)
	}
	if input.NtfyTopic != nil {
		setClauses = append(setClauses, "ntfy_topic = ?")
		args = append(args, *input.NtfyTopic)
	}
	if input.NtfyAccessToken != nil {
		setClauses = append(setClauses, "ntfy_access_token = ?")
		args = append(args, *input.NtfyAccessToken)
	}
	if input.BaseURL != nil {
		setClauses = append(setClauses, "base_url = ?")
		args = append(args, *input.BaseURL)
	}
	if input.PrivacyMode != nil {
		setClauses = append(setClauses, "privacy_mode = ?")
		args = append(args, boolToInt(*input.PrivacyMode))
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
