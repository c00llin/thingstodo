import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useAppStore } from '../stores/app'

const globalShortcuts = [
  { keys: 'Ctrl + Space', action: 'Open Quick Entry' },
  { keys: 'Alt + N', action: 'New task in current view' },
  { keys: 'Alt + F', action: 'Focus search' },
  { keys: 'Alt + 1', action: 'Go to Inbox' },
  { keys: 'Alt + 2', action: 'Go to Today' },
  { keys: 'Alt + 3', action: 'Go to Upcoming' },
  { keys: 'Alt + 4', action: 'Go to Anytime' },
  { keys: 'Alt + 5', action: 'Go to Someday' },
  { keys: 'Alt + 6', action: 'Go to Logbook' },
  { keys: '?', action: 'Show this help' },
]

const taskShortcuts = [
  { keys: 'Enter', action: 'Close task detail' },
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
        <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl dark:bg-neutral-800">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Keyboard Shortcuts
            </Dialog.Title>
            <Dialog.Close className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
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
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                When a task is selected
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
