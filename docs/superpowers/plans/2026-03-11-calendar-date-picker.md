# Calendar Date Picker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual calendar date picker to DateInput and replace raw `<input type="date">` in the bulk action toolbar with DateInput.

**Architecture:** New `DateCalendar` component (single-date picker, no ranges). Integrated into existing `DateInput` via calendar icon toggle. Bulk toolbar popovers updated to use `DateInput` instead of native date inputs.

**Tech Stack:** React 19, date-fns, Tailwind CSS 4, Lucide icons

---

## Chunk 1: DateCalendar Component + DateInput Integration + Toolbar Update

### Task 1: Create DateCalendar Component

**Files:**
- Create: `frontend/src/components/DateCalendar.tsx`

- [ ] **Step 1: Create the DateCalendar component**

```tsx
import { useState, useMemo } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DateCalendarProps {
  value: string | null
  onSelect: (date: string) => void
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export function DateCalendar({ value, onSelect }: DateCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (value && value !== 'someday') return new Date(value + 'T00:00:00')
    return new Date()
  })

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [viewMonth])

  return (
    <div className="w-[224px] p-2">
      {/* Month navigation */}
      <div className="mb-1 flex items-center justify-between">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {format(viewMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-medium text-neutral-400">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const selected = value && value !== 'someday' && isSameDay(day, new Date(value + 'T00:00:00'))
          const today = isSameDay(day, new Date())

          return (
            <button
              key={day.toISOString()}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(format(day, 'yyyy-MM-dd'))}
              className={`h-7 w-full rounded text-xs transition-colors ${
                !inMonth
                  ? 'text-neutral-300 dark:text-neutral-700'
                  : selected
                    ? 'bg-red-500 font-medium text-white'
                    : today
                      ? 'font-medium text-red-500'
                      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DateCalendar.tsx
git commit -m "feat: add DateCalendar single-date picker component"
```

### Task 2: Add Calendar Toggle to DateInput

**Files:**
- Modify: `frontend/src/components/DateInput.tsx`

The `DateInput` component needs:
1. A `showCalendar` state toggle
2. A calendar icon button on the right side of the input (and display button)
3. When `showCalendar` is true, render `DateCalendar` instead of suggestion dropdown

- [ ] **Step 1: Add calendar imports and state**

Add `Calendar` import from lucide-react and `DateCalendar` import. Add `showCalendar` state.

At top of file, add:
```tsx
import { Calendar } from 'lucide-react'
import { DateCalendar } from './DateCalendar'
```

Inside the component function, after the existing state declarations (`highlightIndex`), add:
```tsx
const [showCalendar, setShowCalendar] = useState(false)
```

- [ ] **Step 2: Update the select callback to reset calendar state**

Update the `select` callback to also reset `showCalendar`:

Replace:
```tsx
  const select = useCallback((s: Suggestion) => {
    onChange(s.date)
    setActive(false)
    setText('')
    inputRef.current?.blur()
    onComplete?.(s.date)
  }, [onChange, onComplete])
```

With:
```tsx
  const select = useCallback((s: Suggestion) => {
    onChange(s.date)
    setActive(false)
    setText('')
    setShowCalendar(false)
    inputRef.current?.blur()
    onComplete?.(s.date)
  }, [onChange, onComplete])
```

- [ ] **Step 3: Reset calendar in click-outside and Escape handlers**

In the click-outside `useEffect`, add `setShowCalendar(false)` alongside `setActive(false)`:

Replace:
```tsx
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(false)
        setText('')
        onComplete?.(value || null)
      }
    }
```

With:
```tsx
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(false)
        setText('')
        setShowCalendar(false)
        onComplete?.(value || null)
      }
    }
```

In the `handleKeyDown` Escape branch, add `setShowCalendar(false)`:

Replace:
```tsx
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setActive(false)
      setText('')
      inputRef.current?.blur()
      onComplete?.(value || null)
    }
```

With:
```tsx
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setActive(false)
      setText('')
      setShowCalendar(false)
      inputRef.current?.blur()
      onComplete?.(value || null)
    }
