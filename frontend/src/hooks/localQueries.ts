/**
 * localQueries.ts
 *
 * Reactive Dexie live-query hooks that read from IndexedDB.
 * These mirror the shapes returned by the server view hooks in queries.ts
 * and will eventually replace TanStack Query reads for local-first operation.
 *
 * useLiveQuery returns `undefined` while loading — callers should treat
 * `undefined` the same as `isLoading: true`.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { localDb } from '../db/index'
import type {
  LocalTask,
  LocalProject,
  LocalArea,
  LocalTag,
  LocalChecklistItem,
  LocalAttachment,
  LocalSchedule,
  LocalReminder,
  LocalRepeatRule,
} from '../db/schema'
import type {
  Task,
  InboxView,
  TodayView,
  TodayViewGroup,
  TodayViewSection,
  UpcomingView,
  UpcomingViewDate,
  AnytimeView,
  AnytimeViewAreaGroup,
  AnytimeViewProjectGroup,
  AnytimeViewNoArea,
  SomedayView,
  LogbookView,
  TrashView,
  ViewCounts,
  TaskDetail,
  ProjectDetail,
  HeadingWithTasks,
  AreaDetail,
  Project,
  Area,
  Tag,
} from '../api/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns today's date as a YYYY-MM-DD string in local time. */
function todayString(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Strip sync metadata fields so callers get plain server-shaped types. */
function stripSyncMeta<T extends object>(
  obj: T,
): Omit<T, '_syncStatus' | '_localUpdatedAt' | '_serverSeq'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { _syncStatus, _localUpdatedAt, _serverSeq, ...rest } = obj as any
  void _syncStatus
  void _localUpdatedAt
  void _serverSeq
  return rest
}

function taskToPlain(t: LocalTask): Task {
  return stripSyncMeta(t) as Task
}

/**
 * Compute schedule flags on a plain Task from its local schedule entries.
 * Mirrors the server's populateActionableScheduleFlags / populatePastScheduleCounts.
 */
async function computeScheduleFlags(plain: Task): Promise<void> {
  const today = todayString()
  const allSchedules = await localDb.schedules
    .where('task_id')
    .equals(plain.id)
    .toArray()

  if (allSchedules.length === 0) return

  // has_actionable_schedules: uncompleted entries not for today (or someday)
  plain.has_actionable_schedules = allSchedules.some(
    (s) => !s.completed && (s.when_date !== today || s.when_date === 'someday'),
  )

  // all_today_schedules_completed: all entries are completed
  const total = allSchedules.length
  const completed = allSchedules.filter((s) => s.completed).length
  plain.all_today_schedules_completed = total > 0 && completed === total

  // first_schedule_completed: the displayed entry is completed
  if (plain.schedule_entry_id) {
    const entry = allSchedules.find((s) => s.id === plain.schedule_entry_id)
    if (entry) plain.first_schedule_completed = entry.completed
  } else if (plain.first_schedule_time) {
    const sorted = [...allSchedules].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    if (sorted.length > 0) plain.first_schedule_completed = sorted[0].completed
  }

  // past_schedule_count: uncompleted entries with when_date < today
  plain.past_schedule_count = allSchedules.filter(
    (s) => !s.completed && s.when_date < today && s.when_date !== 'someday',
  ).length
}

/**
 * Enrich a task with denormalized project_name, area_name, schedule time, and flags.
 * The server does this via SQL JOINs; we do it by looking up related entities.
 */
async function enrichTask(t: LocalTask): Promise<Task> {
  const plain = taskToPlain(t)

  // Resolve project/area names
  if (t.project_id && !plain.project_name) {
    const project = await localDb.projects.get(t.project_id)
    if (project) plain.project_name = project.title
  }
  if (t.area_id && !plain.area_name) {
    const area = await localDb.areas.get(t.area_id)
    if (area) plain.area_name = area.title
  }

  // Resolve first schedule time if not already set
  if (!plain.first_schedule_time) {
    const firstSchedule = await localDb.schedules
      .where('task_id')
      .equals(t.id)
      .filter((s) => !s.completed)
      .sortBy('sort_order')
    if (firstSchedule.length > 0 && firstSchedule[0].start_time) {
      plain.first_schedule_time = firstSchedule[0].start_time
      plain.first_schedule_end_time = firstSchedule[0].end_time ?? null
      plain.schedule_entry_id = firstSchedule[0].id
    }
  }

  await computeScheduleFlags(plain)
  return plain
}

/**
 * Batch-enrich tasks, caching project/area lookups.
 */
