import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useProjects, useAreas } from '../hooks/queries'

interface ProjectAutocompleteProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
}

interface AutocompleteItem {
  id: string
  title: string
  type: 'project' | 'area'
}

/**
 * Detect if cursor is inside the first $token and the token is still being typed.
 * Returns null if:
 * - No $ in the text before cursor
 * - The text after $ already matches a completed known name (followed by a space or at end)
 */
function getDollarToken(
  value: string,
  cursorPos: number,
  knownNames: string[],
): { start: number; partial: string } | null {
  const before = value.slice(0, cursorPos)
  const dollarIdx = before.indexOf('$')
  if (dollarIdx === -1) return null

  const partial = before.slice(dollarIdx + 1)

  // Check if the partial already matches a completed name
  // (i.e. known name followed by a space, meaning the user moved past it)
  for (const name of knownNames) {
    if (partial.toLowerCase().startsWith(name.toLowerCase() + ' ')) {
      return null // completed token, don't trigger autocomplete
    }
    // Also check if cursor is right at the end of the name + trailing space
    if (partial.toLowerCase() === name.toLowerCase() + ' ') {
      return null
    }
  }

  return { start: dollarIdx, partial }
}

export function ProjectAutocomplete({ inputRef, value, onChange }: ProjectAutocompleteProps) {
  const { data: projectsData } = useProjects()
  const { data: areasData } = useAreas()
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [token, setToken] = useState<{ start: number; partial: string } | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allItems: AutocompleteItem[] = useMemo(() => [
    ...(projectsData?.projects ?? []).map((p) => ({ id: p.id, title: p.title, type: 'project' as const })),
    ...(areasData?.areas ?? []).map((a) => ({ id: a.id, title: a.title, type: 'area' as const })),
  ], [projectsData, areasData])

  const knownNames = useMemo(() => allItems.map((i) => i.title), [allItems])
  const hasItems = allItems.length > 0
  const filtered = allItems.filter((item) =>
    item.title.toLowerCase().includes(token?.partial.toLowerCase() ?? '')
  )

  const prevPartialRef = useRef<string | null>(null)

  const updateToken = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? value.length
    const result = getDollarToken(value, cursorPos, knownNames)
    setToken(result)
    if (result && hasItems) {
      setOpen(true)
      if (result.partial !== prevPartialRef.current) {
        setHighlightIndex(0)
        prevPartialRef.current = result.partial
      }
    } else {
      setOpen(false)
      prevPartialRef.current = null
    }
  }, [inputRef, value, hasItems, knownNames])

  useEffect(() => {
    updateToken()
  }, [updateToken])

  // Position the dropdown at the $ character
  useEffect(() => {
    if (!open || !token || !inputRef.current) {
      setDropdownPos(null)
      return
    }
    const input = inputRef.current
    const rect = input.getBoundingClientRect()

    const span = measureRef.current
    if (span) {
      const style = window.getComputedStyle(input)
      span.style.font = style.font
      span.style.fontSize = style.fontSize
      span.style.fontFamily = style.fontFamily
      span.style.fontWeight = style.fontWeight
      span.style.letterSpacing = style.letterSpacing
      span.textContent = value.slice(0, token.start)
      const textWidth = span.offsetWidth
      const paddingLeft = parseFloat(style.paddingLeft)
      const scrollLeft = input.scrollLeft

      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + paddingLeft + textWidth - scrollLeft,
      })
    }
  }, [open, token, value, inputRef])

  const selectItem = useCallback((itemTitle: string) => {
    if (!token) return
    const before = value.slice(0, token.start)
    const after = value.slice(token.start + 1 + token.partial.length) // skip $ + partial
    const newValue = before + '$' + itemTitle + ' ' + after
    onChange(newValue)
    setOpen(false)

    const cursorPos = before.length + 1 + itemTitle.length + 1
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cursorPos, cursorPos)
    })
  }, [token, value, onChange, inputRef])

  // Keyboard handling
  useEffect(() => {
    const input = inputRef.current
    if (!input || !open || filtered.length === 0) return

    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setHighlightIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        if (filtered[highlightIndex]) {
          selectItem(filtered[highlightIndex].title)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }

    input.addEventListener('keydown', handleKeyDown, true)
    return () => input.removeEventListener('keydown', handleKeyDown, true)
  }, [open, filtered, highlightIndex, selectItem, inputRef])

  // Listen for cursor movement
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const navKeys = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'])
    const handleSelect = () => updateToken()
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!navKeys.has(e.key)) updateToken()
    }
    input.addEventListener('click', handleSelect)
    input.addEventListener('keyup', handleKeyUp)
    return () => {
      input.removeEventListener('click', handleSelect)
      input.removeEventListener('keyup', handleKeyUp)
    }
  }, [inputRef, updateToken])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !dropdownRef.current) return
    const item = dropdownRef.current.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlightIndex, open])

  return (
    <>
      <span
        ref={measureRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          pointerEvents: 'none',
        }}
      />
      {open && filtered.length > 0 && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
          }}
          className="max-h-48 min-w-[160px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800"
        >
          {filtered.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === highlightIndex
                  ? 'bg-red-50 text-neutral-900 dark:bg-red-900/20 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                selectItem(item.title)
              }}
            >
              <span>{item.title}</span>
              <span className="ml-3 text-xs text-neutral-400">{item.type}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
