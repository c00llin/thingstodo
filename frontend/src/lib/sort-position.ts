import type { Task, SortField } from '../api/types'

function getSortOrder(task: Task, sortField: SortField): number {
  if (sortField === 'sort_order_today') return task.sort_order_today
  if (sortField === 'sort_order_project') return task.sort_order_project
  return task.sort_order_heading
}

export function calculatePosition(tasks: Task[], overIndex: number, sortField: SortField): number {
  if (tasks.length === 0) return 1024

  if (overIndex === 0) {
    return getSortOrder(tasks[0], sortField) / 2
  }
  if (overIndex >= tasks.length) {
    return getSortOrder(tasks[tasks.length - 1], sortField) + 1024
  }
  return (getSortOrder(tasks[overIndex - 1], sortField) + getSortOrder(tasks[overIndex], sortField)) / 2
}
