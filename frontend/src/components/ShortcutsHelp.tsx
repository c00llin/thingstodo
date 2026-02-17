import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useAppStore } from '../stores/app'

const navigationShortcuts = [
  { keys: 'G I', action: 'Go to Inbox' },
  { keys: 'G T', action: 'Go to Today' },
  { keys: 'G U', action: 'Go to Upcoming' },
  { keys: 'G A', action: 'Go to Anytime' },
  { keys: 'G S', action: 'Go to Someday' },
  { keys: 'G C', action: 'Go to Completed' },
  { keys: 'G R', action: 'Go to Trash' },
  { keys: 'G N', action: 'Navigator' },
  { keys: 'G F', action: 'Search tasks' },
]

const globalShortcuts = [
  { keys: 'Q', action: 'Quick Entry' },
  { keys: '?', action: 'Show this help' },
]

const taskShortcuts = [
  { keys: 'Enter', action: 'Edit task title' },
  { keys: '⌘ + Enter', action: 'Open task detail' },
  { keys: 'Escape', action: 'Close detail / deselect' },
  { keys: '↑ / ↓', action: 'Navigate tasks' },
  { keys: 'Alt + K', action: 'Complete task' },
  { keys: 'Alt + Shift + K', action: 'Cancel task' },
  { keys: 'Alt + T', action: 'Move to Today' },
  { keys: 'Alt + E', action: 'Move to This Evening' },
  { keys: 'Alt + Shift + S', action: 'Move to Someday' },
  { keys: 'Delete', action: 'Delete task' },
]

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{action}</span>
      <kbd className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-xs text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
        {keys}
      </kbd>
    </div>
  )
}

export function ShortcutsHelp() {
  const open = useAppStore((s) => s.shortcutsHelpOpen)
  const toggleShortcutsHelp = useAppStore((s) => s.toggleShortcutsHelp)

  return (
    <Dialog.Root open={open} onOpenChange={toggleShortcutsHelp}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-800">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Navigation
                </h3>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {navigationShortcuts.map((s) => (
                    <ShortcutRow key={s.keys} {...s} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Global
                </h3>
                <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                  {globalShortcuts.map((s) => (
                    <ShortcutRow key={s.keys} {...s} />
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Task
              </h3>
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
                {taskShortcuts.map((s) => (
                  <ShortcutRow key={s.keys} {...s} />
                ))}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
