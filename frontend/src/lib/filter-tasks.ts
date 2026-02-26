import {
  isToday,
  isBefore,
  isAfter,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
} from 'date-fns'
import type {
  Task,
  AnytimeViewAreaGroup,
  AnytimeViewProjectGroup,
  AnytimeViewNoArea,
  LogbookViewGroup,
  TodayViewSection,
  UpcomingViewDate,
} from '../api/types'
import type { FilterState, DateFilter } from '../stores/filters'

function parseDate(iso: string | null): Date | null {
  if (!iso || iso === 'someday') return null
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function matchesDateFilter(iso: string | null, filter: DateFilter): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (filter.type === 'preset') {
    switch (filter.preset) {
      case 'today':
        return iso !== null && isToday(new Date(iso + 'T00:00:00'))
      case 'thisWeek': {
        const d = parseDate(iso)
        if (!d) return false
        return !isBefore(d, startOfWeek(today, { weekStartsOn: 1 })) &&
               !isAfter(d, endOfWeek(today, { weekStartsOn: 1 }))
      }
      case 'thisMonth': {
        const d = parseDate(iso)
        if (!d) return false
        return !isBefore(d, startOfMonth(today)) && !isAfter(d, endOfMonth(today))
      }
      case 'next7': {
        const d = parseDate(iso)
        if (!d) return false
        return !isBefore(d, today) && !isAfter(d, addDays(today, 7))
      }
      case 'next30': {
        const d = parseDate(iso)
        if (!d) return false
        return !isBefore(d, today) && !isAfter(d, addDays(today, 30))
      }
      case 'overdue': {
        const d = parseDate(iso)
        if (!d) return false
        return isBefore(d, today)
      }
      case 'noDate':
      case 'noDeadline':
        return iso === null || iso === ''
      default:
        return true
    }
  }

  if (filter.type === 'specific') {
    return iso === filter.date
  }

  if (filter.type === 'range') {
    const d = parseDate(iso)
    if (!d) return false
    const start = filter.start ? new Date(filter.start + 'T00:00:00') : null
    const end = filter.end ? new Date(filter.end + 'T00:00:00') : null
    if (start && isBefore(d, start)) return false
    if (end && isAfter(d, end)) return false
    return true
  }

  return true
}

export function filterTasks(tasks: Task[], filters: FilterState): Task[] {
  return tasks.filter((task) => {
    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const notes = task.notes ?? ''
      if (!task.title.toLowerCase().includes(q) && !notes.toLowerCase().includes(q)) {
        return false
      }
    }

    // Area (OR within)
    if (filters.areas.length > 0) {
      if (!task.area_id || !filters.areas.includes(task.area_id)) return false
    }

    // Project (OR within)
    if (filters.projects.length > 0) {
      if (!task.project_id || !filters.projects.includes(task.project_id)) return false
    }

    // High Priority
    if (filters.highPriority && !task.high_priority) return false

    // Planned Date
    if (filters.plannedDate && !matchesDateFilter(task.when_date, filters.plannedDate)) return false

    // Deadline
    if (filters.deadline && !matchesDateFilter(task.deadline, filters.deadline)) return false

    return true
  })
}

/** Check if any filters are active (quick check without store subscription) */
export function hasFilters(filters: FilterState): boolean {
  return (
    filters.areas.length > 0 ||
    filters.projects.length > 0 ||
    filters.highPriority ||
    filters.plannedDate !== null ||
    filters.deadline !== null ||
    filters.search !== ''
  )
}

/* ─── Nested view filtering helpers ──────────────────────────────── */

/** Filter TodayView sections, removing empty groups */
export function filterTodaySections(sections: TodayViewSection[], filters: FilterState): TodayViewSection[] {
  return sections
    .map((section) => ({
      ...section,
      groups: section.groups
        .map((g) => ({ ...g, tasks: filterTasks(g.tasks, filters) }))
        .filter((g) => g.tasks.length > 0),
    }))
}

/** Filter UpcomingView date sections, removing empty dates */
export function filterUpcomingDates(dates: UpcomingViewDate[], filters: FilterState): UpcomingViewDate[] {
  return dates
    .map((d) => ({ ...d, tasks: filterTasks(d.tasks, filters) }))
    .filter((d) => d.tasks.length > 0)
}

/** Filter Anytime/Someday nested area→project→tasks, removing empty groups */
export function filterAreaGroups(
  areas: AnytimeViewAreaGroup[],
  filters: FilterState,
): AnytimeViewAreaGroup[] {
  return areas
    .map((ag) => ({
      ...ag,
      standalone_tasks: filterTasks(ag.standalone_tasks, filters),
      projects: filterProjectGroups(ag.projects, filters),
    }))
    .filter((ag) => ag.standalone_tasks.length > 0 || ag.projects.length > 0)
}

export function filterNoArea(noArea: AnytimeViewNoArea, filters: FilterState): AnytimeViewNoArea {
  return {
    standalone_tasks: filterTasks(noArea.standalone_tasks, filters),
    projects: filterProjectGroups(noArea.projects, filters),
  }
}

function filterProjectGroups(
  projects: AnytimeViewProjectGroup[],
  filters: FilterState,
): AnytimeViewProjectGroup[] {
  return projects
    .map((pg) => ({ ...pg, tasks: filterTasks(pg.tasks, filters) }))
    .filter((pg) => pg.tasks.length > 0)
}

/** Filter LogbookView groups, removing empty date groups */
export function filterLogbookGroups(groups: LogbookViewGroup[], filters: FilterState): LogbookViewGroup[] {
  return groups
    .map((g) => ({ ...g, tasks: filterTasks(g.tasks, filters) }))
    .filter((g) => g.tasks.length > 0)
}
