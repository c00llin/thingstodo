import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { TodayView } from '../TodayView'

describe('TodayView', () => {
  it('shows loading state initially', () => {
    render(<TodayView />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders page heading', async () => {
    render(<TodayView />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Today' })).toBeInTheDocument()
    })
  })

  it('renders Today and This Evening sections', async () => {
    render(<TodayView />)

    await waitFor(() => {
      // Section headers from mock data
      expect(screen.getByText('This Evening')).toBeInTheDocument()
    })
  })

  it('renders tasks in Today section', async () => {
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('Deploy staging')).toBeInTheDocument()
      expect(screen.getByText('Morning workout')).toBeInTheDocument()
    })
  })

  it('renders evening tasks', async () => {
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('Read a book')).toBeInTheDocument()
    })
  })

  it('renders overdue tasks section', async () => {
    render(<TodayView />)

    await waitFor(() => {
      expect(screen.getByText('Overdue')).toBeInTheDocument()
      expect(screen.getByText('Overdue report')).toBeInTheDocument()
    })
  })
})