async function enrichTasks(tasks: LocalTask[]): Promise<Task[]> {
  // Collect unique project/area IDs
  const projectIds = new Set<string>()
  const areaIds = new Set<string>()
  for (const t of tasks) {
    if (t.project_id && !t.project_name) projectIds.add(t.project_id)
    if (t.area_id && !t.area_name) areaIds.add(t.area_id)
  }

  const projectNames = new Map<string, string>()
  const areaNames = new Map<string, string>()
  for (const pid of projectIds) {
    const p = await localDb.projects.get(pid)
    if (p) projectNames.set(pid, p.title)
  }
  for (const aid of areaIds) {
    const a = await localDb.areas.get(aid)
    if (a) areaNames.set(aid, a.title)
  }

  const result: Task[] = []
  for (const t of tasks) {
    const plain = taskToPlain(t)
    if (t.project_id && !plain.project_name) {
      plain.project_name = projectNames.get(t.project_id) ?? null
    }
    if (t.area_id && !plain.area_name) {
      plain.area_name = areaNames.get(t.area_id) ?? null
    }
    if (!plain.first_schedule_time) {
      const schedules = await localDb.schedules
        .where('task_id')
        .equals(t.id)
        .filter((s) => !s.completed)
        .sortBy('sort_order')
      if (schedules.length > 0 && schedules[0].start_time) {
        plain.first_schedule_time = schedules[0].start_time
        plain.first_schedule_end_time = schedules[0].end_time ?? null
        plain.schedule_entry_id = schedules[0].id
      }
    }
    await computeScheduleFlags(plain)
    result.push(plain)
  }
  return result
}

function projectToPlain(p: LocalProject): Project {
  return stripSyncMeta(p) as Project
}

function areaToPlain(a: LocalArea): Area {
  return stripSyncMeta(a) as Area
}

function tagToPlain(t: LocalTag): Tag {
  return stripSyncMeta(t) as Tag
}

// ---------------------------------------------------------------------------
// View Hooks
// ---------------------------------------------------------------------------

/**
 * Inbox: open tasks with no project_id, no area_id, no when_date, not deleted.
 * Review: open tasks not updated in `reviewAfterDays`, excluding inbox tasks.
 * When `reviewIncludeRecurring` is false, recurring tasks are excluded from review.
 */
export function useLocalInbox(reviewAfterDays?: number | null, reviewIncludeRecurring = true): InboxView | undefined {
  return useLiveQuery(async () => {
    const tasks = await localDb.tasks
      .where('status')
      .equals('open')
      .filter(
        (t) =>
          !t.project_id &&
          !t.area_id &&
          !t.when_date &&
          !t.deleted_at,
      )
      .sortBy('sort_order_today')

    const inboxIds = new Set(tasks.map((t) => t.id))

    let review: Task[] = []
    if (reviewAfterDays && reviewAfterDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - reviewAfterDays)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      const stale = await localDb.tasks
        .where('status')
        .equals('open')
        .filter(
          (t) =>
            !t.deleted_at &&
            !inboxIds.has(t.id) &&
            (t.updated_at ?? '').slice(0, 10) < cutoffStr &&
            (reviewIncludeRecurring || !t.has_repeat_rule),
        )
        .toArray()

      stale.sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? ''))
      review = await enrichTasks(stale)
    }

    return {
      tasks: await enrichTasks(tasks),
      review,
    } satisfies InboxView
  }, [reviewAfterDays, reviewIncludeRecurring])
}

/**
 * Group tasks by project_id, resolving project names from the local DB.
 */
async function groupByProject(tasks: LocalTask[]): Promise<TodayViewGroup[]> {
  const enriched = await enrichTasks(tasks)
  const projectMap = new Map<string | null, Task[]>()
  for (const t of enriched) {
    const key = t.project_id ?? null
    if (!projectMap.has(key)) projectMap.set(key, [])
    projectMap.get(key)!.push(t)
  }

  const projectIds = [...projectMap.keys()].filter((k): k is string => k !== null)
  const projects = projectIds.length
    ? await localDb.projects.bulkGet(projectIds)
    : []
  const projectNames = new Map<string, string>()
  for (const p of projects) {
    if (p) projectNames.set(p.id, p.title)
  }

  const groups: TodayViewGroup[] = []
  if (projectMap.has(null)) {
    groups.push({ project: null, tasks: projectMap.get(null)! })
  }
  for (const pid of projectIds) {
    groups.push({
      project: { id: pid, title: projectNames.get(pid) ?? pid },
      tasks: projectMap.get(pid) ?? [],
    })
  }
  return groups
}

/**
 * Today: open tasks matching today via when_date, deadline, or schedule entry.
 * Split into Today and This Evening sections based on eveningStartsAt.
 * Includes overdue, earlier, and completed-today.
 */
