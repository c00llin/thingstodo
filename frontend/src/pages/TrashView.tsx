import { useTrash } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { formatRelativeDate } from '../lib/format-date'

export function TrashView() {
  const { data, isLoading } = useTrash()

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Trash</h2>
      {!data?.groups || data.groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Trash is empty.
        </p>
      ) : (
        data.groups.map((group) => (
          <TaskGroup key={group.date} title={formatRelativeDate(group.date)} tasks={group.tasks} />
        ))
      )}
    </div>
  )
}
