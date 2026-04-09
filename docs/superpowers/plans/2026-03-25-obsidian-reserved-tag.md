# Obsidian Reserved Tag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "obsidian" as a reserved/protected tag with the same rules as "siyuan" — reserved name on backend, custom Obsidian icon, hidden from autocomplete/multiselect, preserved through inline edits, and shown as an icon instead of a pill in task rows.

**Architecture:** Generalize the existing siyuan-specific helpers into a shared "reserved tags" system in `frontend/src/lib/siyuan.ts` (renamed to `reserved-tags.ts`), add an `ObsidianIcon` component, and add `"obsidian"` to the backend reserved-name check. Every location that currently calls `isSiYuanTag()` will be updated to call a generalized `isReservedTag()`, and icon rendering will dispatch based on which reserved tag it is.

**Tech Stack:** React, TypeScript, Go, Tailwind CSS

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Rename+Modify | `frontend/src/lib/siyuan.ts` → `frontend/src/lib/reserved-tags.ts` | All reserved tag/anchor detection helpers |
| Create | `frontend/src/components/ObsidianIcon.tsx` | Obsidian SVG icon component |
| Modify | `frontend/src/components/SiYuanIcon.tsx` | No changes (kept as-is) |
| Create | `frontend/src/components/ReservedTagIcon.tsx` | Dispatcher: renders correct icon for a reserved tag |
| Modify | `frontend/src/components/TaskItem.tsx` | Use `isReservedTag` + `ReservedTagIcon` |
| Modify | `frontend/src/components/SortableTaskItem.tsx` | Use `isReservedTag` + `ReservedTagIcon` |
| Modify | `frontend/src/components/TaskItemDragOverlay.tsx` | Use `isReservedTag` + `ReservedTagIcon` |
| Modify | `frontend/src/components/TaskDetail.tsx` | Use `isReservedAnchor` (updated), `isReservedLink`, `hasReservedLink` |
| Modify | `frontend/src/components/Sidebar.tsx` | Use `isReservedTag` + `ReservedTagIcon`, wrap in plain div (no drop target) |
| Modify | `frontend/src/components/TagMultiSelect.tsx` | Use `isReservedTag` |
| Modify | `frontend/src/components/TagAutocomplete.tsx` | Use `isReservedTag` |
| Modify | `frontend/src/hooks/useResolveTags.ts` | Use `isReservedTag` |
| Modify | `internal/handler/tags.go` | Add `"obsidian"` to reserved name check |

---

### Task 1: Backend — Reserve "obsidian" tag name

**Files:**
- Modify: `internal/handler/tags.go` (lines ~43 and ~72)

- [ ] **Step 1: Update Create handler to block "obsidian"**

In `internal/handler/tags.go`, replace the single-name check with a set check in the `Create` handler:

```go
// Replace:
if input.Title == "siyuan" {
    writeError(w, http.StatusForbidden, `"siyuan" is a reserved tag name`, "RESERVED")
    return
}

// With:
if input.Title == "siyuan" || input.Title == "obsidian" {
    writeError(w, http.StatusForbidden, fmt.Sprintf("%q is a reserved tag name", input.Title), "RESERVED")
    return
}
```

- [ ] **Step 2: Update Update handler to block "obsidian"**

Same change in the `Update` handler:

```go
// Replace:
if lower == "siyuan" {
    writeError(w, http.StatusForbidden, `"siyuan" is a reserved tag name`, "RESERVED")
    return
}

// With:
if lower == "siyuan" || lower == "obsidian" {
    writeError(w, http.StatusForbidden, fmt.Sprintf("%q is a reserved tag name", lower), "RESERVED")
    return
}
```

- [ ] **Step 3: Run backend tests**

Run: `go test ./internal/handler/...`
Expected: PASS (existing tests still pass)

- [ ] **Step 4: Commit**

```bash
git add internal/handler/tags.go
git commit -m "feat: reserve 'obsidian' as a protected tag name"
```

---

### Task 2: Frontend — Generalize reserved-tag helpers

**Files:**
- Rename+Modify: `frontend/src/lib/siyuan.ts` → `frontend/src/lib/reserved-tags.ts`

- [ ] **Step 1: Create `reserved-tags.ts` with generalized helpers**

Create `frontend/src/lib/reserved-tags.ts`:

```typescript
import type { Attachment } from '../api/types'

const RESERVED_TAGS = ['siyuan', 'obsidian'] as const
const RESERVED_ANCHORS = ['siyuan', 'obsidian'] as const

export type ReservedTagName = (typeof RESERVED_TAGS)[number]

// --- Tag helpers ---

export function isReservedTag(title: string): boolean {
  return RESERVED_TAGS.includes(title.toLowerCase() as ReservedTagName)
}

export function isSiYuanTag(title: string): boolean {
  return title.toLowerCase() === 'siyuan'
}

export function isObsidianTag(title: string): boolean {
  return title.toLowerCase() === 'obsidian'
}

// --- Link/anchor helpers ---

export function isReservedAnchor(title: string): boolean {
  return RESERVED_ANCHORS.includes(title.toLowerCase() as ReservedTagName)
}

export function isReservedLink(att: Attachment): boolean {
  return att.type === 'link' && isReservedAnchor(att.title)
}

export function hasReservedLink(attachments: Attachment[]): boolean {
  return attachments.some(isReservedLink)
}

// Legacy re-exports for backwards compat during migration
export const SIYUAN_TAG = 'siyuan' as const
export function isSiYuanLink(att: Attachment): boolean {
  return att.type === 'link' && att.title.toLowerCase() === 'siyuan'
}
export function hasSiYuanLink(attachments: Attachment[]): boolean {
  return attachments.some(isSiYuanLink)
}
```

- [ ] **Step 2: Delete `frontend/src/lib/siyuan.ts`**

Remove the old file — all imports will be updated in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/reserved-tags.ts
git rm frontend/src/lib/siyuan.ts
git commit -m "refactor: generalize siyuan helpers into reserved-tags module"
```

---

### Task 3: Frontend — Create ObsidianIcon and ReservedTagIcon

**Files:**
- Create: `frontend/src/components/ObsidianIcon.tsx`
- Create: `frontend/src/components/ReservedTagIcon.tsx`

- [ ] **Step 1: Create ObsidianIcon component**

Create `frontend/src/components/ObsidianIcon.tsx` using the official Obsidian logo SVG from Simple Icons:

```tsx
interface ObsidianIconProps {
  size?: number
  className?: string
}

export function ObsidianIcon({ size = 16, className }: ObsidianIconProps) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
    >
      <path d="M16.1 0a1.139 1.139 0 00-.485.828c-.06.454.05.908.303 1.278.674 1.028 1.39 2.025 2.08 3.04.248.38.504.756.695 1.166.321.677.167 1.449-.358 1.967a6.38 6.38 0 00-.728.84 6.093 6.093 0 00-.894 2.1c-.222 1.005-.168 2.046.157 3.03.118.41.307.854.635 1.138.178-.44.281-.907.306-1.38a4.073 4.073 0 01.484-1.727c.378-.652.94-1.17 1.478-1.69a2.8 2.8 0 00.916-2.201 2.8 2.8 0 00-.234-.973c-.496-1.2-1.279-2.255-1.974-3.345C18.04 3.3 17.462 2.387 16.935 1.44A2.174 2.174 0 0016.1 0zm-3.39 2.72a2.609 2.609 0 00-1.595.568 2.608 2.608 0 00-.925 1.386c-.202.726-.12 1.492.143 2.2.427 1.08.983 2.113 1.556 3.12.32.564.655 1.12.934 1.706.371.768.582 1.606.617 2.453a5.58 5.58 0 01-.36 2.259c-.205.524-.49 1.016-.765 1.507-.478.854-.97 1.723-1.163 2.699a4.277 4.277 0 00.142 2.18c.17.494.424.956.75 1.36.15-.662.417-1.294.789-1.862a5.93 5.93 0 011.56-1.685c.452-.327.955-.588 1.398-.917a3.466 3.466 0 001.252-1.804c.29-.992.23-2.053-.03-3.044a12.04 12.04 0 00-.898-2.2c-.547-1.04-1.146-2.054-1.714-3.083-.499-.907-.952-1.852-1.2-2.864a3.694 3.694 0 01-.08-1.512c.059-.33.206-.741.533-.862.04-.015.06-.037.05-.054zM7.564 6.382a1.668 1.668 0 00-.988.474c-.378.37-.58.884-.714 1.393-.212.851-.223 1.736-.148 2.607.138 1.439.474 2.856.79 4.268.158.694.303 1.39.404 2.093.144 1.01.181 2.035.032 3.046a4.792 4.792 0 01-.858 2.071c-.224.297-.491.565-.694.876-.222.332-.37.71-.41 1.1a2.258 2.258 0 00.402 1.486c.248-.487.6-.916 1.03-1.254a5.003 5.003 0 012.46-1.073c.503-.092 1.013-.123 1.518-.199a3.2 3.2 0 001.483-.575c.805-.614 1.158-1.63 1.26-2.608.118-1.054-.001-2.116-.204-3.155a23.244 23.244 0 00-.755-2.891c-.413-1.283-.89-2.556-1.534-3.75a8.073 8.073 0 00-.851-1.266 3.18 3.18 0 00-1.162-.912 1.668 1.668 0 00-.261-.081z" />
    </svg>
  )
}
```

- [ ] **Step 2: Create ReservedTagIcon dispatcher**

Create `frontend/src/components/ReservedTagIcon.tsx`:

```tsx
import { SiYuanIcon } from './SiYuanIcon'
import { ObsidianIcon } from './ObsidianIcon'
import { isSiYuanTag, isObsidianTag } from '../lib/reserved-tags'

