import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '../../test/test-utils'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ProjectView } from '../ProjectView'

function renderProjectView(projectId = 'proj-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/project/${projectId}`]}>
        <Routes>
          <Route path="/project/:id" element={<ProjectView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProjectView', () => {
  it('shows loading state initially', () => {
    renderProjectView()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders project title', async () => {
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Website Redesign')).toBeInTheDocument()
    })
  })

  it('renders project notes', async () => {
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Redesign the company website')).toBeInTheDocument()
    })
  })

  it('renders progress bar with task counts', async () => {
    renderProjectView()

    await waitFor(() => {
      // mockProjectDetail has 5 total, 2 completed
      expect(screen.getByText('2/5')).toBeInTheDocument()
    })
  })

  it('renders tasks without heading', async () => {
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Setup project repo')).toBeInTheDocument()
    })
  })

  it('renders heading sections with tasks', async () => {
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument()
      expect(screen.getByText('Create mockups')).toBeInTheDocument()
    })
  })
})
