import { useState } from 'react'
import { Trash } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTrash } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { formatRelativeDate } from '../lib/format-date'
import { purgeTask } from '../api/tasks'

export function TrashView() {
  const { data, isLoading } = useTrash()
  const queryClient = useQueryClient()
  const [purging, setPurging] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const allTasks = data?.groups?.flatMap((g) => g.tasks) ?? []
  const hasTasks = allTasks.length > 0

  async function emptyTrash() {
    if (!hasTasks) return
    setShowConfirm(false)
    setPurging(true)
    await Promise.all(allTasks.map((t) => purgeTask(t.id)))
    queryClient.invalidateQueries({ queryKey: ['views'] })
    setPurging(false)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Trash</h2>
        {hasTasks && (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={purging}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
            aria-label="Empty trash"
            title="Empty trash"
          >
            <Trash size={18} />
          </button>
        )}
      </div>
      {!hasTasks ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Trash is empty.
        </p>
      ) : (
        data!.groups.map((group) => (
          <TaskGroup key={group.date} title={formatRelativeDate(group.date)} tasks={group.tasks} />
        ))
      )}
      <ConfirmDialog
        open={showConfirm}
        title="Empty trash?"
        description={`${allTasks.length} task${allTasks.length === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Empty Trash"
        destructive
        onConfirm={emptyTrash}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
