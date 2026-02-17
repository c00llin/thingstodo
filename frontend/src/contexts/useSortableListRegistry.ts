import { useContext } from 'react'
import { SortableListRegistryContext } from './SortableListRegistryContext'

export function useSortableListRegistry() {
  const ctx = useContext(SortableListRegistryContext)
  if (!ctx) throw new Error('useSortableListRegistry must be used within SortableListRegistryProvider')
  return ctx
}
