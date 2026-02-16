import { useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app'

export function useTypeToCreate() {
  const openQuickEntry = useAppStore((s) => s.openQuickEntry)
  const quickEntryOpen = useAppStore((s) => s.quickEntryOpen)

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

    // Only trigger on printable characters; skip 'q' which is handled as a shortcut
    if (e.key.length === 1 && e.key !== 'q' && !quickEntryOpen) {
      openQuickEntry(e.key)
    }
  }, [quickEntryOpen, openQuickEntry])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
