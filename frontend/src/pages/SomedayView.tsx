import { useMemo } from 'react'
import { useSomeday } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { SortableTaskList } from '../components/SortableTaskList'
import { FilterBar, FilterToggleButton } from '../components/FilterBar'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { filterAreaGroups, filterNoArea, hasFilters } from '../lib/filter-tasks'

export function SomedayView() {
  const { data, isLoading } = useSomeday()
  const filterBarOpen = useAppStore((s) => s.filterBarOpen)
  const filters = useFilterStore()
  const active = hasFilters(filters)

  const areas = useMemo(
    () => active ? filterAreaGroups(data?.areas ?? [], filters) : data?.areas ?? [],
    [data?.areas, active, filters],
  )
  const noArea = useMemo(() => {
    const src = data?.no_area
    return active && src ? filterNoArea(src, filters) : src ?? null
  }, [data, active, filters])

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
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Someday</h2>
        <FilterToggleButton />
      </div>
      {filterBarOpen && <FilterBar availableFields={['area', 'project', 'highPriority', 'deadline']} />}

      {noArea && noArea.standalone_tasks.length > 0 && (
        <div className="mb-6">
          <SortableTaskList tasks={noArea.standalone_tasks} sortField="sort_order_today" showProject={false} hideWhenDate />
        </div>
      )}

      {areas.map((areaGroup) => (
        <div key={areaGroup.area.id} className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {areaGroup.area.title}
          </h3>
          {areaGroup.standalone_tasks.length > 0 && (
            <div className={areaGroup.projects.length > 0 ? 'mb-4' : ''}>
              <SortableTaskList tasks={areaGroup.standalone_tasks} sortField="sort_order_today" showProject={false} hideWhenDate />
            </div>
          )}
          {areaGroup.projects.map((pg) => (
            <TaskGroup
              key={pg.project.id}
              title={pg.project.title}
              tasks={pg.tasks}
              showProject={false}
              hideWhenDate
              sortable
            />
          ))}
        </div>
      ))}

      {noArea && noArea.projects.map((pg) => (
        <TaskGroup
          key={pg.project.id}
          title={pg.project.title}
          tasks={pg.tasks}
          showProject={false}
          hideWhenDate
        />
      ))}
    </div>
  )
}
