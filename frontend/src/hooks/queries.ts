import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../stores/app'
import * as tasksApi from '../api/tasks'
import * as projectsApi from '../api/projects'
import * as areasApi from '../api/areas'
import * as tagsApi from '../api/tags'
import * as checklistApi from '../api/checklist'
import * as attachmentsApi from '../api/attachments'
import * as repeatApi from '../api/repeat'
import * as viewsApi from '../api/views'
import * as searchApi from '../api/search'
import * as authApi from '../api/auth'
import * as settingsApi from '../api/settings'
import * as schedulesApi from '../api/schedules'
// remindersApi removed — reminders now use local mutations
import * as savedFiltersApi from '../api/savedFilters'
import * as localMutations from '../db/mutations'
import { playCompleteSound, playReviewSound } from '../lib/sounds'
import type {
  Task,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateAreaRequest,
  UpdateAreaRequest,
  CreateTagRequest,
  UpdateTagRequest,
  CreateChecklistItemRequest,
  UpdateChecklistItemRequest,
  CreateLinkAttachmentRequest,
  UpdateAttachmentRequest,
  UpsertRepeatRuleRequest,
  CreateTaskScheduleRequest,
  UpdateTaskScheduleRequest,
  TaskQueryParams,
  ProjectStatus,
  LoginRequest,
  UserSettings,
  SimpleReorderItem,
  Project,
  CreateSavedFilterRequest,
} from '../api/types'

// --- Query Keys ---

export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    list: (params?: TaskQueryParams) => ['tasks', 'list', params] as const,
    detail: (id: string) => ['tasks', id] as const,
    checklist: (id: string) => ['tasks', id, 'checklist'] as const,
    attachments: (id: string) => ['tasks', id, 'attachments'] as const,
    reminders: (id: string) => ['tasks', id, 'reminders'] as const,
    schedules: (id: string) => ['tasks', id, 'schedules'] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: (params?: { area_id?: string; status?: ProjectStatus }) =>
      ['projects', 'list', params] as const,
    detail: (id: string) => ['projects', id] as const,
  },
  areas: {
    all: ['areas'] as const,
    detail: (id: string) => ['areas', id] as const,
  },
  tags: {
    all: ['tags'] as const,
    tasks: (id: string) => ['tags', id, 'tasks'] as const,
  },
  views: {
    inbox: ['views', 'inbox'] as const,
    today: ['views', 'today'] as const,
    upcoming: (from?: string) => ['views', 'upcoming', from] as const,
    anytime: ['views', 'anytime'] as const,
    someday: ['views', 'someday'] as const,
    logbook: (limit?: number, offset?: number) => ['views', 'logbook', limit, offset] as const,
    trash: (limit?: number, offset?: number) => ['views', 'trash', limit, offset] as const,
    counts: ['views', 'counts'] as const,
  },
  search: (q: string) => ['search', q] as const,
  auth: {
    me: ['auth', 'me'] as const,
  },
  settings: ['settings'] as const,
  savedFilters: (view: string) => ['savedFilters', view] as const,
}

// --- View Hooks ---

export function useInbox() {
  return useQuery({
    queryKey: queryKeys.views.inbox,
    queryFn: () => viewsApi.getInbox(),
  })
}

export function useToday() {
  return useQuery({
    queryKey: queryKeys.views.today,
    queryFn: () => viewsApi.getToday(),
  })
}

export function useUpcoming(from?: string) {
  return useQuery({
    queryKey: queryKeys.views.upcoming(from),
    queryFn: () => viewsApi.getUpcoming({ from }),
  })
}

export function useAnytime() {
  return useQuery({
    queryKey: queryKeys.views.anytime,
    queryFn: () => viewsApi.getAnytime(),
  })
}

export function useSomeday() {
  return useQuery({
    queryKey: queryKeys.views.someday,
    queryFn: () => viewsApi.getSomeday(),
  })
}

export function useLogbook(limit?: number, offset?: number) {
  return useQuery({
    queryKey: queryKeys.views.logbook(limit, offset),
    queryFn: () => viewsApi.getLogbook({ limit, offset }),
  })
}

export function useTrash(limit?: number, offset?: number) {
  return useQuery({
    queryKey: queryKeys.views.trash(limit, offset),
    queryFn: () => viewsApi.getTrash({ limit, offset }),
  })
}

export function useViewCounts() {
  return useQuery({
    queryKey: queryKeys.views.counts,
    queryFn: () => viewsApi.getCounts(),
  })
}