export function useLocalToday(eveningStartsAt = '18:00'): TodayView | undefined {
  return useLiveQuery(async () => {
    const today = todayString()

    // Collect all tasks that should appear in Today:
    // 1) when_date = today
    // 2) deadline = today (even if no when_date)
    // 3) has a schedule entry with when_date = today and not completed
    const seenIds = new Set<string>()
    const candidates: LocalTask[] = []

    // 1) when_date = today
    const byWhenDate = await localDb.tasks
      .where('when_date')
      .equals(today)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .toArray()
    for (const t of byWhenDate) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); candidates.push(t) }
    }

    // 2) deadline = today
    const byDeadline = await localDb.tasks
      .where('deadline')
      .equals(today)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .toArray()
    for (const t of byDeadline) {
      if (!seenIds.has(t.id)) { seenIds.add(t.id); candidates.push(t) }
    }

    // 3) schedule entry with when_date = today (task's when_date may differ)
    const todaySchedules = await localDb.schedules
      .where('when_date')
      .equals(today)
      .filter((s) => !s.completed)
      .toArray()
    const scheduleTaskIds = new Set(todaySchedules.map((s) => s.task_id))
    for (const taskId of scheduleTaskIds) {
      if (seenIds.has(taskId)) continue
      const t = await localDb.tasks.get(taskId)
      if (t && t.status === 'open' && !t.deleted_at) {
        seenIds.add(t.id)
        candidates.push(t)
      }
    }

    candidates.sort((a, b) => (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0))

    // Split into today vs evening based on schedule start_time
    const todayTasks: LocalTask[] = []
    const eveningTasks: LocalTask[] = []
    for (const t of candidates) {
      const schedules = await localDb.schedules
        .where('task_id')
        .equals(t.id)
        .filter((s) => s.when_date === today && !s.completed)
        .toArray()
      const eveningSchedule = schedules.find(
        (s) => s.start_time !== null && s.start_time >= eveningStartsAt,
      )
      if (eveningSchedule) {
        eveningTasks.push(t)
      } else {
        todayTasks.push(t)
      }
    }

    // Overdue: open tasks with deadline < today
    const overdueTasks = await localDb.tasks
      .where('deadline')
      .below(today)
      .filter((t) => t.status === 'open' && !t.deleted_at && !!t.deadline)
      .toArray()
    overdueTasks.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

    // Earlier: open tasks with when_date < today, not someday,
    // not overdue (deadline >= today or no deadline),
    // AND has at least one uncompleted past schedule entry
    const earlierCandidates = await localDb.tasks
      .where('when_date')
      .below(today)
      .filter(
        (t) =>
          t.status === 'open' &&
          !t.deleted_at &&
          !!t.when_date &&
          t.when_date !== 'someday' &&
          (t.deadline === null || t.deadline === undefined || t.deadline >= today),
      )
      .toArray()
    const earlierTasks: LocalTask[] = []
    for (const t of earlierCandidates) {
      const pastCount = await localDb.schedules
        .where('task_id')
        .equals(t.id)
        .filter((s) => !s.completed && s.when_date < today && s.when_date !== 'someday')
        .count()
      if (pastCount > 0) earlierTasks.push(t)
    }
    earlierTasks.sort((a, b) =>
      (a.when_date ?? '').localeCompare(b.when_date ?? '') ||
      (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0),
    )

    // Completed today
    const completedTasks = await localDb.tasks
      .filter(
        (t) =>
          !t.deleted_at &&
          (t.status === 'completed' || t.status === 'canceled' || t.status === 'wont_do') &&
          (t.completed_at ?? t.canceled_at ?? t.updated_at ?? '') >= today,
      )
      .toArray()
    completedTasks.sort((a, b) => {
      const aTs = a.completed_at ?? a.canceled_at ?? a.updated_at ?? ''
      const bTs = b.completed_at ?? b.canceled_at ?? b.updated_at ?? ''
      return bTs.localeCompare(aTs)
    })

    const sections: TodayViewSection[] = [
      { title: 'Today', groups: await groupByProject(todayTasks) },
      { title: 'This Evening', groups: await groupByProject(eveningTasks) },
    ]

    return {
      sections,
      overdue: await enrichTasks(overdueTasks),
      earlier: await enrichTasks(earlierTasks),
      completed: await enrichTasks(completedTasks),
    } satisfies TodayView
  }, [eveningStartsAt])
}

/**
 * Upcoming: open tasks where when_date >= today (includes today),
 * not deleted, sorted by when_date then sort_order_today.
 * Also includes overdue (deadline < today) and earlier (when_date < today
 * with uncompleted past schedules).
 */
