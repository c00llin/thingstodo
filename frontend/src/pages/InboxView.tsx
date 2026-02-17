import { useInbox } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'

export function InboxView() {
  const { data, isLoading } = useInbox()

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Inbox</h2>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Loading...</p>
      ) : data?.tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Your inbox is empty.
        </p>
      ) : (
        <SortableTaskList
          tasks={data?.tasks ?? []}
          sortField="sort_order_today"
          showProject={false}
        />
      )}
    </div>
  )
}
