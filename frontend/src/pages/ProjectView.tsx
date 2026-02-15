import { useParams } from 'react-router'
import { useProject } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { SortableTaskList } from '../components/SortableTaskList'

export function ProjectView() {
  const { id } = useParams<{ id: string }>()
  const { data: project, isLoading } = useProject(id!)

  if (isLoading || !project) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const progress =
    project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{project.title}</h2>
      {project.notes && (
        <p className="mb-4 text-sm text-gray-600">{project.notes}</p>
      )}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">
          {project.completed_task_count}/{project.task_count}
        </span>
      </div>

      {/* Tasks without heading */}
      {project.tasks_without_heading.length > 0 && (
        <div className="mb-6">
          <SortableTaskList
            tasks={project.tasks_without_heading}
            sortField="sort_order_project"
            showProject={false}
          />
        </div>
      )}

      {/* Headed sections */}
      {project.headings.map((heading) => (
        <TaskGroup
          key={heading.id}
          title={heading.title}
          tasks={heading.tasks}
          showProject={false}
          sortable
          sortField="sort_order_heading"
        />
      ))}
    </div>
  )
}
