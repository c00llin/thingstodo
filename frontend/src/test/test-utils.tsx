import { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, type MemoryRouterProps } from 'react-router'
import { DndContext } from '@dnd-kit/core'
import { SortableListRegistryProvider } from '../contexts/SortableListRegistry'
import userEvent from '@testing-library/user-event'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

function renderWithProviders(
  ui: ReactElement,
  { routerProps, ...options }: CustomRenderOptions = {},
) {
  const queryClient = createTestQueryClient()

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DndContext>
          <SortableListRegistryProvider>
            <MemoryRouter {...routerProps}>{children}</MemoryRouter>
          </SortableListRegistryProvider>
        </DndContext>
      </QueryClientProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
    user: userEvent.setup(),
  }
}

export { renderWithProviders as render }
export { screen, waitFor, within, act } from '@testing-library/react'
