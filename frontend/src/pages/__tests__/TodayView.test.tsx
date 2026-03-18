import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { TodayView } from '../TodayView'
import { mockTodayView } from '../../test/mocks/data'

// Use the auto-mock for all localQueries hooks
vi.mock('../../hooks/localQueries')
import { useLocalToday } from '../../hooks/localQueries'
const mockUseLocalToday = vi.mocked(useLocalToday)

describe('TodayView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockUseLocalToday.mockReturnValue(undefined)
    render(<TodayView />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders page heading', async () => {
    mockUseLocalToday.mockReturnValue(mockTodayView)
    render(<TodayView />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument()
    })
  })

  it('renders Today and This Evening sections', async () => {
    mockUseLocalToday.mockReturnValue(mockTodayView)
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('This Evening')).toBeInTheDocument()
    })
  })

  it('renders tasks in Today section', async () => {
    mockUseLocalToday.mockReturnValue(mockTodayView)
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('Deploy staging')).toBeInTheDocument()
      expect(screen.getByText('Morning workout')).toBeInTheDocument()
    })
  })

  it('renders evening tasks', async () => {
    mockUseLocalToday.mockReturnValue(mockTodayView)
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('Read a book')).toBeInTheDocument()
    })
  })

  it('renders overdue tasks section', async () => {
    mockUseLocalToday.mockReturnValue(mockTodayView)
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('Overdue')).toBeInTheDocument()
      expect(screen.getByText('Overdue report')).toBeInTheDocument()
    })
  })
})
