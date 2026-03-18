import Dexie, { type EntityTable } from 'dexie'
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
  SyncQueueEntry,
  SyncMetaRecord,
} from './schema'

export interface CachedFile {
  attachmentId: string
  blob: Blob
  mimeType: string
  size: number
  cachedAt: string
  lastAccessedAt: string
}

class ThingsToDoDb extends Dexie {
  tasks!: EntityTable<LocalTask, 'id'>
  projects!: EntityTable<LocalProject, 'id'>
  areas!: EntityTable<LocalArea, 'id'>
  tags!: EntityTable<LocalTag, 'id'>
  checklistItems!: EntityTable<LocalChecklistItem, 'id'>
  attachments!: EntityTable<LocalAttachment, 'id'>
  schedules!: EntityTable<LocalSchedule, 'id'>
  reminders!: EntityTable<LocalReminder, 'id'>
  repeatRules!: EntityTable<LocalRepeatRule, 'id'>
  headings!: EntityTable<LocalHeading, 'id'>
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>
  syncMeta!: EntityTable<SyncMetaRecord, 'key'>
  cachedFiles!: EntityTable<CachedFile, 'attachmentId'>

  constructor() {
    super('ThingsToDo')

    this.version(1).stores({
      tasks: 'id, status, when_date, deadline, project_id, area_id, heading_id, high_priority, deleted_at, _syncStatus, sort_order_today, sort_order_project',
      projects: 'id, area_id, status, _syncStatus, sort_order',
      areas: 'id, _syncStatus, sort_order',
      tags: 'id, parent_tag_id, _syncStatus, sort_order',
      checklistItems: 'id, task_id, _syncStatus, sort_order',
      attachments: 'id, task_id, _syncStatus, sort_order',
      schedules: 'id, task_id, when_date, _syncStatus, sort_order',
      reminders: 'id, task_id, _syncStatus',
      repeatRules: 'id, task_id, _syncStatus',
      headings: 'id, project_id, _syncStatus, sort_order',
      syncQueue: '++id, entity, entityId, createdAt',
      syncMeta: 'key',
    })

    this.version(2).stores({
      tasks: 'id, status, when_date, deadline, project_id, area_id, heading_id, high_priority, deleted_at, _syncStatus, sort_order_today, sort_order_project',
      projects: 'id, area_id, status, _syncStatus, sort_order',
      areas: 'id, _syncStatus, sort_order',
      tags: 'id, parent_tag_id, _syncStatus, sort_order',
      checklistItems: 'id, task_id, _syncStatus, sort_order',
      attachments: 'id, task_id, _syncStatus, sort_order',
      schedules: 'id, task_id, when_date, _syncStatus, sort_order',
      reminders: 'id, task_id, _syncStatus',
      repeatRules: 'id, task_id, _syncStatus',
      headings: 'id, project_id, _syncStatus, sort_order',
      syncQueue: '++id, entity, entityId, createdAt',
      syncMeta: 'key',
      cachedFiles: 'attachmentId, lastAccessedAt, cachedAt',
    })
  }
}

export const localDb = new ThingsToDoDb()

export type { ThingsToDoDb }
