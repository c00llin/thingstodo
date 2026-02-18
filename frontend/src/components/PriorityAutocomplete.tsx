import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CircleAlert } from 'lucide-react'

interface PriorityAutocompleteProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  value: string
  onChange: (value: string) => void
  onSetHighPriority: () => void
}

/** Detect if cursor is inside a !token. Returns the partial text after ! or null. */
function getExclamationToken(value: string, cursorPos: number): { start: number; partial: string } | null {
  const before = value.slice(0, cursorPos)
  const match = before.match(/!([^\s!]*)$/)
  if (!match) return null
  return { start: cursorPos - match[0].length, partial: match[1] }
}

export function PriorityAutocomplete({ inputRef, value, onChange, onSetHighPriority }: PriorityAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<{ start: number; partial: string } | null>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const measureRef = useRef<HTMLSpanElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const matches = token ? 'high priority'.startsWith(token.partial.toLowerCase()) : false

  const updateToken = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const cursorPos = input.selectionStart ?? value.length
    const result = getExclamationToken(value, cursorPos)
    setToken(result)
    if (result && 'high priority'.startsWith(result.partial.toLowerCase())) {
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [inputRef, value])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives dropdown state from input value
    updateToken()
  }, [updateToken])

  // Position the dropdown at the ! character
  useEffect(() => {
    if (!open || !token || !inputRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing dropdown position
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

  const selectPriority = useCallback(() => {
    if (!token) return
    const before = value.slice(0, token.start)
    const after = value.slice(token.start + 1 + token.partial.length) // skip ! + partial
    const newValue = (before + after).replace(/\s+$/, '') + (after ? '' : '')
    onChange(newValue.trimEnd())
    setOpen(false)
    onSetHighPriority()

    const cursorPos = before.length
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(cursorPos, cursorPos)
    })
  }, [token, value, onChange, onSetHighPriority, inputRef])

  // Keyboard handling
  useEffect(() => {
    const input = inputRef.current
    if (!input || !open || !matches) return

    function handleKeyDown(e: KeyboardEvent) {
      if (!open) return

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        selectPriority()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
      }
    }

    input.addEventListener('keydown', handleKeyDown, true)
    return () => input.removeEventListener('keydown', handleKeyDown, true)
  }, [open, matches, selectPriority, inputRef])

  // Listen for cursor movement to re-evaluate token
  useEffect(() => {
    const input = inputRef.current
    if (!input) return

    const navKeys = new Set(['Enter', 'Tab', 'Escape'])
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
      {open && matches && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: dropdownPos.top,
            left: dropdownPos.left,
            zIndex: 9999,
          }}
          className="min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 bg-red-50 px-3 py-1.5 text-left text-sm text-neutral-900 dark:bg-red-900/20 dark:text-neutral-100"
            onMouseDown={(e) => {
              e.preventDefault()
              selectPriority()
            }}
          >
            <CircleAlert size={14} className="text-red-500" />
            <span>High Priority</span>
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
