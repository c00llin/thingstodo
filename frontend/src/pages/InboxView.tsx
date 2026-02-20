import { useInbox } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { TaskItem } from '../components/TaskItem'

export function InboxView() {
  const { data, isLoading } = useInbox()
  const hasTasks = (data?.tasks.length ?? 0) > 0
  const hasReview = (data?.review.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Inbox</h2>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Loading...</p>
      ) : !hasTasks && !hasReview ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Your inbox is empty.
        </p>
      ) : (
        <>
          {hasTasks && (
            <SortableTaskList
              tasks={data?.tasks ?? []}
              sortField="sort_order_today"
              showProject={false}
            />
          )}
          {hasReview && (
            <div className="mt-6">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Review
              </h3>
              <div>
                {data!.review.map((task) => (
                  <TaskItem key={task.id} task={task} showProject showReviewCheckbox />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
