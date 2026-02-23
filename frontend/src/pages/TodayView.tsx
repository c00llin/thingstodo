import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useToday } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { TaskItem } from '../components/TaskItem'
import { CompletedTasksSection } from '../components/CompletedTasksSection'

export function TodayView() {
  const { data, isLoading } = useToday()
  const [overdueOpen, setOverdueOpen] = useState(() => localStorage.getItem('today-overdue') !== 'false')
  const [earlierOpen, setEarlierOpen] = useState(() => localStorage.getItem('today-earlier') !== 'false')

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
      <div className="px-4 pt-14 pb-4 md:p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-4 md:p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Today</h2>

      {/* Overdue tasks */}
      {data?.overdue && data.overdue.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setOverdueOpen((v) => { const next = !v; localStorage.setItem('today-overdue', String(next)); return next })}
            className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <ChevronRight size={14} className={`-ml-[18px] mr-1 transition-transform ${overdueOpen ? 'rotate-90' : ''}`} />
            Overdue
          </button>
          {overdueOpen && (
            <AnimatePresence initial={false}>
              {data.overdue.map((task) => (
                <TaskItem key={task.id} task={task} showDivider />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Earlier: past-dated tasks without overdue deadline */}
      {data?.earlier && data.earlier.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setEarlierOpen((v) => { const next = !v; localStorage.setItem('today-earlier', String(next)); return next })}
            className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <ChevronRight size={14} className={`-ml-[18px] mr-1 transition-transform ${earlierOpen ? 'rotate-90' : ''}`} />
            Earlier
          </button>
          {earlierOpen && (
            <AnimatePresence initial={false}>
              {data.earlier.map((task) => (
                <TaskItem key={task.id} task={task} showDivider />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Sections: Today + This Evening */}
      {sections.map((section) => {
        const hasTasks = section.tasks.length > 0
        if (!hasTasks && section.title !== 'Today') return null
        const sectionTitle = section.title === 'Today'
          ? `Today - ${format(new Date(), 'EEE, MMM d')}`
          : section.title
        return (
          <div key={section.title} className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{sectionTitle}</h3>
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

      {data?.completed && <CompletedTasksSection tasks={data.completed} />}
    </div>
  )
}
