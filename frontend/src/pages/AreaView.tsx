import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import { Trash2, ChevronRight } from 'lucide-react'
import { useArea, useDeleteArea } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { CompletedTasksSection } from '../components/CompletedTasksSection'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function AreaView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: area, isLoading } = useArea(id!)
  const deleteArea = useDeleteArea()
  const [showDelete, setShowDelete] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(() => localStorage.getItem(`area-projects-${id}`) !== 'false')

  useEffect(() => {
    setProjectsOpen(localStorage.getItem(`area-projects-${id}`) !== 'false')
  }, [id])

  if (isLoading || !area) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  const hasProjects = area.projects.length > 0

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{area.title}</h2>
        {!hasProjects && (
          <button
            onClick={() => setShowDelete(true)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-700 dark:hover:text-red-400"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {hasProjects && (
        <div className="mb-6">
          <button
            onClick={() => setProjectsOpen((v) => { const next = !v; localStorage.setItem(`area-projects-${id}`, String(next)); return next })}
            className="mb-2 flex w-full items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            <ChevronRight
              size={14}
              className={`-ml-[18px] mr-1 transition-transform ${projectsOpen ? 'rotate-90' : ''}`}
            />
            Projects
          </button>
          {projectsOpen && (
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
                    className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-sm text-neutral-900 dark:text-neutral-100">{project.title}</span>
                    <span className="ml-auto text-xs text-neutral-400">
                      {project.completed_task_count}/{project.task_count}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {area.tasks.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Tasks
          </h3>
          <SortableTaskList
            tasks={area.tasks}
            sortField="sort_order_today"
            showProject={false}
          />
        </div>
      )}

      <CompletedTasksSection tasks={area.completed_tasks} showProject={false} />

      <ConfirmDialog
        open={showDelete}
        title={`Delete "${area.title}"?`}
        description={`"${area.title}" and its tasks will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteArea.mutate(id!, {
            onSuccess: () => navigate('/inbox'),
          })
        }}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}