// --- Task Hooks ---

export function useTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => tasksApi.listTasks(params),
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: () => tasksApi.getTask(id),
    enabled: !!id,
  })
}

/** Invalidate view/task/tag queries, deferring if the detail panel is open
 *  or a departing animation is in progress.
 *  Exported so SSE can reuse the same deferral logic. */
export function invalidateViewQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  opts?: { refetchType?: 'all' },
) {
  const { expandedTaskId, departingTaskId, setPendingInvalidation } = useAppStore.getState()
  if (expandedTaskId || departingTaskId) {
    setPendingInvalidation(true)
    return
  }
  queryClient.invalidateQueries({ queryKey: ['views'], ...opts })
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, ...opts })
  queryClient.invalidateQueries({ queryKey: queryKeys.tags.all, ...opts })
}

/** Fire view/task/tag invalidation unconditionally (bypasses deferral guards). */
export function forceInvalidateViewQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  opts?: { refetchType?: 'all' },
) {
  queryClient.invalidateQueries({ queryKey: ['views'], ...opts })
  queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all, ...opts })
  queryClient.invalidateQueries({ queryKey: queryKeys.tags.all, ...opts })
}

function useInvalidateViews() {
  const queryClient = useQueryClient()
  return (opts?: { force?: boolean }) => {
    // Always invalidate project/area caches immediately
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })

    if (opts?.force) {
      forceInvalidateViewQueries(queryClient)
    } else {
      invalidateViewQueries(queryClient)
    }
  }
}

/** Flush deferred view invalidation when deferral conditions clear:
 *  - Detail panel closes (expandedTaskId becomes null)
 *  - Departing animation finishes (departingTaskId becomes null)
 *  Sets departingTaskId for panel-close case so the task gets a smooth
 *  exit animation before the view query refreshes. */
export function useFlushPendingInvalidation() {
  const queryClient = useQueryClient()
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const departingTaskId = useAppStore((s) => s.departingTaskId)
  const hasPending = useAppStore((s) => s.hasPendingInvalidation)
  const prevExpandedRef = useRef<string | null>(null)

  useEffect(() => {
    if (expandedTaskId) {
      prevExpandedRef.current = expandedTaskId
    }
  }, [expandedTaskId])

  useEffect(() => {
    // Nothing to flush if no pending invalidation or still deferred
    if (!hasPending || expandedTaskId || departingTaskId) return

    useAppStore.getState().setPendingInvalidation(false)

    // If panel just closed (prevExpandedRef has a value), animate the task out
    const taskId = prevExpandedRef.current
    if (taskId) {
      prevExpandedRef.current = null
      useAppStore.getState().setDepartingTaskId(taskId)
      setTimeout(() => {
        forceInvalidateViewQueries(queryClient, { refetchType: 'all' })
        setTimeout(() => {
          useAppStore.getState().setDepartingTaskId(null)
        }, 200)
      }, 400)
    } else {
      // departingTaskId just cleared (e.g. after complete/delete animation)
      // — flush any SSE invalidations that were deferred during the animation
      forceInvalidateViewQueries(queryClient, { refetchType: 'all' })
    }
  }, [expandedTaskId, departingTaskId, hasPending, queryClient])
}

// Find a task by ID in the view caches (returns the first match or undefined)
export function findTaskInViewCache(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
): Task | undefined {
  const allData = [
    ...queryClient.getQueriesData({ queryKey: ['views'] }),
    ...queryClient.getQueriesData({ queryKey: queryKeys.projects.all }),
    ...queryClient.getQueriesData({ queryKey: queryKeys.areas.all }),
    ...queryClient.getQueriesData({ queryKey: queryKeys.tags.all }),
  ]
  for (const [, data] of allData) {
    if (!data) continue
    const json = JSON.stringify(data)
    // Quick check before expensive parse
    if (!json.includes(taskId)) continue
    let found: Task | undefined
    JSON.parse(json, (_key, value) => {
      if (
        !found &&
        value &&
        typeof value === 'object' &&
        'id' in value &&
        value.id === taskId &&
        'status' in value
      ) {
        found = value as Task
      }
      return value
    })
    if (found) return found
  }
  return undefined
}

