import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  it('renders all smart list nav items', async () => {
    render(<Sidebar />)

    await waitFor(() => {
      expect(screen.getByText('Inbox')).toBeInTheDocument()
      expect(screen.getByText('Today')).toBeInTheDocument()
      expect(screen.getByText('Upcoming')).toBeInTheDocument()
      expect(screen.getByText('Anytime')).toBeInTheDocument()
      expect(screen.getByText('Someday')).toBeInTheDocument()
      expect(screen.getByText('Logbook')).toBeInTheDocument()
    })
  })

  it('renders the app title', () => {
    render(<Sidebar />)
    expect(screen.getByText('ThingsToDo')).toBeInTheDocument()
  })

  it('renders New Project button', () => {
    render(<Sidebar />)
    expect(screen.getByText('New Project')).toBeInTheDocument()
  })

  it('renders Areas & Projects section', async () => {
    render(<Sidebar />)
    await waitFor(() => {
      // The section header uses &amp; in JSX but renders as &
      expect(screen.getByText(/Areas/)).toBeInTheDocument()
    })
  })

  it('renders projects from API', async () => {
    render(<Sidebar />)
    // MSW returns mockProject with title "Website Redesign"
    await waitFor(() => {
      expect(screen.getByText('Website Redesign')).toBeInTheDocument()
    })
  })

  it('renders areas from API', async () => {
    render(<Sidebar />)
    // MSW returns mockArea with title "Work"
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument()
    })
  })

  it('smart list items are navigation links', async () => {
    render(<Sidebar />, { routerProps: { initialEntries: ['/inbox'] } })

    await waitFor(() => {
      const inboxLink = screen.getByText('Inbox').closest('a')
      expect(inboxLink).toHaveAttribute('href', '/inbox')

      const todayLink = screen.getByText('Today').closest('a')
      expect(todayLink).toHaveAttribute('href', '/today')
    })
  })
})
