ALTER TABLE user_settings ADD COLUMN evening_starts_at TEXT NOT NULL DEFAULT '18:00';
ALTER TABLE user_settings ADD COLUMN default_time_gap  INTEGER NOT NULL DEFAULT 60;
ALTER TABLE user_settings ADD COLUMN show_time_badge   INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_settings ADD COLUMN time_format       TEXT NOT NULL DEFAULT '12h';
