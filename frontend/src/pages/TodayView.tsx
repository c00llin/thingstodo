import { useToday } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { SortableTaskList } from '../components/SortableTaskList'

export function TodayView() {
  const { data, isLoading } = useToday()

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Today</h2>

      {/* Overdue tasks */}
      {data?.overdue && data.overdue.length > 0 && (
        <TaskGroup title="Overdue" tasks={data.overdue} sortable sortField="sort_order_today" />
      )}

      {/* Sections: Today + This Evening */}
      {data?.sections.map((section) => (
        <div key={section.title} className="mb-8">
          <h3 className="mb-3 text-lg font-semibold text-neutral-800 dark:text-neutral-200">{section.title}</h3>
          {section.groups.length === 0 ? (
            <p className="py-4 text-sm text-neutral-400">No tasks</p>
          ) : (
            section.groups.map((group, i) => (
              <div key={group.project?.id ?? `no-project-${i}`} className="mb-4">
                {group.project && (
                  <h4 className="mb-1 px-3 text-xs font-medium text-neutral-500">
                    {group.project.title}
                  </h4>
                )}
                <SortableTaskList
                  tasks={group.tasks}
                  sortField="sort_order_today"
                  showProject={false}
                />
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  )
}