// Optimistic update helper: updates a task's fields in all cached view queries
export function updateTaskInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  taskId: string,
  updates: Partial<Task>,
) {
  // Update task detail cache if present
  queryClient.setQueryData(
    queryKeys.tasks.detail(taskId),
    (old: Task | undefined) => (old ? { ...old, ...updates } : old),
  )

  // Update all view caches that may contain this task
  const deepUpdateTask = (old: Record<string, unknown> | undefined) => {
    if (!old) return old
    return JSON.parse(
      JSON.stringify(old, (_key, value) => {
        if (
          value &&
          typeof value === 'object' &&
          'id' in value &&
          value.id === taskId &&
          'status' in value
        ) {
          return { ...value, ...updates }
        }
        return value
      }),
    )
  }

  queryClient.setQueriesData<Record<string, unknown>>(
    { queryKey: ['views'] },
    deepUpdateTask,
  )

  // Also update project, area, and tag detail caches
  queryClient.setQueriesData<Record<string, unknown>>(
    { queryKey: queryKeys.projects.all },
    deepUpdateTask,
  )
  queryClient.setQueriesData<Record<string, unknown>>(
    { queryKey: queryKeys.areas.all },
    deepUpdateTask,
  )
  queryClient.setQueriesData<Record<string, unknown>>(
    { queryKey: queryKeys.tags.all },
    deepUpdateTask,
  )
}

// Snapshot all view, project, and area queries for rollback

export function useCreateTask() {
  return useMutation({
    mutationFn: async (data: CreateTaskRequest) => {
      const id = await localMutations.createTask(data as localMutations.CreateTaskData)
      return { id, ...data }
    },
  })
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskRequest }) => {
      await localMutations.updateTask(id, data as Parameters<typeof localMutations.updateTask>[1])
      return { id, ...data }
    },
  })
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: async (id: string) => {
      useAppStore.getState().setDepartingTaskId(id)
      await localMutations.deleteTask(id)
      setTimeout(() => {
        const store = useAppStore.getState()
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        setTimeout(() => {
          useAppStore.getState().setDepartingTaskId(null)
        }, 200)
      }, 800)
    },
  })
}

export function useRestoreTask() {
  return useMutation({
    mutationFn: (id: string) => localMutations.restoreTask(id),
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      useAppStore.getState().setDepartingTaskId(id)
      const settings = queryClient.getQueryData<UserSettings>(queryKeys.settings)
      if (settings?.play_complete_sound !== false) {
        playCompleteSound()
      }
      await localMutations.completeTask(id)
      setTimeout(() => {
        setTimeout(() => {
          useAppStore.getState().setDepartingTaskId(null)
        }, 200)
      }, 800)
    },
  })
}

export function useCancelTask() {
  return useMutation({
    mutationFn: async (id: string) => {
      useAppStore.getState().setDepartingTaskId(id)
      await localMutations.cancelTask(id)
      setTimeout(() => {
        const store = useAppStore.getState()
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        setTimeout(() => {
          useAppStore.getState().setDepartingTaskId(null)
        }, 200)
      }, 800)
    },
  })
}

export function useWontDoTask() {
  return useMutation({
    mutationFn: async (id: string) => {
      useAppStore.getState().setDepartingTaskId(id)
      await localMutations.updateTask(id, {
        status: 'wont_do' as localMutations.CreateTaskData['status'],
        canceled_at: localMutations.now(),
      })
      setTimeout(() => {
        const store = useAppStore.getState()
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        setTimeout(() => {
          useAppStore.getState().setDepartingTaskId(null)
        }, 200)
      }, 800)
    },
  })
}

export function useReopenTask() {
  return useMutation({
    mutationFn: (id: string) => localMutations.reopenTask(id),
  })
}

export function useReviewTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    // reviewTask is a backend-only operation (bumps updated_at to clear review status)
    // No local mutation equivalent; keep API call + animation side effects
    mutationFn: (id: string) => tasksApi.reviewTask(id),
    onMutate: async (id) => {
      useAppStore.getState().setDepartingTaskId(id)
      const settings = queryClient.getQueryData<UserSettings>(queryKeys.settings)
      if (settings?.play_complete_sound !== false) {
        playReviewSound()
      }
    },
    onSettled: () => {
      setTimeout(() => {
        invalidate({ force: true })
        setTimeout(() => {
          useAppStore.getState().setDepartingTaskId(null)
        }, 200)
      }, 400)
    },
  })
}

// --- Project Hooks ---

export function useProjects(params?: { area_id?: string; status?: ProjectStatus }) {
  return useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: () => projectsApi.listProjects(params),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => projectsApi.getProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  return useMutation({
    mutationFn: async (data: CreateProjectRequest) => {
      const id = await localMutations.createProject(data as localMutations.CreateProjectData)
      return { id, ...data }
    },
  })
}

