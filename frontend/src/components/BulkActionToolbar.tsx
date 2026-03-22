import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import {
  Calendar, Flag, FolderOpen, Tag, CircleAlert,
  CheckCircle, CircleMinus, CircleX, Trash2, X, Check,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useHotkeys } from 'react-hotkeys-hook'
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

  function handleAction(action: BulkActionType, params?: Record<string, unknown>) {
    bulk.mutate({
      task_ids: Array.from(selectedTaskIds),
      action,
      params,
    })
  }

  const isRegularSection = selectionSection !== 'review'

  // Lifted open state for popovers so hotkeys can toggle them
  const [whenOpen, setWhenOpen] = useState(false)
  const [deadlineOpen, setDeadlineOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [tagOpen, setTagOpen] = useState(false)
  const anyPopoverOpen = whenOpen || deadlineOpen || projectOpen || tagOpen

  // Intercept Escape at the native capture phase when a popover is open,
  // so useHotkeys (document-level) never sees it and doesn't clear selection.
  const toolbarRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!anyPopoverOpen) return
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        // Close whichever popover is open
        setWhenOpen(false)
        setDeadlineOpen(false)
        setProjectOpen(false)
        setTagOpen(false)
      }
    }
    // Use capture phase on document so we fire before useHotkeys' bubble-phase listener
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [anyPopoverOpen])

  async function handleTogglePriority() {
    const ids = Array.from(selectedTaskIds)
    const { localDb } = await import('../db/index')
    const tasks = await Promise.all(ids.map((id) => localDb.tasks.get(id)))
    const allHighPriority = tasks.every((t) => t?.high_priority)
    // All high → remove priority; otherwise → set all high
    handleAction('set_priority', { high_priority: !allHighPriority })
  }

  // Alt+key shortcuts — only active when bulk toolbar is visible and not in review section
  const shortcutsEnabled = count > 0 && isRegularSection
  useHotkeys('alt+w', (e) => { e.preventDefault(); setWhenOpen((v) => !v) }, { enabled: shortcutsEnabled })
  useHotkeys('alt+d', (e) => { e.preventDefault(); setDeadlineOpen((v) => !v) }, { enabled: shortcutsEnabled })
  useHotkeys('alt+a', (e) => { e.preventDefault(); setProjectOpen((v) => !v) }, { enabled: shortcutsEnabled })
  useHotkeys('alt+t', (e) => { e.preventDefault(); setTagOpen((v) => !v) }, { enabled: shortcutsEnabled })
  useHotkeys('alt+h', (e) => { e.preventDefault(); handleTogglePriority() }, { enabled: shortcutsEnabled })

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

            {!isRegularSection ? (
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
                <WhenPopover onAction={handleAction} open={whenOpen} onOpenChange={setWhenOpen} />
                <DeadlinePopover onAction={handleAction} open={deadlineOpen} onOpenChange={setDeadlineOpen} />
                <ProjectPickerButton onAction={handleAction} open={projectOpen} onOpenChange={setProjectOpen} />
                <TagPickerButton onAction={handleAction} open={tagOpen} onOpenChange={setTagOpen} />
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

function WhenPopover({ onAction, open, onOpenChange }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
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
                onOpenChange(false)
              }
            }}
            onComplete={() => onOpenChange(false)}
          />
          <button className={popoverItemClass + ' mt-1'}
            onClick={() => { onAction('set_when', { when_date: '' }); onOpenChange(false) }}>
            Clear date
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function DeadlinePopover({ onAction, open, onOpenChange }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
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
                onOpenChange(false)
              }
            }}
            onComplete={() => onOpenChange(false)}
          />
          <button className={popoverItemClass + ' mt-1'}
            onClick={() => { onAction('set_deadline', { deadline: '' }); onOpenChange(false) }}>
            Clear deadline
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ProjectPickerButton({ onAction, open, onOpenChange }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void; open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <div className="relative">
      <button
        className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Move to project"
        title="Move to project"
        onClick={() => onOpenChange(!open)}
      >
        <FolderOpen size={16} />
      </button>
      {open && (
        <AreaProjectPicker
          controlledAreaId={null}
          controlledProjectId={null}
          externalOpen={true}
          onExternalOpenChange={onOpenChange}
          dropdownPosition="up"
          hideTrigger
          onControlledChange={(areaId, projectId) => {
            onAction('move_project', { project_id: projectId ?? '', area_id: areaId ?? '' })
          }}
          onClose={() => onOpenChange(false)}
          onSelect={() => onOpenChange(false)}
        />
      )}
    </div>
  )
}

function TagPickerButton({ onAction, open, onOpenChange }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void; open: boolean; onOpenChange: (v: boolean) => void }) {
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
        onClick={() => onOpenChange(!open)}
      >
        <Tag size={16} />
      </button>
      {open && (
        <TagMultiSelect
          controlledTagIds={commonTagIds}
          externalOpen={true}
          onExternalOpenChange={onOpenChange}
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
          onClose={() => onOpenChange(false)}
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
