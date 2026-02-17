import type { Task } from '../api/types'

/**
 * Returns a display label for a task's project/area context.
 * e.g. "Area / Project", "Project", or "Area"
 */
export function getTaskContext(task: Task): string | null {
  const { project_name, area_name } = task

  if (area_name && project_name) return `${area_name} / ${project_name}`
  if (project_name) return project_name
  if (area_name) return area_name
  return null
}
