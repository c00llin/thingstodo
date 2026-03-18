import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { AnimatePresence } from 'framer-motion'
import { Trash2 } from 'lucide-react'
import { useDeleteTag, useSettings } from '../hooks/queries'
import { useLocalTagTasks, useLocalTags } from '../hooks/localQueries'
import { TaskItem } from '../components/TaskItem'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function TagView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tags = useLocalTags()
  const tasks = useLocalTagTasks(id!)
  const isLoading = tasks === undefined
  const { data: settings } = useSettings()
  const deleteTag = useDeleteTag()
  const [showDelete, setShowDelete] = useState(false)

  const tag = tags?.find((t) => t.id === id)

  if (isLoading) {
    return (
      <div className="px-4 pt-14 pb-48 md:px-6 md:pt-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-48 md:px-6 md:pt-6">
      <div className="flex items-center justify-between">
        <h2 className={`mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100 ${settings?.privacy_mode ? 'privacy-blur' : ''}`}>
          {tag?.title ?? 'Tag'}
        </h2>
        {tag && (
          <button
            onClick={() => setShowDelete(true)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-700 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      {!tasks || tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          No tasks with this tag.
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} showDivider />
          ))}
        </AnimatePresence>
      )}

      {tag && (
        <ConfirmDialog
          open={showDelete}
          title={`Delete "${tag.title}"?`}
          description={`"${tag.title}" will be removed from all tasks. Tasks will not be deleted.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            deleteTag.mutate(id!, {
              onSuccess: () => navigate('/inbox'),
            })
          }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
