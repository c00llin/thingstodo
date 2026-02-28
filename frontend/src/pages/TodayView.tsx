import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useToday } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { TaskItem } from '../components/TaskItem'
import { CompletedTasksSection } from '../components/CompletedTasksSection'
import { FilterBar, FilterToggleButton, FilterEmptyState } from '../components/FilterBar'
import { SavedFiltersBar } from '../components/SavedFiltersBar'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { filterTasks, filterTodaySections, hasFilters } from '../lib/filter-tasks'

export function TodayView() {
  const { data, isLoading } = useToday()
  const filterBarOpen = useAppStore((s) => s.filterBarOpen)
  const filters = useFilterStore()
  const active = hasFilters(filters)
  const [overdueOpen, setOverdueOpen] = useState(() => localStorage.getItem('today-overdue') !== 'false')
  const [earlierOpen, setEarlierOpen] = useState(() => localStorage.getItem('today-earlier') !== 'false')

  // Flatten grouped tasks into a single list per section
  const dataSections = data?.sections
  const sections = useMemo(() => {
    const src = active && dataSections ? filterTodaySections(dataSections, filters) : dataSections
    if (!src) return []
    return src.map((section) => ({
      title: section.title,
      tasks: section.groups.flatMap((g) => g.tasks),
    }))
  }, [dataSections, active, filters])

  const overdue = useMemo(
    () => active ? filterTasks(data?.overdue ?? [], filters) : data?.overdue ?? [],
    [data?.overdue, active, filters],
  )
  const earlier = useMemo(
    () => active ? filterTasks(data?.earlier ?? [], filters) : data?.earlier ?? [],
    [data?.earlier, active, filters],
  )
  const completed = useMemo(
    () => active ? filterTasks(data?.completed ?? [], filters) : data?.completed ?? [],
    [data?.completed, active, filters],
  )

  if (isLoading) {
    return (
      <div className="px-4 pt-14 pb-4 md:p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-4 md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Today</h2>
        <FilterToggleButton />
      </div>
      <SavedFiltersBar viewName="today" />
      {filterBarOpen && <FilterBar availableFields={['area', 'project', 'tag', 'highPriority']} viewName="today" />}

      {active && overdue.length === 0 && earlier.length === 0 && sections.every((s) => s.tasks.length === 0) && completed.length === 0 && (
        <FilterEmptyState />
      )}

      {/* Overdue tasks */}
      {overdue.length > 0 && (
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
              {overdue.map((task) => (
                <TaskItem key={task.schedule_entry_id ?? task.id} task={task} showDivider />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Earlier: past-dated tasks without overdue deadline */}
      {earlier.length > 0 && (
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
              {earlier.map((task) => (
                <TaskItem key={task.schedule_entry_id ?? task.id} task={task} showDivider />
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

      {completed.length > 0 && <CompletedTasksSection tasks={completed} />}
    </div>
  )
}
