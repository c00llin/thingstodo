# Offline-First Denormalized Data Bugs Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two related regressions from the offline-first migration where denormalized data in IndexedDB is not updated locally after mutations — sidebar counters (#48) and tag colors in views (#49).

**Architecture:** Both bugs share the same root cause: local mutations update a primary entity but don't cascade changes to denormalized copies elsewhere. The fix has two parts: (1) make sidebar list hooks compute counts live from the tasks table instead of reading stale denormalized fields, and (2) cascade tag metadata changes to all tasks embedding that tag.

**Tech Stack:** React, Dexie (IndexedDB), TanStack Query, TypeScript

---

## Root Cause

**Issue #48 — Sidebar counters:** `useLocalProjects()`, `useLocalAreas()`, and `useLocalTags()` in `localQueries.ts` read denormalized `task_count`, `completed_task_count`, and `standalone_task_count` fields directly from IndexedDB. These fields are only updated when the server pushes new values via sync pull. Local task mutations (create, complete, delete, move) don't update these counts.

**Issue #49 — Tag colors:** Tasks store denormalized `TagRef[]` (with `id`, `title`, `color`) embedded in each task record. When `updateTag()` in `mutations.ts` changes a tag's color, it updates the tag record but does NOT update the embedded `TagRef` on tasks that reference that tag.

## File Structure

- **Modify:** `frontend/src/hooks/localQueries.ts` — Rewrite `useLocalProjects`, `useLocalAreas`, `useLocalTags` to compute counts from tasks table
- **Modify:** `frontend/src/db/mutations.ts` — Add tag cascade in `updateTag` for color/title changes

---

### Task 1: Compute project counts live in useLocalProjects

**Files:**
- Modify: `frontend/src/hooks/localQueries.ts:866-874`

- [ ] **Step 1: Rewrite useLocalProjects to compute task counts from tasks table**

Replace the current `useLocalProjects` implementation:

```typescript
export function useLocalProjects(): Project[] | undefined {
  return useLiveQuery(async () => {
    const projects = await localDb.projects
      .where('status')
      .equals('open')
      .sortBy('sort_order')

    // Compute task counts live from tasks table
    const result: Project[] = []
    for (const p of projects) {
      const tasks = await localDb.tasks
        .where('project_id')
        .equals(p.id)
        .filter((t: LocalTask) => !t.deleted_at)
        .toArray()
      const taskCount = tasks.length
      const completedCount = tasks.filter(
        (t: LocalTask) => t.status === 'completed' || t.status === 'canceled' || t.status === 'wont_do',
      ).length
      result.push({
        ...projectToPlain(p),
        task_count: taskCount,
        completed_task_count: completedCount,
      })
    }
    return result
  })
}
```

This mirrors the pattern already used in `useLocalAreaDetail` (line 1172-1186) which computes counts per project correctly.

- [ ] **Step 2: Verify the build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual test**

Run: `cd frontend && npm run dev`
Test: Create a task in a project → sidebar counter should increment immediately. Complete a task → counter should decrement. Move a task to a different project → both counters update.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/localQueries.ts
git commit -m "fix(#48): compute project task counts live in sidebar"
```

---

### Task 2: Compute area counts live in useLocalAreas

**Files:**
- Modify: `frontend/src/hooks/localQueries.ts:880-885`

- [ ] **Step 1: Rewrite useLocalAreas to compute standalone_task_count from tasks table**

Replace the current `useLocalAreas` implementation:

```typescript
export function useLocalAreas(): Area[] | undefined {
  return useLiveQuery(async () => {
    const areas = await localDb.areas.orderBy('sort_order').toArray()

    const result: Area[] = []
    for (const a of areas) {
      // standalone_task_count: open tasks in this area with no project
      const count = await localDb.tasks
        .where('area_id')
        .equals(a.id)
        .filter((t: LocalTask) => t.status === 'open' && !t.deleted_at && !t.project_id)
        .count()
      result.push({
        ...areaToPlain(a),
        standalone_task_count: count,
      })
    }
    return result
  })
}
```

The sidebar only uses `standalone_task_count` for area badges, so that's the only count we need to compute live.

- [ ] **Step 2: Verify the build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/localQueries.ts
git commit -m "fix(#48): compute area standalone task counts live in sidebar"
```

