CREATE TABLE IF NOT EXISTS change_log (
    seq        INTEGER PRIMARY KEY AUTOINCREMENT,
    entity     TEXT    NOT NULL,  -- 'task', 'project', 'area', 'tag', 'heading', 'checklist_item', 'attachment', 'schedule', 'reminder', 'repeat_rule', 'task_tag', 'project_tag', 'user_settings', 'saved_filter'
    entity_id  TEXT    NOT NULL,
    action     TEXT    NOT NULL,  -- 'create', 'update', 'delete'
    fields     TEXT,              -- JSON array of changed field names (null for create/delete)
    snapshot   TEXT    NOT NULL,  -- full JSON snapshot of entity after change
    user_id    TEXT,
    device_id  TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_change_log_seq ON change_log(seq);
CREATE INDEX idx_change_log_entity ON change_log(entity, entity_id);
