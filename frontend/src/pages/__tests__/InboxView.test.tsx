import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { InboxView } from '../InboxView'
import { mockInboxView, mockEmptyInboxView } from '../../test/mocks/data'

// Use the auto-mock for all localQueries hooks
vi.mock('../../hooks/localQueries')
import { useLocalInbox } from '../../hooks/localQueries'
const mockUseLocalInbox = vi.mocked(useLocalInbox)

describe('InboxView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockUseLocalInbox.mockReturnValue(undefined)
    render(<InboxView />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders tasks from the API', async () => {
    mockUseLocalInbox.mockReturnValue(mockInboxView)
    render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByText('Buy groceries')).toBeInTheDocument()
      expect(screen.getByText('Clean kitchen')).toBeInTheDocument()
    })
  })

  it('shows empty state when no tasks', async () => {
    mockUseLocalInbox.mockReturnValue(mockEmptyInboxView)
    render(<InboxView />)

    await waitFor(() => {
      expect(screen.getByText(/inbox is empty/i)).toBeInTheDocument()
    })
  })

  it('renders the page heading', async () => {
    mockUseLocalInbox.mockReturnValue(mockInboxView)
    render(<InboxView />)
    expect(screen.getByText('Inbox')).toBeInTheDocument()
  })
})
