import { AnimatePresence, motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import { addDays, format } from 'date-fns'
import {
  Calendar, Flag, FolderOpen, Tag, CircleAlert,
  CheckCircle, CircleMinus, CircleX, Trash2, X,
} from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useBulkAction } from '../hooks/useBulkAction'
import { useAreas, useProjects, useTags } from '../hooks/queries'
import type { BulkActionType } from '../api/types'

const popoverContentClass = 'z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-neutral-800 max-h-64 overflow-y-auto'
const popoverItemClass = 'rounded px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full'

export function BulkActionToolbar() {
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const count = selectedTaskIds.size
  const bulk = useBulkAction()

  function handleAction(action: BulkActionType, params?: Record<string, unknown>) {
    bulk.mutate({
      task_ids: Array.from(selectedTaskIds),
      action,
      params,
    })
  }

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            role="toolbar"
            aria-label={`Bulk actions for ${count} tasks`}
            className="flex items-center gap-1 rounded-full bg-neutral-900 px-4 py-2 text-white shadow-2xl dark:bg-neutral-100 dark:text-neutral-900"
          >
            <span className="mr-2 text-sm font-medium tabular-nums">
              {count} selected
            </span>
            <button
              onClick={clearSelection}
              className="mr-1 rounded-full p-1 hover:bg-white/10 dark:hover:bg-black/10"
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>

            <Divider />

            <WhenPopover onAction={handleAction} />
            <DeadlinePopover onAction={handleAction} />
            <ProjectPopover onAction={handleAction} />
            <TagPopover onAction={handleAction} />
            <ToolbarButton icon={CircleAlert} label="Toggle priority" onClick={() => handleAction('set_priority', { priority: 1 })} />

            <Divider />

            <ToolbarButton icon={CheckCircle} label="Complete" onClick={() => handleAction('complete')} />
            <ToolbarButton icon={CircleMinus} label="Cancel" onClick={() => handleAction('cancel')} />
            <ToolbarButton icon={CircleX} label="Won't do" onClick={() => handleAction('wontdo')} />
            <ToolbarButton icon={Trash2} label="Delete" onClick={() => handleAction('delete')} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-white/20 dark:bg-black/20" />
}

function WhenPopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10" aria-label="Set when" title="Set when">
          <Calendar size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass}>
          <div className="flex flex-col gap-0.5">
            <button className={popoverItemClass}
              onClick={() => onAction('set_when', { when_date: format(new Date(), 'yyyy-MM-dd') })}>
              Today
            </button>
            <button className={popoverItemClass}
              onClick={() => onAction('set_when', { when_date: format(new Date(), 'yyyy-MM-dd'), when_time: '18:00' })}>
              This Evening
            </button>
            <button className={popoverItemClass}
              onClick={() => onAction('set_when', { when_date: format(addDays(new Date(), 1), 'yyyy-MM-dd') })}>
              Tomorrow
            </button>
            <button className={popoverItemClass}
              onClick={() => onAction('set_when', { when_date: 'someday' })}>
              Someday
            </button>
            <button className={popoverItemClass}
              onClick={() => onAction('set_when', { when_date: '' })}>
              Clear date
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function DeadlinePopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10" aria-label="Set deadline" title="Set deadline">
          <Flag size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass}>
          <div className="flex flex-col gap-1">
            <input
              type="date"
              className="rounded border px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-700"
              onChange={(e) => {
                if (e.target.value) onAction('set_deadline', { deadline: e.target.value })
              }}
            />
            <button className={popoverItemClass}
              onClick={() => onAction('set_deadline', { deadline: '' })}>
              Clear deadline
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ProjectPopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const { data: areas } = useAreas()
  const { data: projects } = useProjects()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10" aria-label="Move to project" title="Move to project">
          <FolderOpen size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass} style={{ minWidth: 200 }}>
          <div className="flex flex-col gap-0.5">
            <button className={popoverItemClass}
              onClick={() => onAction('move_project', { project_id: '' })}>
              No project
            </button>
            {areas?.map((area) => {
              const areaProjects = projects?.filter((p) => p.area_id === area.id && p.status === 'open') ?? []
              if (areaProjects.length === 0) return null
              return (
                <div key={area.id}>
                  <div className="px-3 py-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase">
                    {area.title}
                  </div>
                  {areaProjects.map((project) => (
                    <button key={project.id} className={popoverItemClass}
                      onClick={() => onAction('move_project', { project_id: project.id })}>
                      {project.title}
                    </button>
                  ))}
                </div>
              )
            })}
            {/* Projects without an area */}
            {projects?.filter((p) => !p.area_id && p.status === 'open').map((project) => (
              <button key={project.id} className={popoverItemClass}
                onClick={() => onAction('move_project', { project_id: project.id })}>
                {project.title}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function TagPopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const { data: tags } = useTags()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10" aria-label="Assign tags" title="Assign tags">
          <Tag size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass} style={{ minWidth: 180 }}>
          <div className="flex flex-col gap-0.5">
            {tags?.map((tag) => (
              <button key={tag.id} className={popoverItemClass}
                onClick={() => onAction('add_tags', { tag_ids: [tag.id] })}>
                {tag.title}
              </button>
            ))}
            {(!tags || tags.length === 0) && (
              <div className="px-3 py-1.5 text-sm text-neutral-500">No tags</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10"
      aria-label={label}
      title={label}
    >
      <Icon size={16} />
    </button>
  )
}
