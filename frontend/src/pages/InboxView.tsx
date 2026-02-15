import { useState, useRef, useEffect } from 'react'
import { useInbox, useCreateTask } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { useTypeToCreate } from '../hooks/useTypeToCreate'
import { useAppStore } from '../stores/app'
import { useResolveTags } from '../hooks/useResolveTags'
import { TagAutocomplete } from '../components/TagAutocomplete'
import { ProjectAutocomplete } from '../components/ProjectAutocomplete'

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

    const { title, tagIds, projectId, areaId } = await resolveTags(raw)
    if (!title) return

    createTask.mutate({
      title,
      tag_ids: tagIds.length > 0 ? tagIds : undefined,
      project_id: projectId ?? undefined,
      area_id: areaId ?? undefined,
    })
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
      <h2 className="mb-6 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Inbox</h2>
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
          className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          autoFocus
        />
        <TagAutocomplete inputRef={inputRef} value={newTitle} onChange={setNewTitle} />
        <ProjectAutocomplete inputRef={inputRef} value={newTitle} onChange={setNewTitle} />
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Loading...</p>
      ) : data?.tasks.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
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
