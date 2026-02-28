-- Reset when_evening for tasks that were manually set to "This Evening"
-- but have no schedule start_time to justify the flag.
-- After this, when_evening is no longer user-settable; the Today view
-- determines evening placement solely from task_schedules.start_time.
UPDATE tasks SET when_evening = 0
WHERE when_evening = 1
  AND id NOT IN (
    SELECT ts.task_id FROM task_schedules ts
    WHERE ts.start_time IS NOT NULL
      AND ts.task_id = tasks.id
    ORDER BY ts.sort_order ASC
    LIMIT 1
  );
