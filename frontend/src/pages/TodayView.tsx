import { useMemo } from 'react'
import { useToday } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { SortableTaskList } from '../components/SortableTaskList'

export function TodayView() {
  const { data, isLoading } = useToday()

  // Flatten grouped tasks into a single list per section
  const sections = useMemo(() => {
    if (!data?.sections) return []
    return data.sections.map((section) => ({
      title: section.title,
      tasks: section.groups.flatMap((g) => g.tasks),
    }))
  }, [data?.sections])

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Overdue tasks */}
      {data?.overdue && data.overdue.length > 0 && (
        <TaskGroup title="Overdue" tasks={data.overdue} sortable sortField="sort_order_today" />
      )}

      {/* Sections: Today + This Evening */}
      {sections.map((section) => {
        const hasTasks = section.tasks.length > 0
        if (!hasTasks && section.title !== 'Today') return null
        return (
          <div key={section.title} className="mb-8">
            {section.title === 'Today' ? (
              <h1 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">{section.title}</h1>
            ) : (
              <h2 className="mb-3 text-lg font-semibold text-neutral-800 dark:text-neutral-200">{section.title}</h2>
            )}
            {!hasTasks ? (
              <p className="py-4 text-sm text-neutral-400">No tasks</p>
            ) : (
              <SortableTaskList
                tasks={section.tasks}
                sortField="sort_order_today"
                hideWhenDate
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
