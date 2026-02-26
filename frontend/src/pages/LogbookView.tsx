import { useState, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useLogbook } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FilterBar, FilterToggleButton } from '../components/FilterBar'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { filterLogbookGroups, hasFilters } from '../lib/filter-tasks'
import { formatRelativeDate } from '../lib/format-date'
import { deleteTask } from '../api/tasks'

export function LogbookView() {
  const { data, isLoading } = useLogbook()
  const filterBarOpen = useAppStore((s) => s.filterBarOpen)
  const filters = useFilterStore()
  const active = hasFilters(filters)
  const queryClient = useQueryClient()
  const [trashing, setTrashing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const groups = useMemo(
    () => active ? filterLogbookGroups(data?.groups ?? [], filters) : data?.groups ?? [],
    [data?.groups, active, filters],
  )
  const allTasks = groups.flatMap((g) => g.tasks)
  const hasTasks = allTasks.length > 0

  async function trashAll() {
    if (!hasTasks) return
    setShowConfirm(false)
    setTrashing(true)
    await Promise.all(allTasks.map((t) => deleteTask(t.id)))
    queryClient.invalidateQueries({ queryKey: ['views'] })
    setTrashing(false)
  }

  if (isLoading) {
    return (
      <div className="px-4 pt-14 pb-4 md:p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Completed</h2>
        <div className="flex items-center gap-1">
          <FilterToggleButton />
          {hasTasks && !active && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={trashing}
              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
              aria-label="Move all to trash"
              title="Move all to trash"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      {filterBarOpen && <FilterBar availableFields={['area', 'project', 'highPriority', 'plannedDate', 'deadline']} />}
      {!hasTasks ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          No completed tasks yet.
        </p>
      ) : (
        groups.map((group) => (
          <TaskGroup key={group.date} title={formatRelativeDate(group.date)} tasks={group.tasks} />
        ))
      )}
      <ConfirmDialog
        open={showConfirm}
        title="Move all to trash?"
        description={`${allTasks.length} completed task${allTasks.length === 1 ? '' : 's'} will be moved to the trash.`}
        confirmLabel="Move to Trash"
        destructive
        onConfirm={trashAll}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
