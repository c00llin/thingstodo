-- Drop and recreate user_settings without the foreign key constraint
-- so settings work for any authenticated user (including proxy auth).
CREATE TABLE IF NOT EXISTS user_settings_new (
    user_id TEXT PRIMARY KEY,
    play_complete_sound INTEGER NOT NULL DEFAULT 1,
    show_count_main INTEGER NOT NULL DEFAULT 1,
    show_count_projects INTEGER NOT NULL DEFAULT 1,
    show_count_tags INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO user_settings_new SELECT * FROM user_settings;
DROP TABLE user_settings;
ALTER TABLE user_settings_new RENAME TO user_settings;
