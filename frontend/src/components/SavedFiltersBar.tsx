import { useState, useMemo } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useFilterStore, type FilterState } from '../stores/filters'
import { useAreas, useProjects, useTags, useSavedFilters, useDeleteSavedFilter } from '../hooks/queries'
import { ConfirmDialog } from './ConfirmDialog'
import type { SavedFilter } from '../api/types'

interface SavedFiltersBarProps {
  viewName: string
}

export function SavedFiltersBar({ viewName }: SavedFiltersBarProps) {
  const { data, isLoading } = useSavedFilters(viewName)
  const deleteMutation = useDeleteSavedFilter(viewName)
  const activeFilterId = useFilterStore((s) => s.activeFilterId)
  const applyFilterConfig = useFilterStore((s) => s.applyFilterConfig)
  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()
  const { data: tagsData } = useTags()

  const [confirmDelete, setConfirmDelete] = useState<SavedFilter | null>(null)

  const savedFilters = data?.saved_filters ?? []

  const validAreaIds = useMemo(() => new Set((areasData?.areas ?? []).map((a) => a.id)), [areasData?.areas])
  const validProjectIds = useMemo(() => new Set((projectsData?.projects ?? []).map((p) => p.id)), [projectsData?.projects])
  const validTagIds = useMemo(() => new Set((tagsData?.tags ?? []).map((t) => t.id)), [tagsData?.tags])

  if (isLoading || savedFilters.length === 0) return null

  function parseConfig(sf: SavedFilter): FilterState | null {
    try {
      return JSON.parse(sf.config) as FilterState
    } catch {
      return null
    }
  }

  function hasStaleRefs(sf: SavedFilter): boolean {
    const config = parseConfig(sf)
    if (!config) return false
    return (
      (config.areas ?? []).some((id) => !validAreaIds.has(id)) ||
      (config.projects ?? []).some((id) => !validProjectIds.has(id)) ||
      (config.tags ?? []).some((id) => !validTagIds.has(id))
    )
  }

  function handleApply(sf: SavedFilter) {
    const config = parseConfig(sf)
    if (!config) return

    // Silently drop stale references
    const cleanedConfig: FilterState = {
      ...config,
      areas: (config.areas ?? []).filter((id) => validAreaIds.has(id)),
      projects: (config.projects ?? []).filter((id) => validProjectIds.has(id)),
      tags: (config.tags ?? []).filter((id) => validTagIds.has(id)),
    }

    applyFilterConfig(cleanedConfig, sf.id)
  }

  function handleDeleteClick(e: React.MouseEvent, sf: SavedFilter) {
    e.stopPropagation()
    setConfirmDelete(sf)
  }

  function handleConfirmDelete() {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id)
      if (activeFilterId === confirmDelete.id) {
        useFilterStore.getState().clearAll()
      }
      setConfirmDelete(null)
    }
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1">
        {savedFilters.map((sf) => {
          const isActive = sf.id === activeFilterId
          const stale = hasStaleRefs(sf)
          return (
            <div
              key={sf.id}
              className={`group inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                isActive
                  ? 'border-red-400 bg-red-50 text-red-600 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300 dark:hover:border-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400'
              }`}
              onClick={() => handleApply(sf)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleApply(sf) } }}
            >
              {stale && (
                <span
                  className="text-amber-500"
                  title="Some referenced areas, projects, or tags no longer exist"
                >
                  <AlertTriangle size={10} />
                </span>
              )}
              <span>{sf.name}</span>
              <button
                onClick={(e) => handleDeleteClick(e, sf)}
                className="ml-0.5 rounded-full p-0.5 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                aria-label={`Delete saved filter "${sf.name}"`}
              >
                <X size={9} />
              </button>
            </div>
          )
        })}
      </div>
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete saved filter?"
        description={`"${confirmDelete?.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
