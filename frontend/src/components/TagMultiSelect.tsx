import { useState, useRef, useEffect } from 'react'
import { Tag, X, Check, Plus } from 'lucide-react'
import { useTags, useCreateTag, useUpdateTask } from '../hooks/queries'
import { getTagPillClasses } from '../lib/tag-colors'
import type { TaskDetail } from '../api/types'

interface TagMultiSelectBaseProps {
  externalOpen?: boolean
  onExternalOpenChange?: (open: boolean) => void
  /** Called when the dropdown closes (Escape or outside click). */
  onClose?: () => void
}

interface TagMultiSelectTaskProps extends TagMultiSelectBaseProps {
  task: TaskDetail
  controlledTagIds?: never
  onControlledChange?: never
}

interface TagMultiSelectControlledProps extends TagMultiSelectBaseProps {
  task?: never
  controlledTagIds: string[]
  onControlledChange: (ids: string[]) => void
}

type TagMultiSelectProps = TagMultiSelectTaskProps | TagMultiSelectControlledProps

export function TagMultiSelect(props: TagMultiSelectProps) {
  const { externalOpen, onExternalOpenChange, onClose } = props

  const [internalOpen, setInternalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { data: tagsData } = useTags()
  const allTags = tagsData?.tags
  const updateTask = useUpdateTask()
  const createTag = useCreateTag()

  // Controlled vs task mode
  const isControlled = 'controlledTagIds' in props && props.controlledTagIds !== undefined
  const task = isControlled ? undefined : props.task
  const controlledTagIds = isControlled ? props.controlledTagIds : undefined
  const onControlledChange = isControlled ? props.onControlledChange : undefined

  const currentTagIds = new Set(
    isControlled
      ? controlledTagIds!
      : task!.tags.map((t) => t.id)
  )

  // Resolve tag objects for pills display in controlled mode
  const currentTags = isControlled
    ? allTags?.filter((t) => controlledTagIds!.includes(t.id)) ?? []
    : task!.tags

  const open = externalOpen !== undefined ? (externalOpen || internalOpen) : internalOpen

  function doOpen() {
    setInternalOpen(true)
    onExternalOpenChange?.(true)
  }

  function doClose() {
    setInternalOpen(false)
    setSearch('')
    onExternalOpenChange?.(false)
    onClose?.()
  }

  // Sync external open → internal
  useEffect(() => {
    if (externalOpen && !internalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInternalOpen(true)
    }
  }, [externalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        doClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHighlightIndex(-1)
    }
  }, [open])

  // Reset highlight when search changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightIndex(-1)
  }, [search])

  function toggleTag(tagId: string) {
    const newIds = new Set(currentTagIds)
    if (newIds.has(tagId)) {
      newIds.delete(tagId)
    } else {
      newIds.add(tagId)
    }
    const idsArray = [...newIds]
    if (isControlled) {
      onControlledChange!(idsArray)
    } else {
      updateTask.mutate({ id: task!.id, data: { tag_ids: idsArray } })
    }
  }

  function removeTag(tagId: string) {
    const newIds = [...currentTagIds].filter((id) => id !== tagId)
    if (isControlled) {
      onControlledChange!(newIds)
    } else {
      updateTask.mutate({ id: task!.id, data: { tag_ids: newIds } })
    }
  }

  async function handleCreateTag() {
    const trimmed = search.trim()
    if (!trimmed) return
    const newTag = await createTag.mutateAsync({ title: trimmed })
    const newIds = [...currentTagIds, newTag.id]
    if (isControlled) {
      onControlledChange!(newIds)
    } else {
      updateTask.mutate({ id: task!.id, data: { tag_ids: newIds } })
    }
    setSearch('')
  }

  const searchLower = search.trim().toLowerCase()
  const filteredTags = allTags?.filter((tag) =>
    tag.title.toLowerCase().includes(searchLower)
  )
  const exactMatch = allTags?.some(
    (tag) => tag.title.toLowerCase() === searchLower
  )
  const showCreateOption = searchLower.length > 0 && !exactMatch

  // Total selectable items for keyboard navigation
  const totalItems = (showCreateOption ? 1 : 0) + (filteredTags?.length ?? 0)

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, totalItems - 1))
      // Scroll highlighted item into view
      requestAnimationFrame(() => {
        listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' })
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, -1))
      requestAnimationFrame(() => {
        listRef.current?.querySelector('[data-highlighted="true"]')?.scrollIntoView({ block: 'nearest' })
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (highlightIndex >= 0) {
        const createOffset = showCreateOption ? 1 : 0
        if (showCreateOption && highlightIndex === 0) {
          handleCreateTag()
        } else {
          const tagIndex = highlightIndex - createOffset
          const tag = filteredTags?.[tagIndex]
          if (tag) toggleTag(tag.id)
        }
      } else if (showCreateOption) {
        handleCreateTag()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      doClose()
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Current tags as pills + add button */}
      <div className="flex flex-wrap items-center gap-1.5">
        {currentTags.map((tag) => (
          <span
            key={tag.id}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getTagPillClasses(tag.color)}`}
          >
            {tag.title}
            <button
              onClick={() => removeTag(tag.id)}
              className="rounded-full p-0.5 opacity-60 hover:opacity-100"
              aria-label={`Remove ${tag.title}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <button
          onClick={() => open ? doClose() : doOpen()}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
        >
          <Tag size={14} />
          <span>{currentTags.length === 0 ? 'Add tag' : '+'}</span>
        </button>
      </div>

      {/* Dropdown */}
      {open && allTags && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800">
          {/* Search / create input */}
          <div className="border-b border-neutral-100 px-3 py-2 dark:border-neutral-700">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search or create…"
              className="w-full bg-transparent text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder-neutral-500"
            />
          </div>

          <div ref={listRef} className="max-h-52 overflow-y-auto py-1">
            {/* Create new tag option */}
            {showCreateOption && (
              <button
                onClick={handleCreateTag}
                disabled={createTag.isPending}
                data-highlighted={highlightIndex === 0}
                onMouseEnter={() => setHighlightIndex(0)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 dark:text-red-400 ${
                  highlightIndex === 0
                    ? 'bg-neutral-100 dark:bg-neutral-700'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                <Plus size={14} />
                <span>Create &ldquo;{search.trim()}&rdquo;</span>
              </button>
            )}

            {/* Existing tags */}
            {filteredTags?.map((tag, i) => {
              const isSelected = currentTagIds.has(tag.id)
              const itemIndex = (showCreateOption ? 1 : 0) + i
              const isHighlighted = highlightIndex === itemIndex
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  data-highlighted={isHighlighted}
                  onMouseEnter={() => setHighlightIndex(itemIndex)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    isHighlighted
                      ? 'bg-neutral-100 dark:bg-neutral-700'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                  }`}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                    isSelected
                      ? 'bg-red-500 text-white'
                      : 'border border-neutral-300 dark:border-neutral-600'
                  }`}>
                    {isSelected && <Check size={12} />}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTagPillClasses(tag.color)}`}
                  >
                    {tag.title}
                  </span>
                </button>
              )
            })}

            {filteredTags?.length === 0 && !showCreateOption && (
              <p className="px-3 py-2 text-sm text-neutral-400 dark:text-neutral-500">No tags found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