```

- [ ] **Step 4: Update display mode button to include calendar icon**

Replace the display mode block:
```tsx
  if (!active && value) {
    return (
      <button
        type="button"
        onClick={() => {
          setActive(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className={`w-full rounded-md border px-2 py-1 text-left text-sm ${fieldClassName ?? 'border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'}`}
      >
        {formatRelativeDate(value)}
      </button>
    )
  }
```

With:
```tsx
  if (!active && value) {
    return (
      <div ref={containerRef} className="relative">
        <div className={`flex w-full items-center rounded-md border text-sm ${fieldClassName ?? 'border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100'}`}>
          <button
            type="button"
            onClick={() => {
              setShowCalendar(false)
              setActive(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            className="flex-1 px-2 py-1 text-left"
          >
            {formatRelativeDate(value)}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCalendar(true)
              setActive(true)
            }}
            className="px-1.5 py-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
            aria-label="Open calendar"
          >
            <Calendar size={14} />
          </button>
        </div>

      </div>
    )
  }
```

Note: The calendar icon in display mode sets both `showCalendar(true)` and `setActive(true)`, which re-renders into the edit-mode branch where the calendar dropdown lives. No calendar dropdown is needed in the display-mode branch.

- [ ] **Step 5: Update edit mode to include calendar icon and conditional dropdown**

Replace the edit mode return block:
```tsx
  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setActive(true)}
        onKeyDown={handleKeyDown}
        placeholder={variant === 'when' ? 'When...' : 'Deadline...'}
        className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm focus:border-red-400 focus:outline-none dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        autoFocus={autoFocus}
      />

      {active && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === highlightIndex
                  ? 'bg-red-50 text-neutral-900 dark:bg-red-900/20 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                select(s)
              }}
            >
              <span>{s.label}</span>
              {s.detail && (
                <span className="ml-3 text-xs text-neutral-400">{s.detail}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
```

With:
```tsx
  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center rounded-md border border-neutral-200 bg-white dark:border-neutral-600 dark:bg-neutral-800 focus-within:border-red-400">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setShowCalendar(false) }}
          onFocus={() => setActive(true)}
          onKeyDown={handleKeyDown}
          placeholder={variant === 'when' ? 'When...' : 'Deadline...'}
          className="flex-1 bg-transparent px-2 py-1 text-sm focus:outline-none dark:text-neutral-100"
          autoFocus={autoFocus}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowCalendar((v) => !v)}
          className="px-1.5 py-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          aria-label="Open calendar"
        >
          <Calendar size={14} />
        </button>
      </div>

      {active && !showCalendar && suggestions.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                i === highlightIndex
                  ? 'bg-red-50 text-neutral-900 dark:bg-red-900/20 dark:text-neutral-100'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                select(s)
              }}
            >
              <span>{s.label}</span>
              {s.detail && (
                <span className="ml-3 text-xs text-neutral-400">{s.detail}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {active && showCalendar && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-800">
          <DateCalendar
            value={value}
            onSelect={(date) => select({ label: '', date })}
          />
        </div>
      )}
    </div>
  )
```

- [ ] **Step 6: Verify no type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DateInput.tsx
git commit -m "feat: add calendar toggle to DateInput component"
```

### Task 3: Update BulkActionToolbar Popovers

**Files:**
- Modify: `frontend/src/components/BulkActionToolbar.tsx`

Replace `WhenPopover` and `DeadlinePopover` to use `DateInput` instead of raw `<input type="date">`.

- [ ] **Step 1: Add DateInput import**

Add at the top of `BulkActionToolbar.tsx`:
```tsx
import { DateInput } from './DateInput'
```

Remove the `date-fns` import line entirely — `addDays` and `format` are no longer needed since DateInput handles suggestions internally.

Delete this line:
```tsx
import { addDays, format } from 'date-fns'
```

- [ ] **Step 2: Replace WhenPopover implementation**

Replace the entire `WhenPopover` function with:
```tsx
function WhenPopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10" aria-label="Set when" title="Set when">
          <Calendar size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass} style={{ minWidth: 224 }} onOpenAutoFocus={(e) => e.preventDefault()}>
          <DateInput
            value=""
            variant="when"
            autoFocus
            onChange={(date) => {
              if (date !== null) {
                onAction('set_when', { when_date: date })
                setOpen(false)
              }
            }}
            onComplete={() => setOpen(false)}
          />
          <button className={popoverItemClass + ' mt-1'}
            onClick={() => { onAction('set_when', { when_date: '' }); setOpen(false) }}>
            Clear date
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

Add a new import at the top of the file (BulkActionToolbar uses the JSX transform, so there is no existing React import to append to):
```tsx
import { useState } from 'react'
```

- [ ] **Step 3: Replace DeadlinePopover implementation**

Replace the entire `DeadlinePopover` function with:
```tsx
function DeadlinePopover({ onAction }: { onAction: (action: BulkActionType, params?: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="rounded-full p-2 hover:bg-black/10 dark:hover:bg-white/10" aria-label="Set deadline" title="Set deadline">
          <Flag size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={8} className={popoverContentClass} style={{ minWidth: 224 }} onOpenAutoFocus={(e) => e.preventDefault()}>
          <DateInput
            value=""
            variant="deadline"
            autoFocus
            onChange={(date) => {
              if (date !== null) {
                onAction('set_deadline', { deadline: date })
                setOpen(false)
              }
            }}
            onComplete={() => setOpen(false)}
          />
          <button className={popoverItemClass + ' mt-1'}
            onClick={() => { onAction('set_deadline', { deadline: '' }); setOpen(false) }}>
            Clear deadline
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

- [ ] **Step 4: Verify no type errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Verify dev server builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/BulkActionToolbar.tsx
git commit -m "feat: replace raw date inputs in bulk toolbar with DateInput"
```

### Task 4: Manual Smoke Test

- [ ] **Step 1: Start dev server**

Run: `make dev`

- [ ] **Step 2: Test DateInput calendar in task detail**

1. Open a task's detail panel
2. Click the "When" icon to show the when date field
3. Verify the text input shows with a calendar icon on the right
4. Type "tomorrow" — verify suggestion dropdown appears (NOT calendar)
5. Click the calendar icon — verify calendar grid appears (suggestions hide)
6. Click a date on the calendar — verify it's selected and field closes
7. Click the displayed date to re-enter edit mode — verify calendar icon is present
8. In display mode, click the calendar icon directly — verify calendar opens
9. Press Escape — verify calendar closes
10. Repeat for deadline field

- [ ] **Step 3: Test bulk toolbar dates**

1. Cmd+click two tasks to multi-select
2. Click the Calendar icon in the toolbar
3. Verify DateInput appears with suggestions and calendar toggle
4. Select "Tomorrow" from suggestions — verify popover closes and dates update
5. Re-open, click calendar icon, pick a date — verify it works
6. Test "Clear date" button
7. Repeat for Flag (deadline) icon

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address calendar date picker issues from smoke testing"
```
