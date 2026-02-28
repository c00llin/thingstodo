import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { parseTime } from '../lib/time-parser'
import { formatTime } from '../lib/format-time'

interface TimeInputProps {
  value: string | null
  onChange: (time: string | null) => void
  /** Called when the user leaves the input without entering a value. */
  onBlurEmpty?: () => void
  placeholder?: string
  timeFormat: '12h' | '24h'
  /** Extra classes applied to the button/input field */
  fieldClassName?: string
}

export interface TimeInputHandle {
  focus: () => void
}

export const TimeInput = forwardRef<TimeInputHandle, TimeInputProps>(
  function TimeInput({ value, onChange, onBlurEmpty, placeholder = 'Time...', timeFormat, fieldClassName }, ref) {
    const [editing, setEditing] = useState(false)
    const [text, setText] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus() {
        setEditing(true)
      },
    }))

    useEffect(() => {
      if (editing && inputRef.current) {
        inputRef.current.focus()
      }
    }, [editing])

    function commit() {
      setEditing(false)
      const trimmed = text.trim()
      if (trimmed) {
        const parsed = parseTime(trimmed)
        if (parsed) {
          onChange(parsed)
        }
      } else {
        onBlurEmpty?.()
      }
      setText('')
    }

    function handleKeyDown(e: React.KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setEditing(false)
        setText('')
      }
    }

    if (!editing && value) {
      return (
        <button
          type="button"
          onClick={() => {
            setText(value)
            setEditing(true)
          }}
          className={`w-20 rounded-md border px-2 py-1 text-center text-sm ${fieldClassName ?? 'border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'}`}
        >
          {formatTime(value, timeFormat)}
        </button>
      )
    }

    if (!editing) {
      return (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-20 text-center text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          {placeholder}
        </button>
      )
    }

    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder="e.g. 9am"
        className="w-20 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
      />
    )
  },
)
