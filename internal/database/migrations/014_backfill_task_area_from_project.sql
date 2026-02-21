-- Backfill area_id on tasks where the project has an area but the task does not.
UPDATE tasks
SET area_id = p.area_id,
    updated_at = datetime('now')
FROM projects p
WHERE tasks.project_id = p.id
  AND p.area_id IS NOT NULL
  AND tasks.area_id IS NULL;