---

### Task 3: Compute tag counts live in useLocalTags

**Files:**
- Modify: `frontend/src/hooks/localQueries.ts:890-895`

- [ ] **Step 1: Rewrite useLocalTags to compute task_count from tasks table**

Replace the current `useLocalTags` implementation:

```typescript
export function useLocalTags(): Tag[] | undefined {
  return useLiveQuery(async () => {
    const tags = await localDb.tags.orderBy('sort_order').toArray()

    const result: Tag[] = []
    for (const tag of tags) {
      // Count open, non-deleted tasks that reference this tag
      const count = await localDb.tasks
        .where('status')
        .equals('open')
        .filter((t: LocalTask) => !t.deleted_at && t.tags?.some((tr) => tr.id === tag.id))
        .count()
      result.push({
        ...tagToPlain(tag),
        task_count: count,
      })
    }
    return result
  })
}
```

Note: Tag task counting requires scanning tasks since tags are stored as an embedded array on tasks, not in a join table. For typical task counts (< few thousand) this is fast enough. If performance becomes an issue, a Dexie multi-entry index on tag IDs could be added later.

- [ ] **Step 2: Verify the build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/localQueries.ts
git commit -m "fix(#48): compute tag task counts live in sidebar"
```

---

### Task 4: Cascade tag color/title changes to embedded TaskRefs

**Files:**
- Modify: `frontend/src/db/mutations.ts:416-437`

- [ ] **Step 1: Add cascadeTagToTasks helper in mutations.ts**

Add this helper function before the `updateTag` function (around line 415):

```typescript
/**
 * When a tag's color or title changes, update the denormalized TagRef
 * embedded in every task that references this tag.
 */
async function cascadeTagToTasks(tagId: string, updates: { title?: string; color?: string | null }): Promise<void> {
  // Find all tasks that embed this tag
  const tasks = await localDb.tasks
    .filter((t) => t.tags?.some((tr) => tr.id === tagId))
    .toArray()

  for (const task of tasks) {
    const updatedTags = task.tags.map((tr) =>
      tr.id === tagId ? { ...tr, ...updates } : tr,
    )
    // Direct DB update — no sync queue entry needed since the server
    // will cascade on its own when it processes the tag update
    await localDb.tasks.update(task.id, { tags: updatedTags })
  }
}
```

- [ ] **Step 2: Call cascadeTagToTasks from updateTag when color or title changes**

Replace the `updateTag` function:

```typescript
export async function updateTag(
  id: string,
  fields: Partial<Omit<LocalTag, 'id' | '_syncStatus' | '_localUpdatedAt'>>,
): Promise<void> {
  const existing = await localDb.tags.get(id)
  if (!existing) return
  const timestamp = now()
  const updated: LocalTag = {
    ...existing,
    ...fields,
    _syncStatus: 'pending',
    _localUpdatedAt: timestamp,
  }
  await localDb.tags.put(updated)
  await queueChange(
    'tag',
    id,
    'update',
    fields as unknown as Record<string, unknown>,
    Object.keys(fields),
  )

  // Cascade color/title changes to denormalized TagRefs on tasks
  const cascadeFields: { title?: string; color?: string | null } = {}
  if ('color' in fields) cascadeFields.color = fields.color ?? null
  if ('title' in fields) cascadeFields.title = fields.title
  if (Object.keys(cascadeFields).length > 0) {
    await cascadeTagToTasks(id, cascadeFields)
  }
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Manual test**

Run: `cd frontend && npm run dev`
Test: Change a tag's color in sidebar → task pills in all views should immediately reflect the new color. Change a tag's title → task pills update immediately.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/db/mutations.ts
git commit -m "fix(#49): cascade tag color/title changes to embedded task refs"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run linter**

Run: `cd frontend && npm run lint`
Expected: No errors

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test`
Expected: All pass

- [ ] **Step 4: Final manual test of both issues**

Test #48: Create task in project → sidebar project counter increments. Complete it → decrements. Move task between projects → both update. Same for areas and tags.

Test #49: Change tag color → pills update everywhere immediately. Change tag name → pills update everywhere.
