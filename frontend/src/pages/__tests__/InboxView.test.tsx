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

  it('renders the page heading', async () => {
    render(<InboxView />)
    expect(screen.getByText('Inbox')).toBeInTheDocument()
  })
})
