import { X, Ban, XCircle, Check, Trash2 } from 'lucide-react'

interface SwipeActionsTrayProps {
  onDismiss: () => void
  onCancel: () => void
  onWontDo: () => void
  onComplete: () => void
  onDelete: () => void
}

export function SwipeActionsTray({ onDismiss, onCancel, onWontDo, onComplete, onDelete }: SwipeActionsTrayProps) {
  return (
    <div className="flex items-center justify-evenly gap-2 px-3 py-2 md:hidden">
      <button
        type="button"
        onClick={onDismiss}
        className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-neutral-500 active:bg-neutral-100 dark:text-neutral-400 dark:active:bg-neutral-700"
        aria-label="Close"
      >
        <X size={20} />
        <span className="text-[10px]">Close</span>
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-yellow-600 active:bg-yellow-50 dark:text-yellow-500 dark:active:bg-yellow-900/20"
        aria-label="Cancel"
      >
        <XCircle size={20} />
        <span className="text-[10px]">Cancel</span>
      </button>
      <button
        type="button"
        onClick={onWontDo}
        className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-orange-500 active:bg-orange-50 dark:active:bg-orange-900/20"
        aria-label="Won't Do"
      >
        <Ban size={20} />
        <span className="text-[10px]">Won't Do</span>
      </button>
      <button
        type="button"
        onClick={onComplete}
        className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-green-500 active:bg-green-50 dark:active:bg-green-900/20"
        aria-label="Complete"
      >
        <Check size={20} />
        <span className="text-[10px]">Complete</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 text-red-500 active:bg-red-50 dark:active:bg-red-900/20"
        aria-label="Delete"
      >
        <Trash2 size={20} />
        <span className="text-[10px]">Delete</span>
      </button>
    </div>
  )
}
