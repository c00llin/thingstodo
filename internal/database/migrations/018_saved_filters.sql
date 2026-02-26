-- Saved filter configurations per user per view
CREATE TABLE IF NOT EXISTS saved_filters (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    view       TEXT NOT NULL CHECK (view IN ('today', 'upcoming', 'anytime', 'someday', 'logbook')),
    name       TEXT NOT NULL,
    config     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_saved_filters_user_view ON saved_filters(user_id, view);
