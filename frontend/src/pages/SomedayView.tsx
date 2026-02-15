import { useSomeday } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'

export function SomedayView() {
  const { data, isLoading } = useSomeday()

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Someday</h2>

      {data?.areas.map((areaGroup) => (
        <div key={areaGroup.area.id} className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-neutral-800">
            {areaGroup.area.title}
          </h3>
          {areaGroup.projects.map((pg) => (
            <TaskGroup
              key={pg.project.id}
              title={pg.project.title}
              tasks={pg.tasks}
              showProject={false}
            />
          ))}
          {areaGroup.standalone_tasks.length > 0 && (
            <TaskGroup title="Other" tasks={areaGroup.standalone_tasks} showProject={false} />
          )}
        </div>
      ))}

      {data?.no_area && (
        <>
          {data.no_area.projects.map((pg) => (
            <TaskGroup
              key={pg.project.id}
              title={pg.project.title}
              tasks={pg.tasks}
              showProject={false}
            />
          ))}
          {data.no_area.standalone_tasks.length > 0 && (
            <TaskGroup title="No Project" tasks={data.no_area.standalone_tasks} showProject={false} />
          )}
        </>
      )}
    </div>
  )
}