export function useUpdateProject() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectRequest }) => {
      await localMutations.updateProject(id, data as Parameters<typeof localMutations.updateProject>[1])
      return { id, ...data }
    },
  })
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: (id: string) => localMutations.deleteProject(id),
  })
}

export function useReorderProjects() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: SimpleReorderItem[]) => projectsApi.reorderProjects(items),
    onMutate: async (items) => {
      // Cancel in-flight project fetches so they don't overwrite optimistic area_id changes
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.all })
      const orderMap = new Map(items.map((i) => [i.id, i.sort_order]))
      queryClient.setQueriesData<{ projects: Project[] }>(
        { queryKey: queryKeys.projects.all },
        (old) => {
          if (!old) return old
          return {
            ...old,
            projects: old.projects
              .map((p) => orderMap.has(p.id) ? { ...p, sort_order: orderMap.get(p.id)! } : p)
              .sort((a, b) => a.sort_order - b.sort_order),
          }
        },
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
  })
}

// --- Area Hooks ---

export function useAreas() {
  return useQuery({
    queryKey: queryKeys.areas.all,
    queryFn: () => areasApi.listAreas(),
  })
}

export function useArea(id: string) {
  return useQuery({
    queryKey: queryKeys.areas.detail(id),
    queryFn: () => areasApi.getArea(id),
    enabled: !!id,
  })
}

export function useCreateArea() {
  return useMutation({
    mutationFn: async (data: CreateAreaRequest) => {
      const id = await localMutations.createArea(data as localMutations.CreateAreaData)
      return { id, ...data }
    },
  })
}

export function useUpdateArea() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAreaRequest }) => {
      await localMutations.updateArea(id, data as Parameters<typeof localMutations.updateArea>[1])
      return { id, ...data }
    },
  })
}

export function useDeleteArea() {
  const queryClient = useQueryClient()
  return useMutation({
    // Area deletion is still an API call — no local delete for areas yet
    mutationFn: (id: string) => areasApi.deleteArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })
      queryClient.invalidateQueries({ queryKey: ['views'] })
    },
  })
}

export function useReorderAreas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: SimpleReorderItem[]) => areasApi.reorderAreas(items),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })
    },
  })
}

// --- Tag Hooks ---

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => tagsApi.listTags(),
  })
}

export function useTagTasks(id: string) {
  return useQuery({
    queryKey: queryKeys.tags.tasks(id),
    queryFn: () => tagsApi.getTagTasks(id),
    enabled: !!id,
  })
}

export function useCreateTag() {
  return useMutation({
    mutationFn: async (data: CreateTagRequest) => {
      const id = await localMutations.createTag(data as localMutations.CreateTagData)
      return { id, ...data }
    },
  })
}

export function useUpdateTag() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTagRequest }) => {
      await localMutations.updateTag(id, data as Parameters<typeof localMutations.updateTag>[1])
      return { id, ...data }
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    // Tag deletion is still an API call — no local delete for tags yet
    mutationFn: (id: string) => tagsApi.deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      queryClient.invalidateQueries({ queryKey: ['views'] })
    },
  })
}

export function useReorderTags() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: SimpleReorderItem[]) => tagsApi.reorderTags(items),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

// --- Checklist Hooks ---

export function useChecklist(taskId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.checklist(taskId),
    queryFn: () => checklistApi.listChecklist(taskId),
    enabled: !!taskId,
  })
}

