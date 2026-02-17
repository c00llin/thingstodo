import { createContext, useContext, useRef, type ReactNode } from 'react'
import type { Task, SortField } from '../api/types'

interface ListEntry {
  tasks: Task[]
  sortField: SortField
}

interface SortableListRegistryContextValue {
  register: (listId: string, tasks: Task[], sortField: SortField) => void
  unregister: (listId: string) => void
  getListForTask: (taskId: string) => (ListEntry & { listId: string }) | null
}

const SortableListRegistryContext = createContext<SortableListRegistryContextValue | null>(null)

export function SortableListRegistryProvider({ children }: { children: ReactNode }) {
  const mapRef = useRef<Map<string, ListEntry>>(new Map())

  const value: SortableListRegistryContextValue = {
    register(listId, tasks, sortField) {
      mapRef.current.set(listId, { tasks, sortField })
    },
    unregister(listId) {
      mapRef.current.delete(listId)
    },
    getListForTask(taskId) {
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

export function useSortableListRegistry() {
  const ctx = useContext(SortableListRegistryContext)
  if (!ctx) throw new Error('useSortableListRegistry must be used within SortableListRegistryProvider')
  return ctx
}