export function useLocalUpcoming(): UpcomingView | undefined {
  return useLiveQuery(async () => {
    const today = todayString()

    // Server uses INNER JOIN on task_schedules — only tasks with schedule entries appear.
    // Expand per uncompleted schedule entry (task with N entries appears N times).
    const allSchedules = await localDb.schedules
      .where('when_date')
      .aboveOrEqual(today)
      .filter((s) => !s.completed && s.when_date !== 'someday')
      .toArray()

    // Group schedule entries by date, sorted by date then start_time
    allSchedules.sort((a, b) =>
      a.when_date.localeCompare(b.when_date) ||
      (a.start_time ?? '').localeCompare(b.start_time ?? '') ||
      (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )

    const dateMap = new Map<string, Task[]>()
    const dateOrder: string[] = []

    for (const s of allSchedules) {
      const t = await localDb.tasks.get(s.task_id)
      if (!t || t.status !== 'open' || t.deleted_at) continue

      const d = s.when_date
      if (!dateMap.has(d)) { dateMap.set(d, []); dateOrder.push(d) }
      const enriched = await enrichTask(t)
      enriched.first_schedule_time = s.start_time ?? null
      enriched.first_schedule_end_time = s.end_time ?? null
      enriched.schedule_entry_id = s.id
      dateMap.get(d)!.push(enriched)
    }

    // Sort tasks within each date by start_time then sort_order_today
    for (const tasks of dateMap.values()) {
      tasks.sort((a, b) =>
        (a.first_schedule_time ?? '').localeCompare(b.first_schedule_time ?? '') ||
        (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0),
      )
    }

    const dates: UpcomingViewDate[] = dateOrder.map((date) => ({
      date,
      tasks: dateMap.get(date) ?? [],
    }))

    // Overdue: open tasks with deadline < today
    const overdueTasks = await localDb.tasks
      .where('deadline')
      .below(today)
      .filter((t) => t.status === 'open' && !t.deleted_at && !!t.deadline)
      .toArray()
    overdueTasks.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

    // Earlier: open tasks with when_date < today, not someday,
    // not overdue (deadline >= today or no deadline),
    // AND has at least one uncompleted past schedule entry
    const earlierCandidates = await localDb.tasks
      .where('when_date')
      .below(today)
      .filter(
        (t) =>
          t.status === 'open' &&
          !t.deleted_at &&
          !!t.when_date &&
          t.when_date !== 'someday' &&
          (t.deadline === null || t.deadline === undefined || t.deadline >= today),
      )
      .toArray()
    const earlierTasks: LocalTask[] = []
    for (const t of earlierCandidates) {
      const pastCount = await localDb.schedules
        .where('task_id')
        .equals(t.id)
        .filter((s) => !s.completed && s.when_date < today && s.when_date !== 'someday')
        .count()
      if (pastCount > 0) earlierTasks.push(t)
    }
    earlierTasks.sort((a, b) =>
      (a.when_date ?? '').localeCompare(b.when_date ?? '') ||
      (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0),
    )

    return {
      overdue: await enrichTasks(overdueTasks),
      dates,
      earlier: await enrichTasks(earlierTasks),
    } satisfies UpcomingView
  })
}

/**
 * Anytime: open tasks with no when_date but has project_id or area_id,
 * not deleted.
 * Returns an AnytimeView grouped by area → project.
 */
export function useLocalAnytime(): AnytimeView | undefined {
  return useLiveQuery(async () => {
    const tasks = await localDb.tasks
      .where('status')
      .equals('open')
      .filter(
        (t) =>
          !t.when_date &&
          !t.deleted_at &&
          (!!t.project_id || !!t.area_id || !!t.deadline),
      )
      .toArray()

    return await buildAnytimeShape(tasks) as AnytimeView
  })
}

/**
 * Someday: tasks where when_date === 'someday', not deleted.
 * Returns a SomedayView grouped by area → project (same shape as AnytimeView).
 */
export function useLocalSomeday(): SomedayView | undefined {
  return useLiveQuery(async () => {
    const tasks = await localDb.tasks
      .where('when_date')
      .equals('someday')
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .toArray()

    return await buildAnytimeShape(tasks) as unknown as SomedayView
  })
}

/**
 * Shared helper to group tasks into AnytimeView / SomedayView shape.
 * This is a synchronous helper called inside a live-query callback —
 * it does NOT load additional DB data; project/area names come from the
 * task's denormalized project_name / area_name fields.
 */
async function buildAnytimeShape(
  rawTasks: LocalTask[],
): Promise<AnytimeView> {
  // Sort tasks by sort_order_today within groups
  rawTasks.sort((a, b) => (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0))

  // Collect unique area/project IDs and look up full records for sort_order
  const areaIds = new Set<string>()
  const projectIds = new Set<string>()
  for (const t of rawTasks) {
    if (t.area_id) areaIds.add(t.area_id)
    if (t.project_id) projectIds.add(t.project_id)
  }

  const areaRecords = new Map<string, LocalArea>()
  const projectRecords = new Map<string, LocalProject>()
  for (const aId of areaIds) {
    const area = await localDb.areas.get(aId)
    if (area) areaRecords.set(aId, area)
  }
  for (const pId of projectIds) {
    const project = await localDb.projects.get(pId)
    if (project) projectRecords.set(pId, project)
  }

  // Group by area_id, then project_id
  const areaMap = new Map<string | null, Map<string | null, LocalTask[]>>()

  for (const t of rawTasks) {
    const aKey = t.area_id ?? null
    if (!areaMap.has(aKey)) areaMap.set(aKey, new Map())
    const pKey = t.project_id ?? null
    const pMap = areaMap.get(aKey)!
    if (!pMap.has(pKey)) pMap.set(pKey, [])
    pMap.get(pKey)!.push(t)
  }

  // Sort area IDs by area sort_order
  const sortedAreaIds = [...areaMap.keys()]
    .filter((k): k is string => k !== null)
    .sort((a, b) => (areaRecords.get(a)?.sort_order ?? 0) - (areaRecords.get(b)?.sort_order ?? 0))

  const areas: AnytimeViewAreaGroup[] = []
  const noAreaProjectMap = areaMap.get(null)

  // Tasks that belong to areas (in area sort_order)
  for (const aId of sortedAreaIds) {
    const pMap = areaMap.get(aId)!
    const areaName = areaRecords.get(aId)?.title ?? aId

    const projects: AnytimeViewProjectGroup[] = []
    // Sort project IDs by project sort_order
    const sortedPIds = [...pMap.keys()]
      .filter((k): k is string => k !== null)
      .sort((a, b) => (projectRecords.get(a)?.sort_order ?? 0) - (projectRecords.get(b)?.sort_order ?? 0))

    for (const pId of sortedPIds) {
      const ptasks = pMap.get(pId) ?? []
      const projName = projectRecords.get(pId)?.title ?? pId
      projects.push({
        project: { id: pId, title: projName },
        tasks: await enrichTasks(ptasks),
      })
    }

    const standaloneTasks = await enrichTasks(pMap.get(null) ?? [])

    areas.push({
      area: { id: aId, title: areaName },
      projects,
      standalone_tasks: standaloneTasks,
    })
  }

  // Tasks with no area
  const noAreaProjects: AnytimeViewProjectGroup[] = []
  const noAreaStandalone: Task[] = []

  if (noAreaProjectMap) {
    const sortedNoAreaPIds = [...noAreaProjectMap.keys()]
      .filter((k): k is string => k !== null)
      .sort((a, b) => (projectRecords.get(a)?.sort_order ?? 0) - (projectRecords.get(b)?.sort_order ?? 0))

    for (const pId of sortedNoAreaPIds) {
      const ptasks = noAreaProjectMap.get(pId) ?? []
      const projName = projectRecords.get(pId)?.title ?? pId
      noAreaProjects.push({
        project: { id: pId, title: projName },
        tasks: await enrichTasks(ptasks),
      })
    }
    const standalone = noAreaProjectMap.get(null)
    if (standalone) {
      noAreaStandalone.push(...await enrichTasks(standalone))
    }
  }

  const no_area: AnytimeViewNoArea = {
    projects: noAreaProjects,
    standalone_tasks: noAreaStandalone,
  }

  return { areas, no_area }
}

/**
 * Logbook: completed or canceled tasks, sorted by completed_at / canceled_at desc.
 * Returns a LogbookView grouped by date.
 */
export function useLocalLogbook(): LogbookView | undefined {
  return useLiveQuery(async () => {
    const allDone = await localDb.tasks
      .filter(
        (t) =>
          !t.deleted_at &&
          (t.status === 'completed' || t.status === 'canceled' || t.status === 'wont_do'),
      )
      .toArray()

    // Sort by the most recent terminal timestamp desc
    allDone.sort((a, b) => {
      const aTs = a.completed_at ?? a.canceled_at ?? a.updated_at ?? ''
      const bTs = b.completed_at ?? b.canceled_at ?? b.updated_at ?? ''
      return bTs.localeCompare(aTs)
    })

    // Group by calendar date of completion
    const enriched = await enrichTasks(allDone)
    const dateMap = new Map<string, Task[]>()
    for (const t of enriched) {
      const ts = t.completed_at ?? t.canceled_at ?? t.updated_at ?? ''
      const dateKey = ts ? ts.slice(0, 10) : 'unknown'
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
      dateMap.get(dateKey)!.push(t)
    }

    const groups = [...dateMap.entries()].map(([date, groupTasks]) => ({ date, tasks: groupTasks }))

    return { groups, total: allDone.length } satisfies LogbookView
  })
}

/**
 * Trash: tasks with deleted_at set, sorted by deleted_at desc.
 * Returns a TrashView (same shape as LogbookView).
 */
export function useLocalTrash(): TrashView | undefined {
  return useLiveQuery(async () => {
    const deleted = await localDb.tasks
      .filter((t) => !!t.deleted_at)
      .toArray()

    deleted.sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))

    const enriched = await enrichTasks(deleted)
    const dateMap = new Map<string, Task[]>()
    for (const t of enriched) {
      const dateKey = (t.deleted_at ?? '').slice(0, 10)
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
      dateMap.get(dateKey)!.push(t)
    }

    const groups = [...dateMap.entries()].map(([date, groupTasks]) => ({ date, tasks: groupTasks }))

    return { groups, total: deleted.length } satisfies LogbookView
  })
}

