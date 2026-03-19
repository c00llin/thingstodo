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
  LocalHeading,
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
 * Returns an InboxView shape with tasks and an empty review array.
 * (Review requires server-side settings; we surface it as empty for now.)
 */
export function useLocalInbox(): InboxView | undefined {
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
      .toArray()

    return {
      tasks: tasks.map(taskToPlain),
      review: [],
    } satisfies InboxView
  })
}

/**
 * Group tasks by project_id, resolving project names from the local DB.
 */
async function groupByProject(tasks: LocalTask[]): Promise<TodayViewGroup[]> {
  const projectMap = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const key = t.project_id ?? null
    if (!projectMap.has(key)) projectMap.set(key, [])
    projectMap.get(key)!.push(taskToPlain(t))
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
 * Today: open tasks where when_date equals today's date, not deleted,
 * sorted by sort_order_today. Includes overdue (deadline < today),
 * earlier (when_date < today with uncompleted past schedules), and
 * completed-today tasks.
 */
export function useLocalToday(): TodayView | undefined {
  return useLiveQuery(async () => {
    const today = todayString()

    const todayTasks = await localDb.tasks
      .where('when_date')
      .equals(today)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .sortBy('sort_order_today')

    // Overdue: open tasks with deadline < today
    const overdueTasks = await localDb.tasks
      .where('deadline')
      .below(today)
      .filter((t) => t.status === 'open' && !t.deleted_at && !!t.deadline)
      .toArray()
    overdueTasks.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

    // Earlier: open tasks with when_date < today, not someday,
    // not overdue (deadline >= today or no deadline)
    const earlierTasks = await localDb.tasks
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

    const section: TodayViewSection = { title: 'Today', groups: await groupByProject(todayTasks) }

    return {
      sections: [section],
      overdue: overdueTasks.map(taskToPlain),
      earlier: earlierTasks.map(taskToPlain),
      completed: completedTasks.map(taskToPlain),
    } satisfies TodayView
  })
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

    // Use aboveOrEqual to include today's date
    const tasks = await localDb.tasks
      .where('when_date')
      .aboveOrEqual(today)
      .filter((t) => t.status === 'open' && !t.deleted_at && t.when_date !== 'someday')
      .sortBy('when_date')

    // Group by date
    const dateMap = new Map<string, LocalTask[]>()
    const dateOrder: string[] = []
    for (const t of tasks) {
      const d = t.when_date!
      if (!dateMap.has(d)) {
        dateMap.set(d, [])
        dateOrder.push(d)
      }
      dateMap.get(d)!.push(t)
    }

    const dates: UpcomingViewDate[] = dateOrder.map((date) => ({
      date,
      tasks: (dateMap.get(date) ?? []).map(taskToPlain),
    }))

    // Overdue: open tasks with deadline < today
    const overdueTasks = await localDb.tasks
      .where('deadline')
      .below(today)
      .filter((t) => t.status === 'open' && !t.deleted_at && !!t.deadline)
      .toArray()
    overdueTasks.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

    // Earlier: open tasks with when_date < today, not someday,
    // not overdue (deadline >= today or no deadline)
    const earlierTasks = await localDb.tasks
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
    earlierTasks.sort((a, b) =>
      (a.when_date ?? '').localeCompare(b.when_date ?? '') ||
      (a.sort_order_today ?? 0) - (b.sort_order_today ?? 0),
    )

    return {
      overdue: overdueTasks.map(taskToPlain),
      dates,
      earlier: earlierTasks.map(taskToPlain),
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
          (!!t.project_id || !!t.area_id),
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
  // Collect unique area/project IDs and look up titles
  const areaIds = new Set<string>()
  const projectIds = new Set<string>()
  for (const t of rawTasks) {
    if (t.area_id) areaIds.add(t.area_id)
    if (t.project_id) projectIds.add(t.project_id)
  }

  const areaTitles = new Map<string, string>()
  const projectTitles = new Map<string, string>()
  for (const aId of areaIds) {
    const area = await localDb.areas.get(aId)
    if (area) areaTitles.set(aId, area.title)
  }
  for (const pId of projectIds) {
    const project = await localDb.projects.get(pId)
    if (project) projectTitles.set(pId, project.title)
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

  const areas: AnytimeViewAreaGroup[] = []
  const noAreaProjectMap = areaMap.get(null)

  // Tasks that belong to areas
  for (const [aId, pMap] of areaMap.entries()) {
    if (aId === null) continue
    const areaName = areaTitles.get(aId) ?? aId

    const projects: AnytimeViewProjectGroup[] = []
    for (const [pId, ptasks] of pMap.entries()) {
      if (pId === null) continue
      const projName = projectTitles.get(pId) ?? pId
      projects.push({
        project: { id: pId, title: projName },
        tasks: ptasks.map(taskToPlain),
      })
    }

    const standaloneTasks = (pMap.get(null) ?? []).map(taskToPlain)

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
    for (const [pId, ptasks] of noAreaProjectMap.entries()) {
      if (pId === null) {
        noAreaStandalone.push(...ptasks.map(taskToPlain))
      } else {
        const projName = projectTitles.get(pId) ?? pId
        noAreaProjects.push({
          project: { id: pId, title: projName },
          tasks: ptasks.map(taskToPlain),
        })
      }
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
    const dateMap = new Map<string, Task[]>()
    for (const t of allDone) {
      const ts = t.completed_at ?? t.canceled_at ?? t.updated_at ?? ''
      const dateKey = ts ? ts.slice(0, 10) : 'unknown'
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
      dateMap.get(dateKey)!.push(taskToPlain(t))
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

    const dateMap = new Map<string, Task[]>()
    for (const t of deleted) {
      const dateKey = t.deleted_at!.slice(0, 10)
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, [])
      dateMap.get(dateKey)!.push(taskToPlain(t))
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
 * Review count is 0 for now (requires settings).
 */
export function useLocalViewCounts(): ViewCounts | undefined {
  return useLiveQuery(async () => {
    const today = todayString()

    const [inboxCount, todayCount, , anytimeCount, somedayCount, logbookCount, trashCount] =
      await Promise.all([
        // inbox: open, no project, no area, no when_date, not deleted
        localDb.tasks
          .where('status')
          .equals('open')
          .filter((t) => !t.project_id && !t.area_id && !t.when_date && !t.deleted_at)
          .count(),

        // today: open, when_date === today, not deleted
        localDb.tasks
          .where('when_date')
          .equals(today)
          .filter((t) => t.status === 'open' && !t.deleted_at)
          .count(),

        // upcoming: open, when_date > today, not deleted
        localDb.tasks
          .where('when_date')
          .above(today)
          .filter((t) => t.status === 'open' && !t.deleted_at && t.when_date !== 'someday')
          .count(),

        // anytime: open, no when_date, has project or area, not deleted
        localDb.tasks
          .where('status')
          .equals('open')
          .filter((t) => !t.when_date && !t.deleted_at && (!!t.project_id || !!t.area_id))
          .count(),

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

    // Overdue: open tasks with when_date < today, not deleted
    const overdueCount = await localDb.tasks
      .where('when_date')
      .below(today)
      .filter(
        (t) => t.status === 'open' && !t.deleted_at && !!t.when_date && t.when_date !== 'someday',
      )
      .count()

    return {
      inbox: inboxCount,
      today: todayCount + overdueCount,
      overdue: overdueCount,
      review: 0,
      anytime: anytimeCount,
      someday: somedayCount,
      logbook: logbookCount,
      trash: trashCount,
    } satisfies ViewCounts
  })
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

    return tasks.map(taskToPlain)
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

    return tasks.map(taskToPlain)
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

    return tasks.map(taskToPlain)
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
    const tasksWithoutHeading = openTasks
      .filter((t: LocalTask) => !t.heading_id)
      .sort((a: LocalTask, b: LocalTask) => (a.sort_order_project ?? 0) - (b.sort_order_project ?? 0))
      .map(taskToPlain)

    const headingsWithTasks: HeadingWithTasks[] = headings.map((h: LocalHeading) => ({
      ...stripSyncMeta(h),
      tasks: openTasks
        .filter((t: LocalTask) => t.heading_id === h.id)
        .sort((a: LocalTask, b: LocalTask) => (a.sort_order_project ?? 0) - (b.sort_order_project ?? 0))
        .map(taskToPlain),
    }))

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
      completed_tasks: completedTasks.map(taskToPlain),
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
      tasks: openTasks.map(taskToPlain),
      completed_tasks: completedTasks.map(taskToPlain),
    } as AreaDetail
  }, [areaId])
}
