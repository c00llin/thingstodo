import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { useUpcoming } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { TaskItem } from '../components/TaskItem'
import { FilterBar, FilterToggleButton, FilterEmptyState } from '../components/FilterBar'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'
import { filterTasks, filterUpcomingDates, hasFilters } from '../lib/filter-tasks'
import { formatRelativeDate } from '../lib/format-date'
import type { Task, UpcomingViewDate } from '../api/types'

interface Section {
  key: string
  title: string
  tasks: Task[]
  hideWhenDate: boolean
}

/** Group date entries: current + next month show individual days,
 *  further months are collapsed into a single "Month YYYY" section. */
function groupDateSections(dates: UpcomingViewDate[]): Section[] {
  const now = new Date()
  const currentMonth = now.getFullYear() * 12 + now.getMonth()
  const nextMonth = currentMonth + 1

  const sections: Section[] = []
  const monthBuckets = new Map<string, Task[]>()
  const monthOrder: string[] = []

  for (const d of dates) {
    const date = new Date(d.date + 'T00:00:00')
    const dateMonth = date.getFullYear() * 12 + date.getMonth()

    if (dateMonth <= nextMonth) {
      // Current or next month: individual day section
      sections.push({
        key: d.date,
        title: formatRelativeDate(d.date),
        tasks: d.tasks,
        hideWhenDate: true,
      })
    } else {
      // Further out: group by month
      const monthKey = format(date, 'yyyy-MM')
      if (!monthBuckets.has(monthKey)) {
        monthBuckets.set(monthKey, [])
        monthOrder.push(monthKey)
      }
      monthBuckets.get(monthKey)!.push(...d.tasks)
    }
  }

  // Append month-grouped sections in order
  for (const monthKey of monthOrder) {
    const [yearStr, monthStr] = monthKey.split('-')
    const monthDate = new Date(Number(yearStr), Number(monthStr) - 1, 1)
    sections.push({
      key: monthKey,
      title: format(monthDate, 'MMMM'),
      tasks: monthBuckets.get(monthKey)!,
      hideWhenDate: false,
    })
  }

  return sections
}

export function UpcomingView() {
  const { data, isLoading } = useUpcoming()
  const filterBarOpen = useAppStore((s) => s.filterBarOpen)
  const filters = useFilterStore()
  const active = hasFilters(filters)
  const [overdueOpen, setOverdueOpen] = useState(() => localStorage.getItem('upcoming-overdue') !== 'false')
  const [earlierOpen, setEarlierOpen] = useState(() => localStorage.getItem('upcoming-earlier') !== 'false')

  const filteredDates = useMemo(
    () => active ? filterUpcomingDates(data?.dates ?? [], filters) : data?.dates ?? [],
    [data?.dates, active, filters],
  )
  const sections = useMemo(
    () => groupDateSections(filteredDates),
    [filteredDates],
  )
  const overdue = useMemo(
    () => active ? filterTasks(data?.overdue ?? [], filters) : data?.overdue ?? [],
    [data?.overdue, active, filters],
  )
  const earlier = useMemo(
    () => active ? filterTasks(data?.earlier ?? [], filters) : data?.earlier ?? [],
    [data?.earlier, active, filters],
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
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Upcoming</h2>
        <FilterToggleButton />
      </div>
      {filterBarOpen && <FilterBar availableFields={['area', 'project', 'highPriority', 'plannedDate', 'deadline']} />}
      {overdue.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setOverdueOpen((v) => { const next = !v; localStorage.setItem('upcoming-overdue', String(next)); return next })}
            className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <ChevronRight size={14} className={`-ml-[18px] mr-1 transition-transform ${overdueOpen ? 'rotate-90' : ''}`} />
            Overdue
          </button>
          {overdueOpen && (
            <AnimatePresence initial={false}>
              {overdue.map((task) => (
                <TaskItem key={task.id} task={task} showDivider />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
      {earlier.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setEarlierOpen((v) => { const next = !v; localStorage.setItem('upcoming-earlier', String(next)); return next })}
            className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <ChevronRight size={14} className={`-ml-[18px] mr-1 transition-transform ${earlierOpen ? 'rotate-90' : ''}`} />
            Earlier
          </button>
          {earlierOpen && (
            <AnimatePresence initial={false}>
              {earlier.map((task) => (
                <TaskItem key={task.id} task={task} showDivider />
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
      {sections.length === 0 ? (
        !earlier.length && !overdue.length && (
          active
            ? <FilterEmptyState />
            : <p className="py-12 text-center text-sm text-neutral-400">Nothing scheduled yet.</p>
        )
      ) : (
        sections.map((s) => (
          <TaskGroup key={s.key} title={s.title} tasks={s.tasks} hideWhenDate={s.hideWhenDate} />
        ))
      )}
    </div>
  )
}