interface ReservedTagIconProps {
  tagTitle: string
  size?: number
  className?: string
}

export function ReservedTagIcon({ tagTitle, size = 16, className }: ReservedTagIconProps) {
  if (isSiYuanTag(tagTitle)) {
    return <SiYuanIcon size={size} className={className} />
  }
  if (isObsidianTag(tagTitle)) {
    return <ObsidianIcon size={size} className={className} />
  }
  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ObsidianIcon.tsx frontend/src/components/ReservedTagIcon.tsx
git commit -m "feat: add ObsidianIcon and ReservedTagIcon dispatcher"
```

---

### Task 4: Frontend — Update all consumers to use reserved-tags

**Files:**
- Modify: `frontend/src/components/TagMultiSelect.tsx`
- Modify: `frontend/src/components/TagAutocomplete.tsx`
- Modify: `frontend/src/hooks/useResolveTags.ts`

These three files only use `isSiYuanTag` for filtering — they just need the import path updated and the function swapped to `isReservedTag`.

- [ ] **Step 1: Update TagMultiSelect.tsx**

```typescript
// Replace import:
import { isSiYuanTag } from '../lib/siyuan'
// With:
import { isReservedTag } from '../lib/reserved-tags'

// Replace usage (~line 155):
// !isSiYuanTag(tag.title)
// With:
// !isReservedTag(tag.title)
```

- [ ] **Step 2: Update TagAutocomplete.tsx**

```typescript
// Replace import:
import { isSiYuanTag } from '../lib/siyuan'
// With:
import { isReservedTag } from '../lib/reserved-tags'

// Replace usage (~line 33):
// .filter((t) => !isSiYuanTag(t.title))
// With:
// .filter((t) => !isReservedTag(t.title))
```

- [ ] **Step 3: Update useResolveTags.ts**

```typescript
// Replace import:
import { isSiYuanTag } from '../lib/siyuan'
// With:
import { isReservedTag } from '../lib/reserved-tags'

// Replace usage (~line 38):
// if (isSiYuanTag(name)) continue
// With:
// if (isReservedTag(name)) continue
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TagMultiSelect.tsx frontend/src/components/TagAutocomplete.tsx frontend/src/hooks/useResolveTags.ts
git commit -m "refactor: use isReservedTag in autocomplete and tag resolution"
```

---

### Task 5: Frontend — Update TaskItem, SortableTaskItem, TaskItemDragOverlay

**Files:**
- Modify: `frontend/src/components/TaskItem.tsx`
- Modify: `frontend/src/components/SortableTaskItem.tsx`
- Modify: `frontend/src/components/TaskItemDragOverlay.tsx`

All three follow the same pattern: replace `isSiYuanTag` import with `isReservedTag`, replace `SiYuanIcon` with `ReservedTagIcon`, and update the inline error message.

- [ ] **Step 1: Update TaskItem.tsx**

```typescript
// Replace imports:
import { isSiYuanTag } from '../lib/siyuan'
import { SiYuanIcon } from './SiYuanIcon'
// With:
import { isReservedTag } from '../lib/reserved-tags'
import { ReservedTagIcon } from './ReservedTagIcon'

// Replace siyuanError state name → reservedError (and siyuanErrorTimerRef → reservedErrorTimerRef)
const [reservedError, setReservedError] = useState<string | null>(null)
const reservedErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// In getEditTitle (~line 91):
// task.tags.filter((t) => !isSiYuanTag(t.title))
// →
// task.tags.filter((t) => !isReservedTag(t.title))

// In save handler (~line 202):
// const siyuanTagIds = task.tags.filter((t) => isSiYuanTag(t.title)).map((t) => t.id)
// →
// const reservedTagIds = task.tags.filter((t) => isReservedTag(t.title)).map((t) => t.id)
// And: tag_ids: [...tagIds, ...reservedTagIds]

// In onChange handler (~line 235-241), detect ALL reserved tags:
const tagMatches = [...value.matchAll(/#([\w-]+)/g)]
const reservedMatch = tagMatches.find((m) => isReservedTag(m[1]))
if (reservedMatch) {
  if (reservedErrorTimerRef.current) clearTimeout(reservedErrorTimerRef.current)
  setReservedError(`"${reservedMatch[1]}" is a reserved tag`)
  reservedErrorTimerRef.current = setTimeout(() => setReservedError(null), 2000)
}

// In render — reserved tag icons (~line 383-384):
// task.tags.filter((t) => isSiYuanTag(t.title)).map((tag) => (
//   <SiYuanIcon key={tag.id} size={14} className={...} />
// ))
// →
{!editing && task.tags.filter((t) => isReservedTag(t.title)).map((tag) => (
  <ReservedTagIcon key={tag.id} tagTitle={tag.title} size={14} className={getTagIconClass(tag.color) || 'text-neutral-400'} />
))}

// Normal tag pills (~line 386):
// task.tags.filter((t) => !isSiYuanTag(t.title))
// →
// task.tags.filter((t) => !isReservedTag(t.title))

// Link icon visibility (~line 410):
// !task.tags.some((t) => isSiYuanTag(t.title))
// →
// !task.tags.some((t) => isReservedTag(t.title))

// Error display (~line 458):
// {siyuanError && ... → {reservedError && ...
```

- [ ] **Step 2: Update SortableTaskItem.tsx**

Exact same pattern as TaskItem.tsx — same imports, same state renames, same render changes. This file mirrors TaskItem line-for-line for the relevant sections.

- [ ] **Step 3: Update TaskItemDragOverlay.tsx**

```typescript
// Replace imports:
import { isSiYuanTag } from '../lib/siyuan'
import { SiYuanIcon } from './SiYuanIcon'
// With:
import { isReservedTag } from '../lib/reserved-tags'
import { ReservedTagIcon } from './ReservedTagIcon'

// Replace icon rendering (~line 57-58):
// task.tags.filter((t) => isSiYuanTag(t.title)).map((tag) => (
//   <SiYuanIcon ... />
// ))
// →
{task.tags.filter((t) => isReservedTag(t.title)).map((tag) => (
  <ReservedTagIcon key={tag.id} tagTitle={tag.title} size={14} className={getTagIconClass(tag.color) || 'text-neutral-400'} />
))}

// Normal tag pills (~line 60):
// !isSiYuanTag → !isReservedTag

// Link icon (~line 72):
// !task.tags.some((t) => isSiYuanTag(t.title)) → !task.tags.some((t) => isReservedTag(t.title))
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TaskItem.tsx frontend/src/components/SortableTaskItem.tsx frontend/src/components/TaskItemDragOverlay.tsx
git commit -m "feat: show obsidian icon for reserved tags in task rows"
```

---

### Task 6: Frontend — Update TaskDetail

**Files:**
- Modify: `frontend/src/components/TaskDetail.tsx`

- [ ] **Step 1: Update imports**

```typescript
// Replace:
import { isSiYuanLink, hasSiYuanLink, isReservedAnchor } from '../lib/siyuan'
// With:
import { isReservedLink, hasReservedLink, isReservedAnchor } from '../lib/reserved-tags'
```

- [ ] **Step 2: Update hasSiYuan check and link protection**

```typescript
// ~line 295: Replace:
// const hasSiYuan = hasSiYuanLink(task.attachments)
// With:
const hasReserved = hasReservedLink(task.attachments)

// ~line 442: Replace hasSiYuan references:
// {hasSiYuan || hasMultipleSchedules ? (
// →
// {hasReserved || hasMultipleSchedules ? (

// Update aria-label/title strings (~line 446-447) to say "reserved link" instead of "SiYuan link":
aria-label={hasMultipleSchedules ? 'Recurring not available with multiple dates' : hasRepeatRule ? 'Has a repeat rule — remove reserved link to edit' : 'Recurring not available for linked tasks'}
title={hasMultipleSchedules ? 'Recurring not available with multiple dates' : hasRepeatRule ? 'Has a repeat rule — remove reserved link to edit' : 'Recurring not available for linked tasks'}
```

- [ ] **Step 3: Update link deletion protection**

```typescript
// ~line 767: Replace:
// {!isSiYuanLink(att) && (
// With:
// {!isReservedLink(att) && (
```

- [ ] **Step 4: Update reserved anchor error message**

```typescript
// ~line 832-833: The isReservedAnchor check already covers both.
// Just update the error message:
if (isReservedAnchor(title)) {
  setLinkError(`"${title}" is a reserved link name`)
  return
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TaskDetail.tsx
git commit -m "feat: protect obsidian links same as siyuan in task detail"
```

---

### Task 7: Frontend — Update Sidebar

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Update imports**

```typescript
// Replace:
import { isSiYuanTag } from '../lib/siyuan'
import { SiYuanIcon } from './SiYuanIcon'
// With:
import { isReservedTag } from '../lib/reserved-tags'
import { ReservedTagIcon } from './ReservedTagIcon'
```

- [ ] **Step 2: Update TagSidebarItem icon rendering**

In the collapsed sidebar tag icon (~line 739-742):
```tsx
// Replace:
// {isSiYuanTag(tag.title) ? (
//   <SiYuanIcon size={iconSize} className={`relative z-10 ${iconColorClass || 'text-neutral-400'}`} />
// ) : (
// With:
{isReservedTag(tag.title) ? (
  <ReservedTagIcon tagTitle={tag.title} size={iconSize} className={`relative z-10 ${iconColorClass || 'text-neutral-400'}`} />
) : (
```

In the expanded sidebar icon button (~line 800-803):
```tsx
// Replace:
// className={`relative z-10 ${iconColorClass || (isSiYuanTag(tag.title) ? 'text-neutral-400' : '')}`}
// With:
className={`relative z-10 ${iconColorClass || (isReservedTag(tag.title) ? 'text-neutral-400' : '')}`}

// Replace:
// {isSiYuanTag(tag.title) ? <SiYuanIcon size={iconSize} /> : <Tag size={iconSize} />}
// With:
{isReservedTag(tag.title) ? <ReservedTagIcon tagTitle={tag.title} size={iconSize} /> : <Tag size={iconSize} />}
```

- [ ] **Step 3: Update tag list DnD wrapping**

In the tag list rendering (~line 913 and 934):
```tsx
// Replace:
// const isSiyuan = isSiYuanTag(tag.title)
// With:
const isReserved = isReservedTag(tag.title)

// And ~line 926:
// {isSiyuan ? (
// With:
{isReserved ? (

// Same for children (~line 934):
// const isChildSiyuan = isSiYuanTag(child.title)
// With:
const isChildReserved = isReservedTag(child.title)
// And the conditional wrapping that follows
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: show obsidian icon in sidebar, same protection as siyuan"
```

---

### Task 8: Verify and clean up

- [ ] **Step 1: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: PASS — no unused imports, no references to old `../lib/siyuan` path

- [ ] **Step 2: Run frontend tests**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 3: Run backend tests**

Run: `go test ./...`
Expected: PASS

- [ ] **Step 4: Manual smoke test**

Run: `make dev`

Verify:
1. Creating a tag named "obsidian" is blocked (backend returns 403)
2. Renaming a tag to "obsidian" is blocked
3. Typing `#obsidian` in task title edit shows reserved tag error
4. If an "obsidian" tag exists in DB, it shows the Obsidian icon (not a pill) in task rows
5. Sidebar shows Obsidian icon for the tag (not generic Tag icon)
6. Tag autocomplete and multiselect don't show "obsidian" as an option
7. All existing "siyuan" behavior still works identically

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: clean up reserved tag migration"
```
