import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import {
  Calendar, Flag, FolderOpen, Tag, CircleAlert,
  CheckCircle, CircleMinus, CircleX, Trash2, X, Check,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { DateInput } from './DateInput'
import { AreaProjectPicker } from './AreaProjectPicker'
import { TagMultiSelect } from './TagMultiSelect'
import { useAppStore } from '../stores/app'
import { useBulkAction } from '../hooks/useBulkAction'
import { findTaskInViewCache } from '../hooks/queries'
import type { BulkActionType } from '../api/types'

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
                <ProjectPickerButton onAction={handleAction} />
                <TagPickerButton onAction={handleAction} />
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

function ProjectPickerButton({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Move to project"
        title="Move to project"
        onClick={() => setOpen(!open)}
      >
        <FolderOpen size={16} />
      </button>
      {open && (
        <AreaProjectPicker
          controlledAreaId={null}
          controlledProjectId={null}
          externalOpen={true}
          onExternalOpenChange={setOpen}
          dropdownPosition="up"
          hideTrigger
          onControlledChange={(areaId, projectId) => {
            onAction('move_project', { project_id: projectId ?? '', area_id: areaId ?? '' })
          }}
          onClose={() => setOpen(false)}
          onSelect={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function TagPickerButton({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds)
  const queryClient = useQueryClient()

  // Collect the union of tag IDs across all selected tasks
  const commonTagIds: string[] = []
  if (open) {
    const ids = Array.from(selectedTaskIds)
    const tagCounts = new Map<string, number>()
    ids.forEach((taskId) => {
      const task = findTaskInViewCache(queryClient, taskId)
      task?.tags?.forEach((t) => {
        tagCounts.set(t.id, (tagCounts.get(t.id) ?? 0) + 1)
      })
    })
    // Show tags that ALL selected tasks have as "selected"
    tagCounts.forEach((count, tagId) => {
      if (count === ids.length) commonTagIds.push(tagId)
    })
  }

  return (
    <div className="relative">
      <button
        className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Assign tags"
        title="Assign tags"
        onClick={() => setOpen(!open)}
      >
        <Tag size={16} />
      </button>
      {open && (
        <TagMultiSelect
          controlledTagIds={commonTagIds}
          externalOpen={true}
          onExternalOpenChange={setOpen}
          dropdownPosition="up"
          hideTrigger
          onControlledChange={(newTagIds) => {
            // Determine which tags were added vs removed
            const oldSet = new Set(commonTagIds)
            const newSet = new Set(newTagIds)
            const added = newTagIds.filter((id) => !oldSet.has(id))
            const removed = commonTagIds.filter((id) => !newSet.has(id))
            if (added.length > 0) {
              onAction('add_tags', { tag_ids: added })
            }
            if (removed.length > 0) {
              onAction('remove_tags', { tag_ids: removed })
            }
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
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
