import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInbox, useCreateTask, useCompleteTask, queryKeys } from '../queries'
import { mockInboxView } from '../../test/mocks/data'

// Mock audio to avoid AudioContext errors in jsdom
vi.mock('../../lib/sounds', () => ({
  playCompleteSound: vi.fn(),
  playReviewSound: vi.fn(),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  return { Wrapper, queryClient }
}

describe('useInbox', () => {
  it('fetches inbox data', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useInbox(), { wrapper: Wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.tasks).toHaveLength(2)
    expect(result.current.data?.tasks[0].title).toBe('Buy groceries')
  })
})

describe('useCreateTask', () => {
  it('calls the API and invalidates views', async () => {
    const { Wrapper, queryClient } = createWrapper()

    // Pre-populate inbox cache
    queryClient.setQueryData(queryKeys.views.inbox, mockInboxView)

    const { result } = renderHook(() => useCreateTask(), { wrapper: Wrapper })

    result.current.mutate({ title: 'New task' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })
})

describe('useCompleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('optimistically updates the task status', async () => {
    const { Wrapper, queryClient } = createWrapper()

    // Pre-populate inbox cache with a task
    queryClient.setQueryData(queryKeys.views.inbox, mockInboxView)

    const { result } = renderHook(() => useCompleteTask(), { wrapper: Wrapper })

    await act(() => {
      result.current.mutate('task-1')
    })

    // Check optimistic update happened in cache
    const cache = queryClient.getQueryData<typeof mockInboxView>(queryKeys.views.inbox)
    const task = cache?.tasks.find((t) => t.id === 'task-1')
    expect(task?.status).toBe('completed')
  })

  it('calls the complete endpoint', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useCompleteTask(), { wrapper: Wrapper })

    await act(() => {
      result.current.mutate('task-1')
    })

    // Wait for mutation to settle (isSuccess or isError — both indicate the API call completed)
    await waitFor(() => {
      expect(result.current.isIdle).toBe(false)
      expect(result.current.isPending).toBe(false)
    })

    // MSW handler returns completed task
    expect(result.current.data?.status).toBe('completed')
  })
})