// ---------------------------------------------------------------------------
// Entity Hooks
// ---------------------------------------------------------------------------

/**
 * Single task with all related data (checklist, attachments, schedules,
 * reminders, repeat rule). Returns a TaskDetail shape.
 */
export function useLocalTask(id: string): TaskDetail | undefined {
  return useLiveQuery(async () => {
    if (!id) return undefined

    const task = await localDb.tasks.get(id)
    if (!task) return undefined

    const [checklist, attachments, schedules, reminders, repeatRuleArr] = await Promise.all([
      localDb.checklistItems.where('task_id').equals(id).sortBy('sort_order'),
      localDb.attachments.where('task_id').equals(id).sortBy('sort_order'),
      localDb.schedules.where('task_id').equals(id).sortBy('sort_order'),
      localDb.reminders.where('task_id').equals(id).toArray(),
      localDb.repeatRules.where('task_id').equals(id).toArray(),
    ])

    const repeatRule = repeatRuleArr.length > 0 ? repeatRuleArr[0] : null

    // Resolve project / area / heading names for the detail view
    const [project, area, heading] = await Promise.all([
      task.project_id ? localDb.projects.get(task.project_id) : Promise.resolve(undefined),
      task.area_id ? localDb.areas.get(task.area_id) : Promise.resolve(undefined),
      task.heading_id ? localDb.headings.get(task.heading_id) : Promise.resolve(undefined),
    ])

    // If task has when_date but no schedule entries locally, synthesize one
    // so the ScheduleEditor has something to display.
    let resolvedSchedules = schedules.map((s: LocalSchedule) => stripSyncMeta(s))
    if (resolvedSchedules.length === 0 && task.when_date) {
      resolvedSchedules = [{
        id: `synth-${id}`,
        task_id: id,
        when_date: task.when_date,
        start_time: null,
        end_time: null,
        completed: false,
        sort_order: 0,
        created_at: task.created_at,
      }]
    }

    return {
      ...taskToPlain(task),
      project: project ? { id: project.id, title: project.title } : null,
      area: area ? { id: area.id, title: area.title } : null,
      heading: heading ? { id: heading.id, title: heading.title } : null,
      checklist: checklist.map((c: LocalChecklistItem) => stripSyncMeta(c)),
      attachments: attachments.map((a: LocalAttachment) => stripSyncMeta(a)),
      schedules: resolvedSchedules,
      reminders: reminders.map((r: LocalReminder) => stripSyncMeta(r)),
      repeat_rule: repeatRule
        ? (stripSyncMeta(repeatRule as LocalRepeatRule) as ReturnType<typeof stripSyncMeta>)
        : null,
    } as TaskDetail
  }, [id])
}

