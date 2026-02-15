import { useParams } from 'react-router'
import { useTask } from '../hooks/queries'
import { TaskDetail } from '../components/TaskDetail'
import { useEffect } from 'react'
import { useAppStore } from '../stores/app'

export function TaskPermalinkView() {
  const { slug } = useParams<{ slug: string }>()
  const { data: task, isLoading, error } = useTask(slug!)
  const expandTask = useAppStore((s) => s.expandTask)

  useEffect(() => {
    if (slug) expandTask(slug)
    return () => expandTask(null)
  }, [slug, expandTask])

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-500">Task not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{task.title}</h2>
      <TaskDetail taskId={task.id} />
    </div>
  )
}
