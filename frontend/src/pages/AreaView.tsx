import { useParams, Link } from 'react-router'
import { useArea } from '../hooks/queries'
import { TaskItem } from '../components/TaskItem'

export function AreaView() {
  const { id } = useParams<{ id: string }>()
  const { data: area, isLoading } = useArea(id!)

  if (isLoading || !area) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">{area.title}</h2>

      {area.projects.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Projects
          </h3>
          <div className="space-y-1">
            {area.projects.map((project) => {
              const progress =
                project.task_count > 0
                  ? Math.round(
                      (project.completed_task_count / project.task_count) * 100,
                    )
                  : 0
              return (
                <Link
                  key={project.id}
                  to={`/project/${project.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50"
                >
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-900">{project.title}</span>
                  <span className="ml-auto text-xs text-gray-400">
                    {project.completed_task_count}/{project.task_count}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {area.tasks.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tasks
          </h3>
          <div className="space-y-0.5">
            {area.tasks.map((task) => (
              <TaskItem key={task.id} task={task} showProject={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
