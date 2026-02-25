-- Make area_id required on projects (NOT NULL, ON DELETE RESTRICT)
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.
-- Must disable foreign keys during table recreation to avoid SQLITE_LOCKED.
PRAGMA foreign_keys = OFF;

-- Drop leftover temp table from any prior failed attempt
DROP TABLE IF EXISTS projects_new;

-- Clean up orphaned projects (no area) and their related data first
DELETE FROM checklist_items WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE area_id IS NULL));
DELETE FROM task_tags WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE area_id IS NULL));
DELETE FROM attachments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE area_id IS NULL));
DELETE FROM repeat_rules WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE area_id IS NULL));
DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE area_id IS NULL);
DELETE FROM project_tags WHERE project_id IN (SELECT id FROM projects WHERE area_id IS NULL);
DELETE FROM projects WHERE area_id IS NULL;

CREATE TABLE projects_new (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    area_id TEXT NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'canceled')),
    when_date TEXT,
    deadline TEXT,
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO projects_new SELECT * FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

-- Recreate indexes lost during table recreation
CREATE INDEX idx_projects_area_id ON projects(area_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE UNIQUE INDEX idx_projects_title ON projects(title);

PRAGMA foreign_keys = ON;
