import { useState, useRef, useEffect } from 'react'
import { useInbox, useCreateTask } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { useTypeToCreate } from '../hooks/useTypeToCreate'
import { useAppStore } from '../stores/app'
import { useResolveTags } from '../hooks/useResolveTags'
import { TagAutocomplete } from '../components/TagAutocomplete'

export function InboxView() {
  const { data, isLoading } = useInbox()
  const createTask = useCreateTask()
  const resolveTags = useResolveTags()
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const typeToCreate = useTypeToCreate()
  const expandTask = useAppStore((s) => s.expandTask)

  // When type-to-create fires, focus the input with the typed chars
  useEffect(() => {
    if (typeToCreate.isCreating && inputRef.current) {
      setNewTitle(typeToCreate.title)
      inputRef.current.focus()
      typeToCreate.cancel()
    }
  }, [typeToCreate.isCreating, typeToCreate.title, typeToCreate.cancel])

  async function handleCreate() {
    const raw = newTitle.trim()
    if (!raw) return
    setNewTitle('')

    const { title, tagIds } = await resolveTags(raw)
    if (!title) return

    createTask.mutate({ title, tag_ids: tagIds.length > 0 ? tagIds : undefined })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreate()
    }
    if (e.key === 'Escape') {
      setNewTitle('')
      inputRef.current?.blur()
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Inbox</h2>
      <div className="mb-4">
        <input
          ref={inputRef}
          data-new-task-input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onFocus={() => expandTask(null)}
          onKeyDown={handleKeyDown}
          placeholder="New task..."
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
          autoFocus
        />
        <TagAutocomplete inputRef={inputRef} value={newTitle} onChange={setNewTitle} />
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
      ) : data?.tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          Your inbox is empty. Nice work!
        </p>
      ) : (
        <SortableTaskList
          tasks={data?.tasks ?? []}
          sortField="sort_order_today"
          showProject={false}
        />
      )}
    </div>
  )
}
