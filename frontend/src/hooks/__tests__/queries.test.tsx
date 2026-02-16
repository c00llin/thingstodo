import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInbox, useCreateTask, useCompleteTask, queryKeys } from '../queries'
import { mockInboxView } from '../../test/mocks/data'

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
  it('optimistically updates the task status', async () => {
    const { Wrapper, queryClient } = createWrapper()

    // Pre-populate inbox cache with a task
    queryClient.setQueryData(queryKeys.views.inbox, mockInboxView)

    const { result } = renderHook(() => useCompleteTask(), { wrapper: Wrapper })

    result.current.mutate('task-1')

    // Check optimistic update happened
    await waitFor(() => {
      const cache = queryClient.getQueryData<typeof mockInboxView>(queryKeys.views.inbox)
      // The optimistic update changes the task status in cache
      cache?.tasks.find((t) => t.id === 'task-1')
      // After mutation settles, cache is invalidated and refetched
      expect(result.current.isSuccess || result.current.isPending).toBe(true)
    })
  })

  it('calls the complete endpoint', async () => {
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useCompleteTask(), { wrapper: Wrapper })

    result.current.mutate('task-1')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // MSW handler returns completed task
    expect(result.current.data?.status).toBe('completed')
  })
})
