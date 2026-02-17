import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      confirmRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-neutral-800">
        <div className="p-4">
          <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
            {title}
          </h3>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 dark:border-neutral-700">
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            Enter to confirm · Esc to cancel
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-md px-3 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
            >
              Cancel
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onConfirm()
                }
              }}
              className={`rounded-md px-3 py-1 text-sm font-medium text-white ${
                destructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
