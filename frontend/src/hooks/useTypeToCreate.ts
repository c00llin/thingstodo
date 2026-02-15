import { useState, useEffect, useCallback } from 'react'
import { useCreateTask } from './queries'

export function useTypeToCreate() {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const createTask = useCreateTask()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if already in an input/textarea or if modifier keys are held
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    ) {
      return
    }

    // Only trigger on printable characters
    if (e.key.length === 1 && !isCreating) {
      setIsCreating(true)
      setTitle(e.key)
    }
  }, [isCreating])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function save() {
    const trimmed = title.trim()
    if (trimmed) {
      createTask.mutate({ title: trimmed })
    }
    cancel()
  }

  function cancel() {
    setIsCreating(false)
    setTitle('')
  }

  return { isCreating, title, setTitle, save, cancel }
}
