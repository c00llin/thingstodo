import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useFilterStore } from '../stores/filters'
import { useCreateSavedFilter } from '../hooks/queries'

interface SaveViewModalProps {
  open: boolean
  onClose: () => void
  viewName: string
}

export function SaveViewModal({ open, onClose, viewName }: SaveViewModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 dark:bg-black/50" />
        {open && <SaveViewModalContent onClose={onClose} viewName={viewName} />}
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SaveViewModalContent({ onClose, viewName }: { onClose: () => void; viewName: string }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const createMutation = useCreateSavedFilter()
  const filterState = useFilterStore()

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }

    const config = JSON.stringify({
      areas: filterState.areas,
      projects: filterState.projects,
      tags: filterState.tags,
      highPriority: filterState.highPriority,
      plannedDate: filterState.plannedDate,
      deadline: filterState.deadline,
      search: filterState.search,
    })

    createMutation.mutate(
      { view: viewName, name: trimmed, config },
      {
        onSuccess: (result) => {
          useFilterStore.getState().applyFilterConfig(
            JSON.parse(result.config),
            result.id,
          )
          onClose()
        },
        onError: (err) => {
          const msg = (err as Error).message
          if (msg.includes('LIMIT_REACHED') || msg.includes('422')) {
            setError('Maximum 10 saved filters per view')
          } else {
            setError('Failed to save filter')
          }
        },
      },
    )
  }

  return (
    <Dialog.Content
      className="fixed left-1/2 top-1/3 z-50 w-72 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleSave()
        }
      }}
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        inputRef.current?.focus()
      }}
    >
      <Dialog.Title className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Save Filter
      </Dialog.Title>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        placeholder="Filter name..."
        maxLength={64}
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
      />
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Dialog.Close asChild>
          <button
            className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </Dialog.Close>
        <button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Dialog.Content>
  )
}
