import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Trash2 } from 'lucide-react'
import { useTagTasks, useTags, useDeleteTag } from '../hooks/queries'
import { TaskItem } from '../components/TaskItem'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function TagView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: tagsData } = useTags()
  const { data, isLoading } = useTagTasks(id!)
  const deleteTag = useDeleteTag()
  const [showDelete, setShowDelete] = useState(false)

  const tag = tagsData?.tags.find((t) => t.id === id)

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
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
      {!data?.tasks || data.tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          No tasks with this tag.
        </p>
      ) : (
        <div>
          {data.tasks.map((task) => (
            <TaskItem key={task.id} task={task} showDivider />
          ))}
        </div>
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
