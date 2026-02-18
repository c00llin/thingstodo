import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { Trash2 } from 'lucide-react'
import { useProject, useDeleteProject } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { SortableTaskList } from '../components/SortableTaskList'
import { ConfirmDialog } from '../components/ConfirmDialog'

export function ProjectView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: project, isLoading } = useProject(id!)
  const deleteProject = useDeleteProject()
  const [showDelete, setShowDelete] = useState(false)

  if (isLoading || !project) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  const progress =
    project.task_count > 0
      ? Math.round((project.completed_task_count / project.task_count) * 100)
      : 0

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h2 className="mb-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{project.title}</h2>
        <button
          onClick={() => setShowDelete(true)}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600 dark:hover:bg-neutral-700 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {project.notes && (
        <p className="mb-4 text-sm text-neutral-600">{project.notes}</p>
      )}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full rounded-full bg-red-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-neutral-500">
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

      <ConfirmDialog
        open={showDelete}
        title={`Delete "${project.title}"?`}
        description={`"${project.title}" and all its tasks will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteProject.mutate(id!, {
            onSuccess: () => navigate('/inbox'),
          })
        }}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}