export function useCreateChecklistItem(taskId: string) {
  return useMutation({
    mutationFn: async (data: CreateChecklistItemRequest) => {
      const id = await localMutations.createChecklistItem({
        task_id: taskId,
        ...(data as Omit<localMutations.CreateChecklistItemData, 'task_id'>),
      })
      return { id, task_id: taskId, ...data }
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useUpdateChecklistItem(_taskId: string) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateChecklistItemRequest }) => {
      await localMutations.updateChecklistItem(id, data as Parameters<typeof localMutations.updateChecklistItem>[1])
      return { id, ...data }
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDeleteChecklistItem(_taskId: string) {
  return useMutation({
    mutationFn: (id: string) => localMutations.deleteChecklistItem(id),
  })
}

// --- Reminder Hooks ---

export function useCreateReminder(taskId: string) {
  return useMutation({
    mutationFn: async (data: import('../api/types').CreateReminderRequest) => {
      const id = await localMutations.createReminder({
        task_id: taskId,
        ...(data as Omit<localMutations.CreateReminderData, 'task_id'>),
      })
      return { id, task_id: taskId, ...data }
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDeleteReminder(_taskId: string) {
  return useMutation({
    mutationFn: (id: string) => localMutations.deleteReminder(id),
  })
}

// --- Attachment Hooks ---

export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.attachments(taskId),
    queryFn: () => attachmentsApi.listAttachments(taskId),
    enabled: !!taskId,
  })
}

export function useUploadFile(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // File uploads require multipart server processing — keep as API call
    mutationFn: (file: File) => attachmentsApi.uploadFile(taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    },
  })
}

export function useAddLink(taskId: string) {
  return useMutation({
    mutationFn: async (data: CreateLinkAttachmentRequest) => {
      const id = await localMutations.createAttachment({
        task_id: taskId,
        type: 'link',
        title: data.title ?? '',
        url: data.url ?? '',
      })
      return { ...data, id, task_id: taskId, type: 'link' as const }
    },
  })
}

export function useUpdateAttachment(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // Attachment update (rename) — no local mutation for update; keep as API call
    mutationFn: ({ id, data }: { id: string; data: UpdateAttachmentRequest }) =>
      attachmentsApi.updateAttachment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(taskId) })
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDeleteAttachment(_taskId: string) {
  return useMutation({
    mutationFn: (id: string) => localMutations.deleteAttachment(id),
  })
}

// --- Repeat Rule Hooks ---

export function useUpsertRepeatRule(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpsertRepeatRuleRequest) => repeatApi.upsertRepeatRule(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
      updateTaskInCache(queryClient, taskId, { has_repeat_rule: true })
    },
  })
}

export function useDeleteRepeatRule(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => repeatApi.deleteRepeatRule(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
      updateTaskInCache(queryClient, taskId, { has_repeat_rule: false })
    },
  })
}

// --- Schedule Hooks ---

export function useCreateTaskSchedule(taskId: string) {
  return useMutation({
    mutationFn: async (data: CreateTaskScheduleRequest) => {
      const id = await localMutations.createSchedule({
        task_id: taskId,
        ...(data as Omit<localMutations.CreateScheduleData, 'task_id'>),
      })
      return { id, task_id: taskId, ...data }
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useUpdateTaskSchedule(_taskId: string) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTaskScheduleRequest }) => {
      await localMutations.updateSchedule(id, data as Parameters<typeof localMutations.updateSchedule>[1])
      return { id, ...data }
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useDeleteTaskSchedule(_taskId: string) {
  return useMutation({
    mutationFn: (id: string) => localMutations.deleteSchedule(id),
  })
}

export function useReorderTaskSchedules(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    // Schedule reorder has no local equivalent — keep as API call
    mutationFn: (items: SimpleReorderItem[]) =>
      schedulesApi.reorderSchedules(taskId, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.schedules(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    },
  })
}

// --- Search ---

export function useSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => searchApi.search(query),
    enabled: query.length > 0,
    staleTime: 0,
  })
}

// --- Auth ---

export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: () => authApi.getMe(),
    retry: false,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.auth.me })
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      window.location.href = '/login'
      queryClient.clear()
    },
  })
}

// --- Settings ---

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsApi.getSettings(),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<UserSettings>) => settingsApi.updateSettings(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings })
      const previous = queryClient.getQueryData<UserSettings>(queryKeys.settings)
      if (previous) {
        queryClient.setQueryData(queryKeys.settings, { ...previous, ...data })
      }
      return { previous, data }
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings, context.previous)
      }
    },
    onSettled: (_result, _err, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings })
      // Review setting affects inbox view and sidebar counts
      if (context?.data && 'review_after_days' in context.data) {
        queryClient.invalidateQueries({ queryKey: queryKeys.views.inbox })
        queryClient.invalidateQueries({ queryKey: queryKeys.views.counts })
      }
    },
  })
}

// --- Saved Filters ---

export function useSavedFilters(view: string) {
  return useQuery({
    queryKey: queryKeys.savedFilters(view),
    queryFn: () => savedFiltersApi.listSavedFilters(view),
    staleTime: 30_000,
    enabled: view !== '',
  })
}

export function useCreateSavedFilter() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSavedFilterRequest) => savedFiltersApi.createSavedFilter(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(result.view) })
    },
  })
}

export function useDeleteSavedFilter(view: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => savedFiltersApi.deleteSavedFilter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.savedFilters(view) })
    },
  })
}
