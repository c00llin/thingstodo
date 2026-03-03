-- Reminders: multiple per task, relative to task_schedules or exact datetime
CREATE TABLE reminders (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('at_start','on_day','minutes_before','hours_before','days_before','exact')),
    value INTEGER NOT NULL DEFAULT 0,
    exact_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reminders_task ON reminders(task_id);

-- Push subscriptions: one per device per user
CREATE TABLE push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Reminder dispatch log: prevents duplicate sends
CREATE TABLE reminder_log (
    id TEXT PRIMARY KEY,
    reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    schedule_id TEXT NOT NULL DEFAULT '',
    fire_at TEXT NOT NULL,
    sent_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(reminder_id, schedule_id, fire_at)
);

-- Default reminder + copy-to-recurring setting
ALTER TABLE user_settings ADD COLUMN default_reminder_type TEXT;
ALTER TABLE user_settings ADD COLUMN default_reminder_value INTEGER DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN copy_reminders_to_recurring INTEGER NOT NULL DEFAULT 1;
