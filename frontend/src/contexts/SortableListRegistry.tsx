import { useRef, type ReactNode } from 'react'
import { SortableListRegistryContext, type SortableListRegistryContextValue, type ListEntry } from './SortableListRegistryContext'
import type { Task, SortField } from '../api/types'

export function SortableListRegistryProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<Map<string, ListEntry>>(new Map())

  const value: SortableListRegistryContextValue = {
    register(listId: string, tasks: Task[], sortField: SortField) {
      mapRef.current.set(listId, { tasks, sortField })
    },
    unregister(listId: string) {
      mapRef.current.delete(listId)
    },
    getListForTask(taskId: string) {
      for (const [listId, entry] of mapRef.current) {
        if (entry.tasks.some((t) => t.id === taskId)) {
          return { listId, ...entry }
        }
      }
      return null
    },
  }

  return (
    <SortableListRegistryContext.Provider value={value}>
      {children}
    </SortableListRegistryContext.Provider>
  )
}
