CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    play_complete_sound INTEGER NOT NULL DEFAULT 1,
    show_count_main INTEGER NOT NULL DEFAULT 1,
    show_count_projects INTEGER NOT NULL DEFAULT 1,
    show_count_tags INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
