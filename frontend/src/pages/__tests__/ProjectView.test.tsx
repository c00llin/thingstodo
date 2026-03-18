import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '../../test/test-utils'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DndContext } from '@dnd-kit/core'
import { SortableListRegistryProvider } from '../../contexts/SortableListRegistry'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ProjectView } from '../ProjectView'
import { mockProjectDetail } from '../../test/mocks/data'

// Use the auto-mock for all localQueries hooks
vi.mock('../../hooks/localQueries')
import { useLocalProjectDetail } from '../../hooks/localQueries'
const mockUseLocalProjectDetail = vi.mocked(useLocalProjectDetail)

function renderProjectView(projectId = 'proj-1') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <DndContext>
        <SortableListRegistryProvider>
          <MemoryRouter initialEntries={[`/project/${projectId}`]}>
            <Routes>
              <Route path="/project/:id" element={<ProjectView />} />
            </Routes>
          </MemoryRouter>
        </SortableListRegistryProvider>
      </DndContext>
    </QueryClientProvider>,
  )
}

describe('ProjectView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockUseLocalProjectDetail.mockReturnValue(undefined)
    renderProjectView()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders project title', async () => {
    mockUseLocalProjectDetail.mockReturnValue(mockProjectDetail)
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Website Redesign')).toBeInTheDocument()
    })
  })

  it('renders project notes', async () => {
    mockUseLocalProjectDetail.mockReturnValue(mockProjectDetail)
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Redesign the company website')).toBeInTheDocument()
    })
  })

  it('renders progress bar with task counts', async () => {
    mockUseLocalProjectDetail.mockReturnValue(mockProjectDetail)
    renderProjectView()

    await waitFor(() => {
      // mockProjectDetail has 5 total, 2 completed
      expect(screen.getByText('2/5')).toBeInTheDocument()
    })
  })

  it('renders tasks without heading', async () => {
    mockUseLocalProjectDetail.mockReturnValue(mockProjectDetail)
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Setup project repo')).toBeInTheDocument()
    })
  })

  it('renders heading sections with tasks', async () => {
    mockUseLocalProjectDetail.mockReturnValue(mockProjectDetail)
    renderProjectView()

    await waitFor(() => {
      expect(screen.getByText('Design')).toBeInTheDocument()
      expect(screen.getByText('Create mockups')).toBeInTheDocument()
    })
  })
})
