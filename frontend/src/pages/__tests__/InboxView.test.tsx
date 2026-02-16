import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '../../test/test-utils'
import { InboxView } from '../InboxView'
import { mockEmptyInboxView } from '../../test/mocks/data'
import { server } from '../../test/mocks/server'

describe('InboxView', () => {
  it('shows loading state initially', () => {
    render(<InboxView />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders tasks from the API', async () => {
    render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument()
      expect(screen.getByText('Clean kitchen')).toBeInTheDocument()
    })
  })

  it('shows empty state when no tasks', async () => {
    server.use(
      http.get('/api/views/inbox', () => {
        return HttpResponse.json(mockEmptyInboxView)
      }),
    )

    render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByText(/inbox is empty/i)).toBeInTheDocument()
    })
  })

  it('renders the new task input', async () => {
    render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New task...')).toBeInTheDocument()
    })
  })

  it('creates a task on Enter', async () => {
    let createdTitle = ''
    server.use(
      http.post('/api/tasks', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>
        createdTitle = body.title as string
        return HttpResponse.json(
          { id: 'new-id', title: createdTitle, notes: '', status: 'open', when_date: null, when_evening: false, deadline: null, project_id: null, area_id: null, heading_id: null, sort_order_today: 1024, sort_order_project: 1024, sort_order_heading: 1024, completed_at: null, canceled_at: null, created_at: '2026-01-01', updated_at: '2026-01-01', tags: [], checklist_count: 0, checklist_done: 0, has_notes: false, has_attachments: false, has_repeat_rule: false },
          { status: 201 },
        )
      }),
    )

    const { user } = render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New task...')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('New task...')
    await user.type(input, 'My new task{Enter}')

    await waitFor(() => {
      expect(createdTitle).toBe('My new task')
    })
  })

  it('clears input after creating a task', async () => {
    const { user } = render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New task...')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('New task...')
    await user.type(input, 'My new task{Enter}')

    await waitFor(() => {
      expect(input).toHaveValue('')
    })
  })

  it('does not create a task on Enter with empty input', async () => {
    let apiCalled = false
    server.use(
      http.post('/api/tasks', () => {
        apiCalled = true
        return HttpResponse.json({}, { status: 201 })
      }),
    )

    const { user } = render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New task...')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('New task...')
    await user.type(input, '{Enter}')

    // Small wait to ensure no API call was made
    await new Promise((r) => setTimeout(r, 100))
    expect(apiCalled).toBe(false)
  })

  it('renders the page heading', async () => {
    render(<InboxView />)
    expect(screen.getByText('Inbox')).toBeInTheDocument()
  })
})