/**
 * All non-deleted (open) projects sorted by sort_order.
 */
export function useLocalProjects(): Project[] | undefined {
  return useLiveQuery(async () => {
    const projects = await localDb.projects
      .where('status')
      .equals('open')
      .sortBy('sort_order')

    return projects.map(projectToPlain)
  })
}

/**
 * All areas sorted by sort_order.
 */
export function useLocalAreas(): Area[] | undefined {
  return useLiveQuery(async () => {
    const areas = await localDb.areas.orderBy('sort_order').toArray()
    return areas.map(areaToPlain)
  })
}

/**
 * All tags sorted by sort_order.
 */
export function useLocalTags(): Tag[] | undefined {
  return useLiveQuery(async () => {
    const tags = await localDb.tags.orderBy('sort_order').toArray()
    return tags.map(tagToPlain)
  })
}

// ---------------------------------------------------------------------------
// Aggregate Hook
// ---------------------------------------------------------------------------

/**
 * View counts for sidebar badges — mirrors ViewCounts from the server.
 */
export function useLocalViewCounts(reviewAfterDays?: number | null, reviewIncludeRecurring = true): ViewCounts | undefined {
  return useLiveQuery(async () => {
    const today = todayString()

    const [inboxCount, , , , somedayCount, logbookCount, trashCount] =
      await Promise.all([
        // inbox: open, no project, no area, no when_date, not deleted
        localDb.tasks
          .where('status')
          .equals('open')
          .filter((t) => !t.project_id && !t.area_id && !t.when_date && !t.deleted_at)
          .count(),

        Promise.resolve(0), // today — computed below
        Promise.resolve(0), // unused
        Promise.resolve(0), // anytime — computed below

        // someday: open, when_date === 'someday', not deleted
        localDb.tasks
          .where('when_date')
          .equals('someday')
          .filter((t) => t.status === 'open' && !t.deleted_at)
          .count(),

        // logbook: completed/canceled, not deleted
        localDb.tasks
          .filter(
            (t) =>
              !t.deleted_at &&
              (t.status === 'completed' || t.status === 'canceled' || t.status === 'wont_do'),
          )
          .count(),

        // trash: deleted_at set
        localDb.tasks.filter((t) => !!t.deleted_at).count(),
      ])

    // today: open, (when_date = today OR deadline = today), not deleted
    const todayCount = await localDb.tasks
      .where('status')
      .equals('open')
      .filter(
        (t) =>
          !t.deleted_at &&
          (t.when_date === today || t.deadline === today) &&
          (t.deadline === null || t.deadline === undefined || t.deadline >= today),
      )
      .count()

    // anytime: open, no when_date, (has project or area or deadline), not deleted
    const anytimeCount = await localDb.tasks
      .where('status')
      .equals('open')
      .filter(
        (t) =>
          !t.when_date &&
          !t.deleted_at &&
          (!!t.project_id || !!t.area_id || !!t.deadline),
      )
      .count()

    // Overdue: open tasks with when_date < today, not deleted
    const overdueCount = await localDb.tasks
      .where('when_date')
      .below(today)
      .filter(
        (t) => t.status === 'open' && !t.deleted_at && !!t.when_date && t.when_date !== 'someday',
      )
      .count()

    // Review: open tasks not updated in reviewAfterDays, excluding inbox tasks
    let reviewCount = 0
    if (reviewAfterDays && reviewAfterDays > 0) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - reviewAfterDays)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      // Inbox tasks: open, no project, no area, no when_date, not deleted
      const inboxIds = new Set(
        (await localDb.tasks
          .where('status')
          .equals('open')
          .filter((t) => !t.project_id && !t.area_id && !t.when_date && !t.deleted_at)
          .toArray()
        ).map((t) => t.id),
      )

      reviewCount = await localDb.tasks
        .where('status')
        .equals('open')
        .filter(
          (t) =>
            !t.deleted_at &&
            !inboxIds.has(t.id) &&
            (t.updated_at ?? '').slice(0, 10) < cutoffStr &&
            (reviewIncludeRecurring || !t.has_repeat_rule),
        )
        .count()
    }

    return {
      inbox: inboxCount,
      today: todayCount + overdueCount,
      overdue: overdueCount,
      review: reviewCount,
      anytime: anytimeCount,
      someday: somedayCount,
      logbook: logbookCount,
      trash: trashCount,
    } satisfies ViewCounts
  }, [reviewAfterDays, reviewIncludeRecurring])
}

