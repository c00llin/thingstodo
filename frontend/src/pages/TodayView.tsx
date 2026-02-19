import { useMemo } from 'react'
import { useToday } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'

export function TodayView() {
  const { data, isLoading } = useToday()

  // Flatten grouped tasks into a single list per section
  const dataSections = data?.sections
  const sections = useMemo(() => {
    if (!dataSections) return []
    return dataSections.map((section) => ({
      title: section.title,
      tasks: section.groups.flatMap((g) => g.tasks),
    }))
  }, [dataSections])

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
        <div className="mb-8">
          <h1 className="mb-3 text-2xl font-bold text-red-600 dark:text-red-400">Overdue</h1>
          <SortableTaskList tasks={data.overdue} sortField="sort_order_today" />
        </div>
      )}

      {/* Earlier: past-dated tasks without overdue deadline */}
      {data?.earlier && data.earlier.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-800 dark:text-neutral-200">Earlier</h2>
          <SortableTaskList tasks={data.earlier} sortField="sort_order_today" />
        </div>
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
