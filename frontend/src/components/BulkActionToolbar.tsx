import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import {
  Calendar, Flag, FolderOpen, Tag, CircleAlert,
  CheckCircle, CircleMinus, CircleX, Trash2, X, Check,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { DateInput } from './DateInput'
import { useAppStore } from '../stores/app'
import { useBulkAction } from '../hooks/useBulkAction'
import { useAreas, useProjects, useTags, findTaskInViewCache } from '../hooks/queries'
import type { BulkActionType } from '../api/types'

const popoverContentClass = 'z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-neutral-800 max-h-64 overflow-y-auto'
const popoverDateContentClass = 'z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-neutral-800'
const popoverItemClass = 'rounded px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 w-full'

export function BulkActionToolbar() {
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const selectionSection = useAppStore((s) => s.selectionSection)
  const count = selectedTaskIds.size
  const bulk = useBulkAction()
  const queryClient = useQueryClient()

  function handleAction(action: BulkActionType, params?: Record<string, unknown>) {
    bulk.mutate({
      task_ids: Array.from(selectedTaskIds),
      action,
      params,
    })
  }

  function handleTogglePriority() {
    const ids = Array.from(selectedTaskIds)
    const allHighPriority = ids.every((taskId) => {
      const task = findTaskInViewCache(queryClient, taskId)
      return task?.high_priority
    })
    handleAction('set_priority', { priority: allHighPriority ? 0 : 1 })
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
            className="flex items-center gap-1 rounded-full bg-neutral-100 px-4 py-2 text-neutral-900 shadow-2xl dark:bg-neutral-800 dark:text-white"
          >
            <span aria-live="polite" className="mr-2 text-sm font-medium tabular-nums">
              {count} selected
            </span>
            <button
              onClick={clearSelection}
              className="mr-1 rounded-full p-1 hover:bg-black/10 dark:hover:bg-white/10"
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>

            <Divider />

            {selectionSection === 'review' ? (
              <>
                <ToolbarButton icon={Check} label="Mark reviewed" onClick={() => handleAction('mark_reviewed')} />
                <Divider />
                <ToolbarButton icon={CheckCircle} label="Complete" onClick={() => handleAction('complete')} />
                <ToolbarButton icon={CircleX} label="Won't do" onClick={() => handleAction('wontdo')} />
                <ToolbarButton icon={CircleMinus} label="Cancel" onClick={() => handleAction('cancel')} />
                <ToolbarButton icon={Trash2} label="Delete" onClick={() => handleAction('delete')} />
              </>
            ) : (
              <>
                <WhenPopover onAction={handleAction} />
                <DeadlinePopover onAction={handleAction} />
                <ProjectPopover onAction={handleAction} />
                <TagPopover onAction={handleAction} />
                <ToolbarButton icon={CircleAlert} label="Toggle priority" onClick={handleTogglePriority} />
                <Divider />
                <ToolbarButton icon={CheckCircle} label="Complete" onClick={() => handleAction('complete')} />
                <ToolbarButton icon={CircleMinus} label="Cancel" onClick={() => handleAction('cancel')} />
                <ToolbarButton icon={CircleX} label="Won't do" onClick={() => handleAction('wontdo')} />
                <ToolbarButton icon={Trash2} label="Delete" onClick={() => handleAction('delete')} />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-black/20 dark:bg-white/20" />
}

function WhenPopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10" aria-label="Set when" title="Set when">
          <Calendar size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverDateContentClass} style={{ minWidth: 224 }} onOpenAutoFocus={(e) => e.preventDefault()}>
          <DateInput
            value=""
            variant="when"
            dropdownPosition="up"
            autoFocus
            onChange={(date) => {
              if (date !== null) {
                onAction('set_when', { when_date: date })
                setOpen(false)
              }
            }}
            onComplete={() => setOpen(false)}
          />
          <button className={popoverItemClass + ' mt-1'}
            onClick={() => { onAction('set_when', { when_date: '' }); setOpen(false) }}>
            Clear date
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function DeadlinePopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10" aria-label="Set deadline" title="Set deadline">
          <Flag size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverDateContentClass} style={{ minWidth: 224 }} onOpenAutoFocus={(e) => e.preventDefault()}>
          <DateInput
            value=""
            variant="deadline"
            dropdownPosition="up"
            autoFocus
            onChange={(date) => {
              if (date !== null) {
                onAction('set_deadline', { deadline: date })
                setOpen(false)
              }
            }}
            onComplete={() => setOpen(false)}
          />
          <button className={popoverItemClass + ' mt-1'}
            onClick={() => { onAction('set_deadline', { deadline: '' }); setOpen(false) }}>
            Clear deadline
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ProjectPopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()
  const areas = areasData?.areas
  const projects = projectsData?.projects

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10" aria-label="Move to project" title="Move to project">
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
  const { data: tagsData } = useTags()
  const tags = tagsData?.tags
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds)
  const queryClient = useQueryClient()

  function handleTagClick(tagId: string) {
    const ids = Array.from(selectedTaskIds)
    const allHaveTag = ids.every((taskId) => {
      const task = findTaskInViewCache(queryClient, taskId)
      return task?.tags?.some((t) => t.id === tagId)
    })
    if (allHaveTag) {
      onAction('remove_tags', { tag_ids: [tagId] })
    } else {
      onAction('add_tags', { tag_ids: [tagId] })
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10" aria-label="Assign tags" title="Assign tags">
          <Tag size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass} style={{ minWidth: 180 }}>
          <div className="flex flex-col gap-0.5">
            {tags?.map((tag) => (
              <button key={tag.id} className={popoverItemClass}
                onClick={() => handleTagClick(tag.id)}>
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
      className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
      aria-label={label}
      title={label}
    >
      <Icon size={16} />
    </button>
  )
}
