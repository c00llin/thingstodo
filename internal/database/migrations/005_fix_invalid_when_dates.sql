-- Clear when_date on tasks where deadline < when_date (causes duplicate display in Today view)
UPDATE tasks
SET when_date = NULL, updated_at = datetime('now')
WHERE deadline IS NOT NULL
  AND when_date IS NOT NULL
  AND when_date != 'someday'
  AND deadline < when_date;
