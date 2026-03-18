import { useParams } from 'react-router'
import { useLocalTask } from '../hooks/localQueries'
import { TaskDetail } from '../components/TaskDetail'
import { useEffect } from 'react'
import { useAppStore } from '../stores/app'

export function TaskPermalinkView() {
  const { slug } = useParams<{ slug: string }>()
  const task = useLocalTask(slug!)
  const expandTask = useAppStore((s) => s.expandTask)

  useEffect(() => {
    if (slug) expandTask(slug)
    return () => expandTask(null)
  }, [slug, expandTask])

  if (!task) {
    return (
      <div className="px-4 pt-14 pb-48 md:px-6 md:pt-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-48 md:px-6 md:pt-6">
      <h2 className="mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{task.title}</h2>
      <TaskDetail taskId={task.id} />
    </div>
  )
}
