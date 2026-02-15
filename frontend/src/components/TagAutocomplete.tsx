import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTags } from '../hooks/queries'

interface TagAutocompleteProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
}

/** Detect if cursor is inside a #tag token. Returns the partial text after # or null. */
function getHashToken(value: string, cursorPos: number): { start: number; partial: string } | null {
  // Look backwards from cursor for a # that starts a tag token
  const before = value.slice(0, cursorPos)
  const match = before.match(/#([^\s#]*)$/)
  if (!match) return null
  return { start: cursorPos - match[0].length, partial: match[1] }
}

export function TagAutocomplete({ inputRef, value, onChange }: TagAutocompleteProps) {
  const { data: tags } = useTags()
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [token, setToken] = useState<{ start: number; partial: string } | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allTags = tags?.tags ?? []
  const hasTags = allTags.length > 0
  const filtered = allTags.filter((t) =>
    t.title.toLowerCase().includes(token?.partial.toLowerCase() ?? '')
  )

  const prevPartialRef = useRef<string | null>(null)

  // Recompute token on value change or cursor movement
  const updateToken = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? value.length
    const result = getHashToken(value, cursorPos)
    setToken(result)
    if (result && hasTags) {
      setOpen(true)
      // Only reset highlight when the filter text actually changed
      if (result.partial !== prevPartialRef.current) {
        setHighlightIndex(0)
        prevPartialRef.current = result.partial
      }
    } else {
      setOpen(false)
      prevPartialRef.current = null
    }
  }, [inputRef, value, hasTags])

  useEffect(() => {
    updateToken()
  }, [updateToken])

  // Position the dropdown at the # character
  useEffect(() => {
    if (!open || !token || !inputRef.current) {
      setDropdownPos(null)
      return
    }
    const input = inputRef.current
    const rect = input.getBoundingClientRect()

    // Measure text width up to the # character
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
      // Account for padding and scroll
      const paddingLeft = parseFloat(style.paddingLeft)
      const scrollLeft = input.scrollLeft

      setDropdownPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX + paddingLeft + textWidth - scrollLeft,
      })
    }
  }, [open, token, value, inputRef])

  const selectTag = useCallback((tagTitle: string) => {
    if (!token) return
    const before = value.slice(0, token.start)
    const after = value.slice(token.start + 1 + token.partial.length) // skip # + partial
    const newValue = before + '#' + tagTitle + ' ' + after
    onChange(newValue)
    setOpen(false)

    // Restore cursor position after React re-renders
    const cursorPos = before.length + 1 + tagTitle.length + 1
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cursorPos, cursorPos)
    })
  }, [token, value, onChange, inputRef])

  // Keyboard handling — attach to the input element
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
          selectTag(filtered[highlightIndex].title)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }

    // Use capture phase to intercept before the input's own handlers
    input.addEventListener('keydown', handleKeyDown, true)
    return () => input.removeEventListener('keydown', handleKeyDown, true)
  }, [open, filtered, highlightIndex, selectTag, inputRef])

  // Listen for cursor movement (click, arrow keys) to re-evaluate token
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
      {/* Hidden span for text measurement */}
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
          className="max-h-48 min-w-[160px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
        >
          {filtered.map((tag, i) => (
            <button
              key={tag.id}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === highlightIndex
                  ? 'bg-blue-50 text-gray-900 dark:bg-blue-900/20 dark:text-gray-100'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent input blur
                selectTag(tag.title)
              }}
            >
              <span>{tag.title}</span>
              <span className="ml-3 text-xs text-gray-400">{tag.task_count}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
