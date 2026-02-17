# Plan: Assign Projects to Areas (Simplified)

## Approach
Two ways to assign a project to an area:
1. **New Project auto-inherits area**: When creating a new project via the plus menu, if the sidebar currently shows an area page (`/area/:id`), auto-assign the project to that area.
2. **Drag-and-drop**: Drag a project onto an area in the sidebar to move it there.

No dropdowns anywhere. No changes to ProjectView.

## Changes

### 1. `frontend/src/components/Sidebar.tsx`
- Import `useLocation` from `react-router` and `useDraggable` from `@dnd-kit/core`
- In `PlusMenu`, call `useLocation()` and extract area ID if path matches `/area/:id`
- Pass `area_id` to `createProject.mutate({ title: name, area_id })` when creating a project
- Add a `DraggableProject` wrapper component using `useDraggable` with ID `drag-project-{id}`
- Wrap each project `NavLink` (both area-nested and standalone) with `DraggableProject`

### 2. `frontend/src/components/AppDndContext.tsx`
- Import `updateProject` from `../api/projects`
- In `handleDragStart`, skip setting `activeTask` when active ID starts with `drag-project-`
- In `handleDragEnd`, detect `drag-project-*` active IDs:
  - Dropped on `sidebar-area-{areaId}` → call `updateProject(projectId, { area_id: areaId })` + invalidate queries
  - Any other drop target → ignore (no unassign on random drops)

### Files
- `frontend/src/components/Sidebar.tsx` — auto-area on create + draggable projects
- `frontend/src/components/AppDndContext.tsx` — project drop handling

### Verification
- `cd frontend && npx tsc -b --noEmit` compiles
- Create project while viewing an area → project appears under that area
- Create project while viewing Inbox → project has no area
- Drag project onto area → project moves under that area