// ---------------------------------------------------------------------------
// Project / Area / Tag Task Hooks
// ---------------------------------------------------------------------------

/**
 * Open tasks for a specific project, sorted by sort_order_project.
 */
export function useLocalProjectTasks(projectId: string): Task[] | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return []

    const tasks = await localDb.tasks
      .where('project_id')
      .equals(projectId)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .sortBy('sort_order_project')

    return enrichTasks(tasks)
  }, [projectId])
}

/**
 * Open tasks for a specific area, sorted by sort_order_today.
 */
export function useLocalAreaTasks(areaId: string): Task[] | undefined {
  return useLiveQuery(async () => {
    if (!areaId) return []

    const tasks = await localDb.tasks
      .where('area_id')
      .equals(areaId)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .sortBy('sort_order_today')

    return enrichTasks(tasks)
  }, [areaId])
}

/**
 * Open tasks for a specific tag.
 * Tags are stored as a TagRef[] array on each Task — there is no separate
 * task_tags join table in the local schema. We scan all open tasks and
 * filter by tag id match.
 */
export function useLocalTagTasks(tagId: string): Task[] | undefined {
  return useLiveQuery(async () => {
    if (!tagId) return []

    const tasks = await localDb.tasks
      .where('status')
      .equals('open')
      .filter(
        (t) =>
          !t.deleted_at &&
          Array.isArray(t.tags) &&
          t.tags.some((tag) => tag.id === tagId),
      )
      .toArray()

    return enrichTasks(tasks)
  }, [tagId])
}

