import { localDb } from './index'
import type {
  LocalTask,
  LocalProject,
  LocalArea,
  LocalTag,
  LocalChecklistItem,
  LocalAttachment,
  LocalSchedule,
  LocalReminder,
  LocalHeading,
  SyncQueueEntry,
  SyncAction,
  SyncEntity,
} from './schema'
import { syncNow } from '../sync/engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function now(): string {
  return new Date().toISOString()
}

export function generateNanoid(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

/**
 * Replicate server's syncFirstScheduleDate logic locally (IndexedDB only).
 * Does NOT queue sync changes — the server handles schedule sync itself
 * via its own syncFirstScheduleDate when it processes the task's when_date change.
 *
 * - when_date is null → delete all schedules for the task
 * - first schedule exists → update its when_date
 * - no schedule exists → create one
 */
async function syncFirstScheduleDate(taskId: string, whenDate: string | null): Promise<void> {
  if (whenDate === null) {
    // Delete all schedule entries for this task locally
    const schedules = await localDb.schedules.where('task_id').equals(taskId).toArray()
    for (const s of schedules) {
      await localDb.schedules.delete(s.id)
    }
    return
  }

  // Find the first schedule entry (lowest sort_order)
  const existing = await localDb.schedules
    .where('task_id')
    .equals(taskId)
    .sortBy('sort_order')

  if (existing.length === 0) {
    // Create a new schedule entry locally
    const id = generateNanoid()
    const timestamp = now()
    const schedule: LocalSchedule = {
      id,
      task_id: taskId,
      when_date: whenDate,
      start_time: null,
      end_time: null,
      completed: false,
      sort_order: 0,
      created_at: timestamp,
      _syncStatus: 'pending',
      _localUpdatedAt: timestamp,
    }
    await localDb.schedules.put(schedule)
  } else {
    // Update the first entry's when_date locally
    const first = existing[0]
    if (first.when_date !== whenDate) {
      const timestamp = now()
      const updated: LocalSchedule = {
        ...first,
        when_date: whenDate,
        _syncStatus: 'pending',
        _localUpdatedAt: timestamp,
      }
      await localDb.schedules.put(updated)
    }
  }
}

/**
 * Resolve tag_ids to TagRef[] from the local tags table.
 * Returns the denormalized tags array for storing on the task.
 */
async function resolveTagRefs(tagIds: string[]): Promise<Array<{ id: string; title: string; color: string | null }>> {
  const refs: Array<{ id: string; title: string; color: string | null }> = []
  for (const tagId of tagIds) {
    const tag = await localDb.tags.get(tagId)
    if (tag) {
      refs.push({ id: tag.id, title: tag.title, color: tag.color })
    } else {
      // Tag not in local DB yet — preserve the ID with a placeholder
      refs.push({ id: tagId, title: '', color: null })
    }
  }
  return refs
}

async function queueChange(
  entity: SyncEntity,
  entityId: string,
  action: SyncAction,
  data: Record<string, unknown>,
  fields?: string[],
): Promise<void> {
  const entry: Omit<SyncQueueEntry, 'id'> = {
    entity,
    entityId,
    action,
    data,
    fields,
    clientUpdatedAt: now(),
    createdAt: now(),
  }
  await localDb.syncQueue.add(entry as SyncQueueEntry)
  // Fire-and-forget sync — errors are handled by the sync engine
  try { syncNow().catch(() => {}) } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Task mutations
// ---------------------------------------------------------------------------

export type CreateTaskData = Partial<Omit<LocalTask, 'id' | '_syncStatus' | '_localUpdatedAt'>> & {
  tag_ids?: string[]
}

export async function createTask(data: CreateTaskData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()

  // Resolve tag_ids to TagRef[] if provided
  const tags = data.tag_ids
    ? await resolveTagRefs(data.tag_ids)
    : (data.tags ?? [])

  const task: LocalTask = {
    id,
    title: data.title ?? '',
    notes: data.notes ?? '',
    status: data.status ?? 'open',
    when_date: data.when_date ?? null,
    high_priority: data.high_priority ?? false,
    deadline: data.deadline ?? null,
    project_id: data.project_id ?? null,
    area_id: data.area_id ?? null,
    heading_id: data.heading_id ?? null,
    sort_order_today: data.sort_order_today ?? 0,
    sort_order_project: data.sort_order_project ?? 0,
    sort_order_heading: data.sort_order_heading ?? 0,
    completed_at: data.completed_at ?? null,
    canceled_at: data.canceled_at ?? null,
    deleted_at: data.deleted_at ?? null,
    created_at: data.created_at ?? timestamp,
    updated_at: data.updated_at ?? timestamp,
    tags,
    checklist_count: data.checklist_count ?? 0,
    checklist_done: data.checklist_done ?? 0,
    has_notes: data.has_notes ?? false,
    has_links: data.has_links ?? false,
    has_files: data.has_files ?? false,
    has_repeat_rule: data.has_repeat_rule ?? false,
    has_reminders: data.has_reminders ?? false,
    first_reminder_type: data.first_reminder_type ?? null,
    first_reminder_value: data.first_reminder_value ?? null,
    first_reminder_exact_at: data.first_reminder_exact_at ?? null,
    project_name: data.project_name ?? null,
    area_name: data.area_name ?? null,
    first_schedule_time: data.first_schedule_time ?? null,
    first_schedule_end_time: data.first_schedule_end_time ?? null,
    first_schedule_completed: data.first_schedule_completed,
    schedule_entry_id: data.schedule_entry_id ?? null,
    past_schedule_count: data.past_schedule_count,
    has_actionable_schedules: data.has_actionable_schedules,
    all_today_schedules_completed: data.all_today_schedules_completed,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.tasks.put(task)

  // Build sync payload: use tag_ids (not denormalized tags) for the server
  const syncData = { ...(task as unknown as Record<string, unknown>) }
  if (data.tag_ids) {
    syncData.tag_ids = data.tag_ids
  }
  await queueChange('task', id, 'create', syncData)

  // Sync first schedule entry if when_date is set
  if (task.when_date) {
    await syncFirstScheduleDate(id, task.when_date)
  }

  return id
}

export async function updateTask(
  id: string,
  fields: Partial<Omit<LocalTask, 'id' | '_syncStatus' | '_localUpdatedAt'>> & { tag_ids?: string[] },
): Promise<void> {
  const existing = await localDb.tasks.get(id)
  if (!existing) return
  const timestamp = now()

  // Resolve tag_ids → tags (TagRef[]) for the local store
  const resolvedFields = { ...fields }
  const { tag_ids, ...fieldsWithoutTagIds } = resolvedFields
  if (tag_ids !== undefined) {
    ;(fieldsWithoutTagIds as Record<string, unknown>).tags = await resolveTagRefs(tag_ids)
  }

  const updated: LocalTask = {
    ...existing,
    ...fieldsWithoutTagIds,
    updated_at: timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.tasks.put(updated)

  // Build sync payload: send tag_ids (not tags) for the server
  const syncFields: Record<string, unknown> = { ...(fieldsWithoutTagIds as Record<string, unknown>) }
  const syncFieldKeys = [...Object.keys(fieldsWithoutTagIds)]
  if (tag_ids !== undefined) {
    syncFields.tag_ids = tag_ids
    syncFieldKeys.push('tag_ids')
    // Don't send denormalized tags to the server
    delete syncFields.tags
    const tagsKeyIdx = syncFieldKeys.indexOf('tags')
    if (tagsKeyIdx !== -1) syncFieldKeys.splice(tagsKeyIdx, 1)
  }

  await queueChange('task', id, 'update', syncFields, syncFieldKeys)

  // Sync first schedule entry when when_date changes
  if ('when_date' in fields) {
    await syncFirstScheduleDate(id, fields.when_date ?? null)
  }
}

export async function completeTask(id: string): Promise<void> {
  await updateTask(id, { status: 'completed', completed_at: now() })
}

export async function cancelTask(id: string): Promise<void> {
  await updateTask(id, { status: 'canceled', canceled_at: now() })
}

export async function deleteTask(id: string): Promise<void> {
  await updateTask(id, { deleted_at: now() })
}

export async function reopenTask(id: string): Promise<void> {
  await updateTask(id, { status: 'open', completed_at: null, canceled_at: null })
}

export async function restoreTask(id: string): Promise<void> {
  await updateTask(id, { deleted_at: null })
}

// ---------------------------------------------------------------------------
// Project mutations
// ---------------------------------------------------------------------------

export type CreateProjectData = Partial<Omit<LocalProject, 'id' | '_syncStatus' | '_localUpdatedAt'>>

export async function createProject(data: CreateProjectData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const project: LocalProject = {
    id,
    title: data.title ?? '',
    notes: data.notes ?? '',
    area_id: data.area_id ?? '',
    area: data.area ?? { id: data.area_id ?? '', title: '' },
    status: data.status ?? 'open',
    when_date: data.when_date ?? null,
    deadline: data.deadline ?? null,
    sort_order: data.sort_order ?? 0,
    task_count: data.task_count ?? 0,
    completed_task_count: data.completed_task_count ?? 0,
    tags: data.tags ?? [],
    created_at: data.created_at ?? timestamp,
    updated_at: data.updated_at ?? timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.projects.put(project)
  await queueChange('project', id, 'create', project as unknown as Record<string, unknown>)
  return id
}

export async function updateProject(
  id: string,
  fields: Partial<Omit<LocalProject, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.projects.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalProject = {
    ...existing,
    ...fields,
    updated_at: timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.projects.put(updated)
  await queueChange(
    'project',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

export async function deleteProject(id: string): Promise<void> {
  const existing = await localDb.projects.get(id)
  if (!existing) return
  await localDb.projects.delete(id)
  await queueChange('project', id, 'delete', { id })
}

// ---------------------------------------------------------------------------
// Area mutations
// ---------------------------------------------------------------------------

export type CreateAreaData = Partial<Omit<LocalArea, 'id' | '_syncStatus' | '_localUpdatedAt'>>

export async function createArea(data: CreateAreaData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const area: LocalArea = {
    id,
    title: data.title ?? '',
    sort_order: data.sort_order ?? 0,
    project_count: data.project_count ?? 0,
    task_count: data.task_count ?? 0,
    standalone_task_count: data.standalone_task_count ?? 0,
    created_at: data.created_at ?? timestamp,
    updated_at: data.updated_at ?? timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.areas.put(area)
  await queueChange('area', id, 'create', area as unknown as Record<string, unknown>)
  return id
}

export async function updateArea(
  id: string,
  fields: Partial<Omit<LocalArea, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.areas.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalArea = {
    ...existing,
    ...fields,
    updated_at: timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.areas.put(updated)
  await queueChange(
    'area',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

// ---------------------------------------------------------------------------
// Tag mutations
// ---------------------------------------------------------------------------

export type CreateTagData = Partial<Omit<LocalTag, 'id' | '_syncStatus' | '_localUpdatedAt'>>

export async function createTag(data: CreateTagData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const tag: LocalTag = {
    id,
    title: data.title ?? '',
    color: data.color ?? null,
    parent_tag_id: data.parent_tag_id ?? null,
    sort_order: data.sort_order ?? 0,
    task_count: data.task_count ?? 0,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.tags.put(tag)
  await queueChange('tag', id, 'create', tag as unknown as Record<string, unknown>)
  return id
}

export async function updateTag(
  id: string,
  fields: Partial<Omit<LocalTag, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.tags.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalTag = {
    ...existing,
    ...fields,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.tags.put(updated)
  await queueChange(
    'tag',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

// ---------------------------------------------------------------------------
// Checklist item mutations
// ---------------------------------------------------------------------------

export type CreateChecklistItemData = Partial<
  Omit<LocalChecklistItem, 'id' | '_syncStatus' | '_localUpdatedAt'>
> & { task_id: string }

export async function createChecklistItem(data: CreateChecklistItemData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const item: LocalChecklistItem = {
    id,
    task_id: data.task_id,
    title: data.title ?? '',
    completed: data.completed ?? false,
    sort_order: data.sort_order ?? 0,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.checklistItems.put(item)
  await queueChange('checklistItem', id, 'create', item as unknown as Record<string, unknown>)
  return id
}

export async function updateChecklistItem(
  id: string,
  fields: Partial<Omit<LocalChecklistItem, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.checklistItems.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalChecklistItem = {
    ...existing,
    ...fields,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.checklistItems.put(updated)
  await queueChange(
    'checklistItem',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const existing = await localDb.checklistItems.get(id)
  if (!existing) return
  await localDb.checklistItems.delete(id)
  await queueChange('checklistItem', id, 'delete', { id })
}

// ---------------------------------------------------------------------------
// Attachment mutations
// ---------------------------------------------------------------------------

export type CreateAttachmentData = Partial<
  Omit<LocalAttachment, 'id' | '_syncStatus' | '_localUpdatedAt'>
> & { task_id: string }

export async function createAttachment(data: CreateAttachmentData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const attachment: LocalAttachment = {
    id,
    task_id: data.task_id,
    type: data.type ?? 'link',
    title: data.title ?? '',
    url: data.url ?? '',
    mime_type: data.mime_type ?? '',
    file_size: data.file_size ?? 0,
    sort_order: data.sort_order ?? 0,
    created_at: data.created_at ?? timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.attachments.put(attachment)
  await queueChange('attachment', id, 'create', attachment as unknown as Record<string, unknown>)
  return id
}

export async function deleteAttachment(id: string): Promise<void> {
  const existing = await localDb.attachments.get(id)
  if (!existing) return
  await localDb.attachments.delete(id)
  await queueChange('attachment', id, 'delete', { id })
}

// ---------------------------------------------------------------------------
// Schedule mutations
// ---------------------------------------------------------------------------

export type CreateScheduleData = Partial<
  Omit<LocalSchedule, 'id' | '_syncStatus' | '_localUpdatedAt'>
> & { task_id: string }

export async function createSchedule(data: CreateScheduleData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const schedule: LocalSchedule = {
    id,
    task_id: data.task_id,
    when_date: data.when_date ?? '',
    start_time: data.start_time ?? null,
    end_time: data.end_time ?? null,
    completed: data.completed ?? false,
    sort_order: data.sort_order ?? 0,
    created_at: data.created_at ?? timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.schedules.put(schedule)
  await queueChange('schedule', id, 'create', schedule as unknown as Record<string, unknown>)
  return id
}

export async function updateSchedule(
  id: string,
  fields: Partial<Omit<LocalSchedule, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.schedules.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalSchedule = {
    ...existing,
    ...fields,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.schedules.put(updated)
  await queueChange(
    'schedule',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

export async function deleteSchedule(id: string): Promise<void> {
  const existing = await localDb.schedules.get(id)
  if (!existing) return
  await localDb.schedules.delete(id)
  await queueChange('schedule', id, 'delete', { id })
}

// ---------------------------------------------------------------------------
// Heading mutations
// ---------------------------------------------------------------------------

export type CreateHeadingData = Partial<
  Omit<LocalHeading, 'id' | '_syncStatus' | '_localUpdatedAt'>
> & { project_id: string }

export async function createHeading(data: CreateHeadingData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const heading: LocalHeading = {
    id,
    project_id: data.project_id,
    title: data.title ?? '',
    sort_order: data.sort_order ?? 0,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.headings.put(heading)
  await queueChange('heading', id, 'create', heading as unknown as Record<string, unknown>)
  return id
}

export async function updateHeading(
  id: string,
  fields: Partial<Omit<LocalHeading, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.headings.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalHeading = {
    ...existing,
    ...fields,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.headings.put(updated)
  await queueChange(
    'heading',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

export async function deleteHeading(id: string): Promise<void> {
  const existing = await localDb.headings.get(id)
  if (!existing) return
  await localDb.headings.delete(id)
  await queueChange('heading', id, 'delete', { id })
}

// ---------------------------------------------------------------------------
// Reminder mutations
// ---------------------------------------------------------------------------

export type CreateReminderData = Partial<
  Omit<LocalReminder, 'id' | '_syncStatus' | '_localUpdatedAt'>
> & { task_id: string }

export async function createReminder(data: CreateReminderData): Promise<string> {
  const id = generateNanoid()
  const timestamp = now()
  const reminder: LocalReminder = {
    id,
    task_id: data.task_id,
    type: data.type ?? 'at_start',
    value: data.value ?? 0,
    exact_at: data.exact_at ?? null,
    created_at: data.created_at ?? timestamp,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.reminders.put(reminder)
  await queueChange('reminder', id, 'create', reminder as unknown as Record<string, unknown>)
  return id
}

export async function updateReminder(
  id: string,
  fields: Partial<Omit<LocalReminder, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.reminders.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalReminder = {
    ...existing,
    ...fields,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.reminders.put(updated)
  await queueChange(
    'reminder',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )
}

export async function deleteReminder(id: string): Promise<void> {
  const existing = await localDb.reminders.get(id)
  if (!existing) return
  await localDb.reminders.delete(id)
  await queueChange('reminder', id, 'delete', { id })
}
