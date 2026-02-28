CREATE TABLE task_schedules (
    id         TEXT PRIMARY KEY,
    task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    when_date  TEXT NOT NULL,
    start_time TEXT,
    end_time   TEXT,
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_task_schedules_task_id ON task_schedules(task_id);
CREATE INDEX idx_task_schedules_when_date ON task_schedules(when_date);

-- Backfill: migrate existing when_date into task_schedules
INSERT INTO task_schedules (id, task_id, when_date, sort_order)
SELECT lower(hex(randomblob(5))), id, when_date, 0
FROM tasks WHERE when_date IS NOT NULL;
