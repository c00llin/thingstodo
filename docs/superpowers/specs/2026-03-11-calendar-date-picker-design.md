# Calendar Date Picker for Date Inputs

**Issue:** #42
**Date:** 2026-03-11

## Problem

Date inputs (when date, deadline) only support smart text entry. Users want a visual calendar picker option. The multi-select bulk toolbar uses raw `<input type="date">` instead of the same `DateInput` component.

## Design

### 1. New `DateCalendar` Component

A simple single-date calendar picker at `frontend/src/components/DateCalendar.tsx`.

**Props:**
```typescript
interface DateCalendarProps {
  value: string | null        // ISO date string (yyyy-MM-dd) or null
  onSelect: (date: string) => void  // Called when a day is clicked
}
```

**Behavior:**
- Month grid with weekday headers (Mo–Su), prev/next month navigation
- Today highlighted with red text, selected date with red background
- Out-of-month days shown in muted color
- Clicking a day calls `onSelect` with ISO date string
- Week starts on Monday (consistent with existing `CalendarPicker`)

**Styling:** Matches existing `CalendarPicker` visual style (neutral palette, red accent, dark mode support) but without range selection, presets, or clear button.

### 2. Update `DateInput`

Add a calendar toggle to the existing `DateInput` component.

**Changes:**
- Add `showCalendar` boolean state (default false)
- Render a small calendar icon button on the right side of the input field
- Clicking the icon toggles between suggestion dropdown and `DateCalendar`
- Calendar icon also appears on the display-mode button (when value is set)
- Selecting a date from calendar calls the same `select()` flow (onChange, onComplete, close)
- Pressing Escape or clicking outside closes calendar (same as suggestions)
- Calendar icon in display mode: small calendar icon on the right of the button

### 3. Update `BulkActionToolbar` Popovers

Replace `WhenPopover` and `DeadlinePopover` internals.

**WhenPopover — replace with:**
- `DateInput` component with variant="when"
- Auto-close popover on date selection via `onComplete`
- Keep "Clear date" button below

**DeadlinePopover — replace with:**
- `DateInput` component with variant="deadline"
- Auto-close popover on date selection via `onComplete`
- Keep "Clear deadline" button below

This gives bulk toolbar users the same smart text input, suggestions, and calendar picker as the task detail view.

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/DateCalendar.tsx` | Create — new single-date calendar component |
| `frontend/src/components/DateInput.tsx` | Modify — add calendar toggle, integrate DateCalendar |
| `frontend/src/components/BulkActionToolbar.tsx` | Modify — replace WhenPopover/DeadlinePopover with DateInput |

## Out of Scope

- Range selection (filter calendar handles that)
- Time picking (separate TimeInput component)
- Recurring date patterns (handled by recurrence system)
