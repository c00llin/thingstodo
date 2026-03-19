import { useMutation } from '@tanstack/react-query'
import type { BulkActionRequest } from '../api/types'
import { useAppStore } from '../stores/app'
import * as localMutations from '../db/mutations'
import { localDb } from '../db/index'

const DESTRUCTIVE_ACTIONS = new Set(['complete', 'cancel', 'wontdo', 'delete', 'mark_reviewed'])

async function applyBulkAction(data: BulkActionRequest): Promise<void> {
  for (const id of data.task_ids) {
    switch (data.action) {
      case 'complete':
        await localMutations.completeTask(id)
        break
      case 'cancel':
        await localMutations.cancelTask(id)
        break
      case 'wontdo':
        await localMutations.updateTask(id, { status: 'wont_do', canceled_at: new Date().toISOString() })
        break
      case 'delete':
        await localMutations.deleteTask(id)
        break
      case 'set_when':
        await localMutations.updateTask(id, { when_date: (data.params?.when_date as string) ?? null })
        break
      case 'set_deadline':
        await localMutations.updateTask(id, { deadline: (data.params?.deadline as string) ?? null })
        break
      case 'set_priority':
        await localMutations.updateTask(id, { high_priority: data.params?.high_priority as boolean })
        break
      case 'toggle_priority':
        // Need to read current value and toggle
        {
          const task = await (await import('../db/index')).localDb.tasks.get(id)
          if (task) {
            await localMutations.updateTask(id, { high_priority: !task.high_priority })
          }
        }
        break
      case 'move_project':
        await localMutations.updateTask(id, {
          project_id: (data.params?.project_id as string) ?? null,
          area_id: (data.params?.area_id as string) ?? null,
        })
        break
      case 'add_tags':
        {
          const tagIds = (data.params?.tag_ids as string[]) ?? []
          const task = await localDb.tasks.get(id)
          if (task) {
            const currentIds = (task.tags ?? []).map((t) => t.id)
            const merged = [...new Set([...currentIds, ...tagIds])]
            await localMutations.updateTask(id, { tag_ids: merged })
          }
        }
        break
      case 'remove_tags':
        {
          const tagIds = (data.params?.tag_ids as string[]) ?? []
          const removeSet = new Set(tagIds)
          const task = await localDb.tasks.get(id)
          if (task) {
            const remaining = (task.tags ?? []).map((t) => t.id).filter((tid) => !removeSet.has(tid))
            await localMutations.updateTask(id, { tag_ids: remaining })
          }
        }
        break
      case 'toggle_tags':
        {
          const tagIds = (data.params?.tag_ids as string[]) ?? []
          const task = await localDb.tasks.get(id)
          if (task) {
            const currentIds = new Set((task.tags ?? []).map((t) => t.id))
            for (const tid of tagIds) {
              if (currentIds.has(tid)) {
                currentIds.delete(tid)
              } else {
                currentIds.add(tid)
              }
            }
            await localMutations.updateTask(id, { tag_ids: [...currentIds] })
          }
        }
        break
      case 'mark_reviewed':
        await localMutations.updateTask(id, { updated_at: new Date().toISOString() })
        break
    }
  }
}

export function useBulkAction() {
  return useMutation({
    mutationFn: (data: BulkActionRequest) => applyBulkAction(data),
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
        }, 800)
      }
    },
  })
}
