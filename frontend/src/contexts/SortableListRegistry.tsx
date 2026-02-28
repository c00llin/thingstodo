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
    getListForTask(sortableId: string) {
      for (const [listId, entry] of mapRef.current) {
        // Match by schedule_entry_id first (multi-date), then by task.id
        if (entry.tasks.some((t) => (t.schedule_entry_id ?? t.id) === sortableId)) {
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
