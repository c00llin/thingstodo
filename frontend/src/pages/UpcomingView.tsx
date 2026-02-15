import { useUpcoming } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'

export function UpcomingView() {
  const { data, isLoading } = useUpcoming()

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Upcoming</h2>
      {!data?.dates || data.dates.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Nothing scheduled yet.
        </p>
      ) : (
        data.dates.map((d) => (
          <TaskGroup key={d.date} title={d.date} tasks={d.tasks} />
        ))
      )}
    </div>
  )
}
