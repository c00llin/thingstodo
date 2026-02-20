import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useUpcoming } from '../hooks/queries'
import { TaskGroup } from '../components/TaskGroup'
import { TaskItem } from '../components/TaskItem'
import { formatRelativeDate } from '../lib/format-date'

export function UpcomingView() {
  const { data, isLoading } = useUpcoming()
  const [overdueOpen, setOverdueOpen] = useState(() => localStorage.getItem('upcoming-overdue') !== 'false')
  const [earlierOpen, setEarlierOpen] = useState(() => localStorage.getItem('upcoming-earlier') !== 'false')

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-sm text-neutral-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Upcoming</h2>
      {data?.overdue && data.overdue.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setOverdueOpen((v) => { const next = !v; localStorage.setItem('upcoming-overdue', String(next)); return next })}
            className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <ChevronRight size={14} className={`-ml-5 mr-1 transition-transform ${overdueOpen ? 'rotate-90' : ''}`} />
            Overdue
          </button>
          {overdueOpen && (
            <div className="space-y-0.5">
              {data.overdue.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
      {data?.earlier && data.earlier.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setEarlierOpen((v) => { const next = !v; localStorage.setItem('upcoming-earlier', String(next)); return next })}
            className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
          >
            <ChevronRight size={14} className={`-ml-5 mr-1 transition-transform ${earlierOpen ? 'rotate-90' : ''}`} />
            Earlier
          </button>
          {earlierOpen && (
            <div className="space-y-0.5">
              {data.earlier.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      )}
      {!data?.dates || data.dates.length === 0 ? (
        !data?.earlier?.length && !data?.overdue?.length && (
          <p className="py-12 text-center text-sm text-neutral-400">
            Nothing scheduled yet.
          </p>
        )
      ) : (
        data.dates.map((d) => (
          <TaskGroup key={d.date} title={formatRelativeDate(d.date)} tasks={d.tasks} />
        ))
      )}
    </div>
  )
}
