import { useUpcoming } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { formatRelativeDate } from '../lib/format-date'

export function UpcomingView() {
  const { data, isLoading } = useUpcoming()

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Upcoming</h2>
      {data?.earlier && data.earlier.length > 0 && (
        <TaskGroup title="Earlier" tasks={data.earlier} />
      )}
      {!data?.dates || data.dates.length === 0 ? (
        !data?.earlier?.length && (
          <p className="py-12 text-center text-sm text-neutral-400">
            Nothing scheduled yet.
          </p>
        )
      ) : (
        data.dates.map((d) => (
          <TaskGroup key={d.date} title={formatRelativeDate(d.date)} tasks={d.tasks} />
        ))
      )}
    </div>
  )
}
