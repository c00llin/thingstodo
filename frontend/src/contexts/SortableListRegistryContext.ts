import { createContext } from 'react'
import type { Task, SortField } from '../api/types'

export interface ListEntry {
  tasks: Task[]
  sortField: SortField
}

export interface SortableListRegistryContextValue {
  register: (listId: string, tasks: Task[], sortField: SortField) => void
  unregister: (listId: string) => void
  getListForTask: (taskId: string) => (ListEntry & { listId: string }) | null
}

export const SortableListRegistryContext = createContext<SortableListRegistryContextValue | null>(null)
