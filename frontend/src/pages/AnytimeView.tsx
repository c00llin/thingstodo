import { useAnytime } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { SortableTaskList } from '../components/SortableTaskList'

export function AnytimeView() {
  const { data, isLoading } = useAnytime()

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Anytime</h2>

      {data?.no_area && data.no_area.standalone_tasks.length > 0 && (
        <div className="mb-6">
          <SortableTaskList tasks={data.no_area.standalone_tasks} sortField="sort_order_today" showProject={false} />
        </div>
      )}

      {data?.areas.map((areaGroup) => (
        <div key={areaGroup.area.id} className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {areaGroup.area.title}
          </h3>
          {areaGroup.standalone_tasks.length > 0 && (
            <div className={areaGroup.projects.length > 0 ? 'mb-4' : ''}>
              <SortableTaskList tasks={areaGroup.standalone_tasks} sortField="sort_order_today" showProject={false} />
            </div>
          )}
          {areaGroup.projects.map((pg) => (
            <TaskGroup
              key={pg.project.id}
              title={pg.project.title}
              tasks={pg.tasks}
              showProject={false}
              sortable
            />
          ))}
        </div>
      ))}

      {data?.no_area && data.no_area.projects.map((pg) => (
        <TaskGroup
          key={pg.project.id}
          title={pg.project.title}
          tasks={pg.tasks}
          showProject={false}
        />
      ))}
    </div>
  )
}
