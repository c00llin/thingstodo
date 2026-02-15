import { useParams } from 'react-router'
import { useTagTasks, useTags } from '../hooks/queries'
import { TaskItem } from '../components/TaskItem'

export function TagView() {
  const { id } = useParams<{ id: string }>()
  const { data: tagsData } = useTags()
  const { data, isLoading } = useTagTasks(id!)

  const tag = tagsData?.tags.find((t) => t.id === id)

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {tag?.title ?? 'Tag'}
      </h2>
      {!data?.tasks || data.tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          No tasks with this tag.
        </p>
      ) : (
        <div className="space-y-0.5">
          {data.tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
