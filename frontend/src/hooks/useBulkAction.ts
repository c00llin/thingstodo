import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bulkAction } from '../api/tasks'
import type { BulkActionRequest } from '../api/types'
import { forceInvalidateViewQueries } from './queries'
import { useAppStore } from '../stores/app'

const DESTRUCTIVE_ACTIONS = new Set(['complete', 'cancel', 'wontdo', 'delete', 'mark_reviewed'])

export function useBulkAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkActionRequest) => bulkAction(data),
    onMutate: (variables) => {
      if (DESTRUCTIVE_ACTIONS.has(variables.action)) {
        useAppStore.setState({
          departingTaskIds: new Set(variables.task_ids),
        })
      }
    },
    onSuccess: (_data, variables) => {
      const { selectedTaskIds } = useAppStore.getState()

      if (DESTRUCTIVE_ACTIONS.has(variables.action)) {
        const next = new Set(selectedTaskIds)
        for (const id of variables.task_ids) next.delete(id)
        useAppStore.setState({
          selectedTaskIds: next,
          ...(next.size === 0 ? { selectionSection: null, lastSelectedTaskId: null } : {}),
        })

        setTimeout(() => {
          useAppStore.setState({ departingTaskIds: new Set() })
          forceInvalidateViewQueries(queryClient)
        }, 800)
      } else {
        forceInvalidateViewQueries(queryClient)
      }
    },
  })
}
