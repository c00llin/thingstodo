import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '../stores/app'
import * as tasksApi from '../api/tasks'
import * as projectsApi from '../api/projects'
import * as areasApi from '../api/areas'
import * as tagsApi from '../api/tags'
import * as checklistApi from '../api/checklist'
import * as attachmentsApi from '../api/attachments'
import * as viewsApi from '../api/views'
import * as searchApi from '../api/search'
import * as authApi from '../api/auth'
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
  Attachment,
  CreateLinkAttachmentRequest,
  UpdateAttachmentRequest,
  TaskQueryParams,
  ProjectStatus,
  LoginRequest,
} from '../api/types'

// --- Query Keys ---

export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    list: (params?: TaskQueryParams) => ['tasks', 'list', params] as const,
    detail: (id: string) => ['tasks', id] as const,
    checklist: (id: string) => ['tasks', id, 'checklist'] as const,
    attachments: (id: string) => ['tasks', id, 'attachments'] as const,
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
    upcoming: (from?: string, days?: number) => ['views', 'upcoming', from, days] as const,
    anytime: ['views', 'anytime'] as const,
    someday: ['views', 'someday'] as const,
    logbook: (limit?: number, offset?: number) => ['views', 'logbook', limit, offset] as const,
    trash: (limit?: number, offset?: number) => ['views', 'trash', limit, offset] as const,
  },
  search: (q: string) => ['search', q] as const,
  auth: {
    me: ['auth', 'me'] as const,
  },
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

export function useUpcoming(from?: string, days?: number) {
  return useQuery({
    queryKey: queryKeys.views.upcoming(from, days),
    queryFn: () => viewsApi.getUpcoming({ from, days }),
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

function useInvalidateViews() {
  const queryClient = useQueryClient()
  return () => {
    // Always invalidate project/area/task detail caches immediately
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })

    const { expandedTaskId, setPendingInvalidation } = useAppStore.getState()
    if (expandedTaskId) {
      // Defer view invalidation until the detail panel closes (for departing animation)
      setPendingInvalidation(true)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['views'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
  }
}

/** Flush deferred view invalidation when the task detail panel closes.
 *  The departing animation is handled by the individual mutations (complete, delete, etc.),
 *  so the flush just invalidates immediately. */
export function useFlushPendingInvalidation() {
  const queryClient = useQueryClient()
  const expandedTaskId = useAppStore((s) => s.expandedTaskId)
  const hasPending = useAppStore((s) => s.hasPendingInvalidation)

  useEffect(() => {
    if (!expandedTaskId && hasPending) {
      useAppStore.getState().setPendingInvalidation(false)
      queryClient.invalidateQueries({ queryKey: ['views'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    }
  }, [expandedTaskId, hasPending, queryClient])
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

  // Also update project and area detail caches
  queryClient.setQueriesData<Record<string, unknown>>(
    { queryKey: queryKeys.projects.all },
    deepUpdateTask,
  )
  queryClient.setQueriesData<Record<string, unknown>>(
    { queryKey: queryKeys.areas.all },
    deepUpdateTask,
  )
}

// Snapshot all view, project, and area queries for rollback
function snapshotViews(queryClient: ReturnType<typeof useQueryClient>) {
  return [
    ...queryClient.getQueriesData({ queryKey: ['views'] }),
    ...queryClient.getQueriesData({ queryKey: queryKeys.projects.all }),
    ...queryClient.getQueriesData({ queryKey: queryKeys.areas.all }),
  ]
}

function rollbackViews(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: ReturnType<typeof snapshotViews>,
) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (data: CreateTaskRequest) => tasksApi.createTask(data),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskRequest }) =>
      tasksApi.updateTask(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['views'] })
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.detail(id) })
      const snapshot = snapshotViews(queryClient)
      const previousDetail = queryClient.getQueryData(queryKeys.tasks.detail(id))
      const updates: Partial<Task> = { ...data }
      if ('notes' in data) {
        updates.has_notes = !!data.notes
      }
      updateTaskInCache(queryClient, id, updates)
      return { snapshot, previousDetail }
    },
    onError: (_err, { id }, context) => {
      if (context?.snapshot) rollbackViews(queryClient, context.snapshot)
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.tasks.detail(id), context.previousDetail)
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.tasks.detail(result.id), result)
      updateTaskInCache(queryClient, result.id, result as Partial<Task>)
    },
    onSettled: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (id: string) => tasksApi.deleteTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['views'] })
      const snapshot = snapshotViews(queryClient)
      updateTaskInCache(queryClient, id, {
        deleted_at: new Date().toISOString(),
      })
      useAppStore.getState().setDepartingTaskId(id)
      return { snapshot }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) rollbackViews(queryClient, context.snapshot)
    },
    onSettled: (_data, _err, id) => {
      setTimeout(() => {
        const store = useAppStore.getState()
        store.setDepartingTaskId(null)
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        invalidate()
      }, 800)
    },
  })
}