// ---------------------------------------------------------------------------
// Detail Hooks (Project / Area with full sub-resources)
// ---------------------------------------------------------------------------

/**
 * Full project detail with headings, tasks without heading, and completed tasks.
 * Mirrors the ProjectDetail shape from the server API.
 */
export function useLocalProjectDetail(projectId: string): ProjectDetail | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return undefined

    const project = await localDb.projects.get(projectId)
    if (!project) return undefined

    const [allTasks, headings] = await Promise.all([
      localDb.tasks
        .where('project_id')
        .equals(projectId)
        .filter((t) => !t.deleted_at)
        .toArray(),
      localDb.headings
        .where('project_id')
        .equals(projectId)
        .sortBy('sort_order'),
    ])

    const openTasks = allTasks.filter((t: LocalTask) => t.status === 'open')
    const completedTasks = allTasks.filter(
      (t: LocalTask) => t.status === 'completed' || t.status === 'canceled' || t.status === 'wont_do',
    )

    // Split open tasks by heading
    const tasksWithoutHeading = await enrichTasks(
      openTasks
        .filter((t: LocalTask) => !t.heading_id)
        .sort((a: LocalTask, b: LocalTask) => (a.sort_order_project ?? 0) - (b.sort_order_project ?? 0)),
    )

    const headingsWithTasks: HeadingWithTasks[] = []
    for (const h of headings) {
      const hTasks = openTasks
        .filter((t: LocalTask) => t.heading_id === h.id)
        .sort((a: LocalTask, b: LocalTask) => (a.sort_order_project ?? 0) - (b.sort_order_project ?? 0))
      headingsWithTasks.push({
        ...stripSyncMeta(h),
        tasks: await enrichTasks(hTasks),
      })
    }

    // Resolve area for the project
    const area = project.area_id
      ? await localDb.areas.get(project.area_id)
      : undefined

    return {
      ...projectToPlain(project),
      area: area ? { id: area.id, title: area.title } : { id: project.area_id, title: project.area_id },
      task_count: openTasks.length + completedTasks.length,
      completed_task_count: completedTasks.length,
      headings: headingsWithTasks,
      tasks_without_heading: tasksWithoutHeading,
      completed_tasks: await enrichTasks(completedTasks),
    } as ProjectDetail
  }, [projectId])
}

/**
 * Full area detail with projects, tasks, and completed tasks.
 * Mirrors the AreaDetail shape from the server API.
 */
export function useLocalAreaDetail(areaId: string): AreaDetail | undefined {
  return useLiveQuery(async () => {
    if (!areaId) return undefined

    const area = await localDb.areas.get(areaId)
    if (!area) return undefined

    const [projects, allTasks] = await Promise.all([
      localDb.projects
        .where('area_id')
        .equals(areaId)
        .filter((p: LocalProject) => p.status === 'open')
        .sortBy('sort_order'),
      localDb.tasks
        .where('area_id')
        .equals(areaId)
        .filter((t: LocalTask) => !t.deleted_at && !t.project_id)
        .toArray(),
    ])

    const openTasks = allTasks
      .filter((t: LocalTask) => t.status === 'open')
      .sort((a: LocalTask, b: LocalTask) => (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0))
    const completedTasks = allTasks.filter(
      (t: LocalTask) => t.status === 'completed' || t.status === 'canceled' || t.status === 'wont_do',
    )

    // Get task counts per project
    const projectsWithCounts = await Promise.all(
      projects.map(async (p: LocalProject) => {
        const pTasks = await localDb.tasks
          .where('project_id')
          .equals(p.id)
          .filter((t: LocalTask) => !t.deleted_at)
          .toArray()
        const openCount = pTasks.filter((t: LocalTask) => t.status === 'open').length
        const completedCount = pTasks.length - openCount
        return {
          ...projectToPlain(p),
          task_count: pTasks.length,
          completed_task_count: completedCount,
        }
      }),
    )

    return {
      ...areaToPlain(area),
      project_count: projects.length,
      task_count: openTasks.length + completedTasks.length,
      standalone_task_count: openTasks.length,
      projects: projectsWithCounts,
      tasks: await enrichTasks(openTasks),
      completed_tasks: await enrichTasks(completedTasks),
    } as AreaDetail
  }, [areaId])
}
