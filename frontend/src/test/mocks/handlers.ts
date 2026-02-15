import { http, HttpResponse } from 'msw'
import {
  mockInboxView,
  mockTodayView,
  mockTask,
  mockTaskDetail,
  mockProject,
  mockProjectDetail,
  mockArea,
  mockTag,
} from './data'

export const handlers = [
  // Views
  http.get('/api/views/inbox', () => {
    return HttpResponse.json(mockInboxView)
  }),

  http.get('/api/views/today', () => {
    return HttpResponse.json(mockTodayView)
  }),

  http.get('/api/views/upcoming', () => {
    return HttpResponse.json({ dates: [] })
  }),

  http.get('/api/views/anytime', () => {
    return HttpResponse.json({ areas: [], no_area: { projects: [], standalone_tasks: [] } })
  }),

  http.get('/api/views/someday', () => {
    return HttpResponse.json({ areas: [], no_area: { projects: [], standalone_tasks: [] } })
  }),

  http.get('/api/views/logbook', () => {
    return HttpResponse.json({ groups: [], total: 0 })
  }),

  // Tasks
  http.get('/api/tasks', () => {
    return HttpResponse.json({ tasks: [mockTask] })
  }),

  http.get('/api/tasks/:id', ({ params }) => {
    return HttpResponse.json({ ...mockTaskDetail, id: params.id })
  }),

  http.post('/api/tasks', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      {
        ...mockTask,
        id: 'new-task-id',
        title: body.title as string,
      },
      { status: 201 },
    )
  }),

  http.patch('/api/tasks/:id', async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...mockTaskDetail, id: params.id, ...body })
  }),

  http.delete('/api/tasks/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.patch('/api/tasks/:id/complete', ({ params }) => {
    return HttpResponse.json({
      ...mockTask,
      id: params.id,
      status: 'completed',
      completed_at: '2026-02-15 12:00:00',
    })
  }),

  http.patch('/api/tasks/:id/cancel', ({ params }) => {
    return HttpResponse.json({
      ...mockTask,
      id: params.id,
      status: 'canceled',
      canceled_at: '2026-02-15 12:00:00',
    })
  }),

  http.patch('/api/tasks/:id/reopen', ({ params }) => {
    return HttpResponse.json({
      ...mockTask,
      id: params.id,
      status: 'open',
      completed_at: null,
      canceled_at: null,
    })
  }),

  http.patch('/api/tasks/reorder', () => {
    return HttpResponse.json({ ok: true })
  }),

  // Checklist
  http.get('/api/tasks/:id/checklist', () => {
    return HttpResponse.json({ items: [] })
  }),

  // Attachments
  http.get('/api/tasks/:id/attachments', () => {
    return HttpResponse.json({ attachments: [] })
  }),

  // Repeat rules
  http.get('/api/tasks/:id/repeat', () => {
    return HttpResponse.json({ repeat_rule: null })
  }),

  // Projects
  http.get('/api/projects', () => {
    return HttpResponse.json({ projects: [mockProject] })
  }),

  http.get('/api/projects/:id', ({ params }) => {
    return HttpResponse.json({ ...mockProjectDetail, id: params.id })
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json(
      { ...mockProject, id: 'new-proj-id', title: body.title as string },
      { status: 201 },
    )
  }),

  // Areas
  http.get('/api/areas', () => {
    return HttpResponse.json({ areas: [mockArea] })
  }),

  http.get('/api/areas/:id', ({ params }) => {
    return HttpResponse.json({ ...mockArea, id: params.id, projects: [], tasks: [] })
  }),

  // Tags
  http.get('/api/tags', () => {
    return HttpResponse.json({ tags: [mockTag] })
  }),

  http.get('/api/tags/:id/tasks', () => {
    return HttpResponse.json({ tasks: [] })
  }),

  // Search
  http.get('/api/search', () => {
    return HttpResponse.json({ results: [] })
  }),

  // Auth
  http.get('/api/auth/me', () => {
    return HttpResponse.json({ user: { id: 'user-1', username: 'testuser' } })
  }),

  // SSE (return empty to avoid connection errors in tests)
  http.get('/api/events', () => {
    return new HttpResponse(null, { status: 200 })
  }),
]