export function useRestoreTask() {
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (id: string) => tasksApi.restoreTask(id),
    onSettled: invalidate,
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (id: string) => tasksApi.completeTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['views'] })
      const snapshot = snapshotViews(queryClient)
      updateTaskInCache(queryClient, id, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      useAppStore.getState().setDepartingTaskId(id)
      return { snapshot }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) rollbackViews(queryClient, context.snapshot)
    },
    onSettled: (_data, _err, id) => {
      setTimeout(() => {
        const store = useAppStore.getState()
        store.setDepartingTaskId(null)
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        invalidate()
      }, 800)
    },
  })
}

export function useCancelTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (id: string) => tasksApi.cancelTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['views'] })
      const snapshot = snapshotViews(queryClient)
      updateTaskInCache(queryClient, id, {
        status: 'canceled',
        canceled_at: new Date().toISOString(),
      })
      useAppStore.getState().setDepartingTaskId(id)
      return { snapshot }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) rollbackViews(queryClient, context.snapshot)
    },
    onSettled: (_data, _err, id) => {
      setTimeout(() => {
        const store = useAppStore.getState()
        store.setDepartingTaskId(null)
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        invalidate()
      }, 800)
    },
  })
}

export function useWontDoTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (id: string) => tasksApi.wontDoTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['views'] })
      const snapshot = snapshotViews(queryClient)
      updateTaskInCache(queryClient, id, {
        status: 'wont_do',
        canceled_at: new Date().toISOString(),
      })
      useAppStore.getState().setDepartingTaskId(id)
      return { snapshot }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) rollbackViews(queryClient, context.snapshot)
    },
    onSettled: (_data, _err, id) => {
      setTimeout(() => {
        const store = useAppStore.getState()
        store.setDepartingTaskId(null)
        if (store.expandedTaskId === id) {
          store.expandTask(null)
        }
        invalidate()
      }, 800)
    },
  })
}

export function useReopenTask() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateViews()
  return useMutation({
    mutationFn: (id: string) => tasksApi.reopenTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['views'] })
      const snapshot = snapshotViews(queryClient)
      updateTaskInCache(queryClient, id, {
        status: 'open',
        completed_at: null,
        canceled_at: null,
      })
      return { snapshot }
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) rollbackViews(queryClient, context.snapshot)
    },
    onSettled: invalidate,
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectsApi.createProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectsApi.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => projectsApi.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
      queryClient.invalidateQueries({ queryKey: ['views'] })
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAreaRequest) => areasApi.createArea(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })
    },
  })
}

export function useUpdateArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAreaRequest }) =>
      areasApi.updateArea(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.areas.all })
    },
  })
}

export function useDeleteArea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => areasApi.deleteArea(id),
    onSuccess: () => {
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTagRequest) => tagsApi.createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

export function useUpdateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagRequest }) =>
      tagsApi.updateTag(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tagsApi.deleteTag(id),
    onSuccess: () => {
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChecklistItemRequest) =>
      checklistApi.createChecklistItem(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.checklist(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    },
  })
}

export function useUpdateChecklistItem(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChecklistItemRequest }) =>
      checklistApi.updateChecklistItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.checklist(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    },
  })
}

export function useDeleteChecklistItem(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => checklistApi.deleteChecklistItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.checklist(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
    },
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
    mutationFn: (file: File) => attachmentsApi.uploadFile(taskId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
      updateTaskInCache(queryClient, taskId, { has_files: true })
    },
  })
}

export function useAddLink(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLinkAttachmentRequest) =>
      attachmentsApi.addLink(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
      updateTaskInCache(queryClient, taskId, { has_links: true })
    },
  })
}

export function useUpdateAttachment(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAttachmentRequest }) =>
      attachmentsApi.updateAttachment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(taskId) })
    },
  })
}

export function useDeleteAttachment(taskId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => attachmentsApi.deleteAttachment(id),
    onSuccess: (_result, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.attachments(taskId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(taskId) })
      const cached = queryClient.getQueryData<Attachment[]>(queryKeys.tasks.attachments(taskId))
      const remaining = cached?.filter((a) => a.id !== deletedId) ?? []
      updateTaskInCache(queryClient, taskId, {
        has_links: remaining.some((a) => a.type === 'link'),
        has_files: remaining.some((a) => a.type === 'file'),
      })
    },
  })
}

// --- Search ---

export function useSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => searchApi.search(query),
    enabled: query.length > 0,
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
      queryClient.clear()
    },
  })
}
