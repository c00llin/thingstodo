import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar, Flag, FolderOpen, Tag, CircleAlert,
  CheckCircle, CircleMinus, CircleX, Trash2, X,
} from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useBulkAction } from '../hooks/useBulkAction'
import type { BulkActionType } from '../api/types'

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

            <div className="mx-1 h-5 w-px bg-white/20 dark:bg-black/20" />

            <ToolbarButton icon={Calendar} label="Set when" onClick={() => handleAction('set_when', { when_date: new Date().toISOString().slice(0, 10) })} />
            <ToolbarButton icon={Flag} label="Set deadline" onClick={() => {/* popover in Task 7 */}} />
            <ToolbarButton icon={FolderOpen} label="Move to project" onClick={() => {/* popover in Task 7 */}} />
            <ToolbarButton icon={Tag} label="Assign tags" onClick={() => {/* popover in Task 7 */}} />
            <ToolbarButton icon={CircleAlert} label="Toggle priority" onClick={() => handleAction('set_priority', { priority: 1 })} />

            <div className="mx-1 h-5 w-px bg-white/20 dark:bg-black/20" />

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
