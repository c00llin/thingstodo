# Changelog

## [0.13.0] - 2026-03-23

### Added
- **MCP Server** — a Model Context Protocol server that exposes the ThingsToDo API as 40+ tools for use in Claude Code and other MCP-compatible clients
  - **View tools** — read-only access to Today, Upcoming, Inbox, Anytime, Someday, and Logbook views
  - **Task tools** — full CRUD: create, update, complete, cancel, won't-do, reopen, delete, purge, restore, and search tasks
  - **Bulk actions** — apply actions (complete, set priority, move project, add/remove tags, etc.) to multiple tasks at once
  - **Project tools** — list, create, update, and delete projects
  - **Area tools** — list, create, update, and delete areas
  - **Tag tools** — list, create, update, and delete tags
  - **Heading tools** — manage project sub-sections
  - **Checklist tools** — add, update, and delete checklist items within tasks
  - **Attachment tools** — add links and delete attachments
  - **Schedule tools** — add, update, and delete multi-date schedule entries
- MCP server is a standalone TypeScript package in `mcp/` using `@modelcontextprotocol/sdk` and Zod schema validation

## [0.12.3] - 2026-03-22

### Fixed
- **Critical: tasks with when_date missing from Upcoming** — reverted SkipScheduleSync approach that prevented the backend from creating schedule entries during sync, causing tasks to be invisible in date-based views
- Sync pull now deduplicates local-only schedules when the server's canonical schedule arrives, preventing duplicate schedule entries

## [0.12.2] - 2026-03-22

### Added
- **Inline detail shortcuts** — Alt+key shortcuts (Alt+A, Alt+W, Alt+D, Alt+N, etc.) now work when a task is selected without the detail panel open; opens the modal and activates the relevant field (#47)
- **Inline priority toggle** — Alt+H toggles high priority directly from the task list without opening the detail modal

### Fixed
- Bulk priority toggle now correctly reads task state from IndexedDB instead of stale view cache
- Bulk priority toggle param mismatch (`priority` vs `high_priority`) that silently prevented changes
- Duplicate schedule creation when setting when_date — frontend and backend both independently created schedule entries; now frontend manages schedules via sync queue and backend skips schedule creation during sync
- Bulk toolbar Escape no longer clears multi-selection when closing a dropdown (tags, project picker, etc.)
- Tag picker in bulk toolbar now auto-focuses the search input on open
- Detail panel Alt+H shortcut disabled during multi-select to avoid conflict with bulk toolbar
- Keyboard shortcuts help: Enter correctly labeled "Open task detail"; "Enter / Alt+E" for edit title in detail section
- `detailFocusField` ownership: TaskDetail no longer clears signals meant for ModalContent (tags, area, title)

## [0.12.1] - 2026-03-20

### Fixed
- Sidebar overdue badge now uses deadline (not when_date), matching the server and Today/Upcoming views
- Review task tick mark now persists — server was silently skipping the updated_at bump, causing sync to revert it
- Completing a timeblock (schedule entry) now removes the task from Today view — local query was missing the completed-schedule check
- SiYuan system tag hidden from tag selection dropdowns (QuickEntry, TaskDetail, BulkAction)
- Change_log entries added for all 17 missing mutation paths
- Change_log entries logged for schedule mutations in syncFirstScheduleDate
- Theme/logout buttons always visible on mobile, hover-only on desktop

## [0.12.0] - 2026-03-19

### Added
- **Local-First / Offline Support** — all data is stored in IndexedDB (Dexie.js) and available offline. Changes sync to the server automatically when online.
- **Sync Engine** — push/pull sync with 30-second polling, SSE-triggered immediate sync, and last-write-wins conflict resolution per field
- **Full Sync Fallback** — if the change log cursor expires (after 90 days), the client falls back to a full entity sync
- **Offline Task Management** — create, edit, complete, cancel, delete, and restore tasks while offline; changes queue and sync when connection returns
- **Offline Sub-Entity Support** — schedules, checklist items, attachments (links), reminders, and headings all sync bidirectionally via the push endpoint
- **Sync Status Indicator** — centered in the sidebar bottom bar, shows synced/syncing/offline/error/pending status with click-to-retry
- **"Include recurring tasks in Review" setting** — new checkbox in Settings to exclude recurring tasks from the Inbox review section
- **Recurring offline indicator** — repeat rule buttons are greyed out with tooltip guidance when offline (recurrence requires server connection)
- **Catch-up reminders** — missed reminders while offline are delivered when the app reconnects
- **Attachment file caching** — lazy LRU cache (100 MB budget) for offline file access

### Changed
- **Task sorting** — all views now sort by: high priority first, start time ascending (timeless last), title alphabetically
- **Today view** — includes deadline-only tasks and tasks with schedule entries matching today; split into Today / This Evening sections based on evening_starts_at setting
- **Upcoming view** — uses schedule entries as data source (tasks appear once per schedule date); includes overdue and earlier sections
- **Anytime view** — includes deadline-only tasks with no project/area; areas and projects sorted by sort_order
- **Earlier section** — requires uncompleted past schedule entries (matching server behavior)
- **Task context enrichment** — all views show project/area names, schedule times, reminder info, and all denormalized flags derived from actual local data
- **Sidebar bottom bar** — redesigned with centered sync status; theme toggle and logout revealed on settings icon hover
- **Review section** — now computed locally from IndexedDB with correct review_after_days and review_include_recurring filtering; review badge in sidebar

### Fixed
- Server sync push now handles all sub-entity types (schedule, checklistItem, attachment, reminder, heading) — previously only task/project/area/tag were supported
- Sub-entity creates use client-provided IDs to prevent client/server ID mismatch
- All ListAll and Create/Update queries include parent IDs (task_id, project_id) in change_log snapshots
- Full sync field name mapping corrected (checklist, repeat_rules)
- Soft-delete change_log now includes full task snapshot so sync pull preserves deleted_at
- All DnD sidebar drops, bulk actions, and reorder operations update IndexedDB immediately
- Trash emptying deletes from IndexedDB and cleans up orphaned sync queue entries
- Schedule date changes no longer cascade-overwrite other entries on multi-schedule tasks
- Synthesized schedule entries (for tasks without local schedule data) handled correctly in create/update/delete

## [0.11.1] - 2026-03-12

### Fixed
- Restore Alt+key shortcuts in task detail modal
- Fix nested button DOM warning in sidebar sort buttons

## [0.11.0] - 2026-03-11

### Added
- Multi-task selection: Cmd+Click, Shift+Click, Cmd+A to select tasks with visual indicators
- Bulk action toolbar: floating toolbar appears when multiple tasks are selected
- Bulk actions: complete, cancel, won't do, delete, set when/deadline, move to project, assign tags, toggle priority
- Bulk drag & drop: drag multiple selected tasks with stacked overlay, drop onto sidebar targets
- Section-scoped multi-select with contextual review toolbar for Inbox review tasks
- Alt+key shortcuts for bulk toolbar: Alt+W (when), Alt+D (deadline), Alt+A (project), Alt+T (tags), Alt+H (priority)
- Calendar date picker component (DateCalendar) for single-date selection
- Calendar toggle button in DateInput component
- Departing animations for bulk destructive actions
- SSE `bulk_change` event for cross-tab sync of bulk operations
- Keyboard shortcuts: Escape clears multi-select, Delete/Backspace bulk-deletes selected tasks

### Fixed
- Date dropdowns in bulk toolbar now open upward to avoid clipping
- Use formatRelativeDate in TaskItem tests to avoid date-dependent failures

## [0.10.1] - 2026-03-08

### Added
- Privacy mode setting: blur task titles, notes, checklist items, area/project/tag names, and task context to prevent over-the-shoulder reading
- Push notification support via ntfy (configurable server, topic, and access token in Settings)

### Fixed
- Remove verbose VAPID public key OK log message

## [0.10.0] - 2026-03-05

### Added
- Mobile swipe gestures: swipe left for task details, swipe right for action tray
- Swipe direction indicator icons (Info/CheckCheck) shown during swipe
- Cancel task action in swipe action tray
- All-schedules-completed dot indicator in task checkbox
- Complete checkbox in task detail modal
- Mobile keyboard shortcuts for time gap, keybindings, and swipe actions

### Fixed
- Fix today's completed time block end-time not showing green in detail panel
- Fix today's uncompleted time block end-time not showing red when past
- Fix tasks with all-completed today schedules still showing in Today view
- Fix mobile swipe with pointer capture and bottom padding
- Fix wont_do task status using correct hook

### Changed
- Include completed schedules in Today view for time display with green styling
- Bottom padding increased on all pages for mobile usability

## [0.9.4] - 2026-03-04

### Added
- Task detail modal with keyboard shortcuts (Alt+key) and searchable area/project picker
- Reminders and web push notifications with VAPID key auto-generation
- Floating action button for mobile task creation
- Base font size setting with slider (14–18px)
- Reschedule button for single-entry non-recurring past schedule entries

### Fixed
- Fix today timeless time blocks being treated as past/blocked — entries without a time frame are now fully editable
- Fix completed time blocks still showing as task instances in Today/Evening/Upcoming views
- Fix completing today's time blocks when start time has passed
- Fix reminder timezone: use TZ env var instead of time.Local
- Fix exact reminder parsing: support HH:MM without seconds
- Fix push subscription: normalize VAPID key to base64url
- Fix push notification toggle: use serviceWorker.ready and show errors

### Changed
- Reminder toasts are now persistent until dismissed (no auto-timeout)
- Remove debug logging from reminder scheduler
- Rename 'multiple time frames' to 'multiple time blocks'

## [0.9.3] - 2026-03-01

### Fixed
- Fix review tasks showing empty data in Inbox (missing schedule columns in review query)
- Fix `make dev` not loading .env file (backend failed with missing JWT_SECRET)

## [0.9.2] - 2026-02-28

### Security
- Sanitize FTS5 search snippets to prevent XSS via dangerouslySetInnerHTML
- Reject empty JWT_SECRET at startup when AUTH_MODE is builtin/oidc
- Move SSE /api/events endpoint inside auth middleware group
- Add SQL column/table name whitelists to prevent injection in dynamic queries
- Run Docker container as non-root user

### Fixed
- Remove duplicate schedule entry creation in scheduler
- Add safe type assertions in saved_filters and user_settings handlers
- Fix schedule handler SSE events to include full task payload
- Remove unused `days` parameter from Upcoming view
- setTaskTags/setProjectTags now use transactions and return errors
- Schedule/heading/tag/attachment repo Update methods check all DB errors
- Add .catch() to async DnD operations to roll back stale optimistic updates
- Move isSequencePending from module-level to useRef (prevents HMR/strict mode issues)
- Split SortableTaskList registry effect to avoid unregister/register race during drag

### Changed
- Makefile build target depends on build-frontend, adds CGO_ENABLED=0
- Add TypeScript type-check step to CI lint-frontend job
- Pin golangci-lint to v1.64 for reproducible CI

## [0.9.1] - 2026-02-28

### Added
- Reschedule button for past schedule entries on recurring tasks — moves the date to today while keeping the time frame

### Fixed
- Schedule entries now cleaned up when completing, canceling, or marking a task as won't do (past entries marked completed, future entries removed)
- Unused test helper causing CI lint failure

## [0.9.0] - 2026-02-28

### Added
- Multi-date scheduling: tasks can now have up to 12 scheduled when-date/time entries
- Start and end times on each scheduled date with free-text time input (e.g. "9am", "14:30")
- Schedule editor in task detail panel with inline date, time, and reorder controls
- Time badge on task list items showing the first scheduled time range
- Past schedule entries shown with red styling; mark as completed (green) or delete
- Completed past entries persist across sessions (database-backed)
- Tasks with all past entries completed automatically hide from the Earlier section
- Earlier section shows the first uncompleted past entry's time (not just the first by sort order)
- Time format setting (12h / 24h) in Settings
- Evening threshold setting (configurable start time) in Settings
- Default time duration setting (used when adding end time) in Settings
- Show time badge toggle in Settings
- Upcoming view shows the same task on multiple dates when it has multiple schedule entries
- Instance-level selection: clicking a task in one section only expands that instance

### Changed
- Task detail "When" section replaced with full schedule editor
- Upcoming view uses JOIN on task_schedules for per-date display
- Evening detection considers first schedule entry's start time vs evening threshold

### Fixed
- Earlier section tasks expanding the wrong instance when the same task appears in multiple sections
- Schedule deletions now defer view invalidation until task detail panel is closed (consistent with other edits)

## [0.8.1] - 2026-02-26

### Added
- Saved filters: save and recall filter presets per view (up to 10 per view)
- Tag filter: multi-select dropdown as a primary filter field
- Saved filter pills always visible below page headers with toggle-on/off behavior
- Stale reference warnings on saved filters when areas, projects, or tags are deleted
- Save button (bookmark icon) in filter bar to save current filter configuration
- SSE sync for saved filter changes across devices

### Changed
- Priority filter promoted to primary field on views without date filters (Today)
- Saved filter pills dynamically resize: delete button appears on hover with smooth animation
- Saved filter pill hover colors changed to red accent for readability

### Fixed
- Saved filter pill text centering (no extra space when delete button is hidden)

## [0.8.0] - 2026-02-26

### Added
- Client-side filter bar for all task views (Today, Upcoming, Anytime, Someday, Logbook)
- Filter by area, project, priority, planned date, and deadline
- Text search filter across task titles and notes
- Progressive disclosure (More/Less) for date filters
- CalendarPicker component with single date, date range, and preset selection
- Active filter chips with individual removal
- Filter empty state with "No tasks match" message and clear button
- Filter bar toggle button (funnel icon) in page headers
- G X shortcut to toggle filter bar visibility
- Alt+X shortcut to clear all filters (double-press closes filter bar)
- Keyboard navigation in multi-select dropdowns (Arrow keys, Enter, Space)
- Auto-focus search input when filter bar opens
- Cascading area→project filter (selecting areas scopes project options)
- Filter bar state preserved within session, cleared on route change

### Fixed
- Task keyboard shortcuts (arrows, space, enter, escape, delete) no longer conflict with filter bar interaction

## [0.7.2] - 2026-02-26

### Fixed
- Sidebar DnD sorting blocking normal scroll on iOS
- 25 failing frontend tests (missing providers, stale mock data, outdated assertions)

### Changed
- Sidebar drag-and-drop sorting disabled on mobile (below 768px); sort buttons and task-to-sidebar drops still work

## [0.7.1] - 2026-02-25

### Fixed
- Project reverting to old area after sort button click
- Cross-area project drag-and-drop not updating area_id
- Intermittent DnD failures caused by race condition between optimistic updates and stale invalidations
- Pull-to-refresh on iOS Safari
- PWA not auto-updating when new service worker version is deployed

### Changed
- Projects now always require an area (database NOT NULL constraint, migration 017)
- "New Project" option only appears when on an area page
- Area deletion blocked when area still has projects (ON DELETE RESTRICT)

### Added
- Build version and commit SHA displayed in settings page
- Version and commit SHA logged on container startup
- PWA auto-reloads when a new version is available

## [0.7.0] - 2026-02-23

### Added
- Mobile responsive UI: sidebar drawer, responsive padding, safe area insets, touch-friendly task rows, mobile-friendly modals
- Pull-to-refresh on mobile
- PWA service worker auto-update with periodic polling (every 15 min)
- Version number displayed on settings page
- OIDC authentication support (`AUTH_MODE=oidc`)

### Fixed
- PWA not refreshing after deploy (added Cache-Control headers for static assets)
- Search navigating to wrong view and not scrolling to task

### Changed
- Improved safe area inset handling for notched devices (viewport-fit=cover)

## [0.6.0] - 2026-02-09

### Added
- Extended recurring tasks with rich recurrence patterns (daily, weekly, monthly, yearly variants)
- Sidebar drag-and-drop sorting for areas, projects, and tags
- Spacebar toggle for task detail panel
- Arrow key navigation across all task sections
- SiYuan link protection and reserved tag support
- API key authentication for programmatic access

### Fixed
- Task exit animations via shared deferral pattern
- SSE invalidation during departing animations
- Drag-and-drop reordering on Area and Project pages
- Scrollbar color in dark mode

## [0.5.0] - 2026-01-26

### Added
- Review tasks feature (stale task surfacing in Inbox)
- Tag color support with color picker in sidebar
- Collapsible project lists under areas in sidebar
- Collapsible Overdue and Earlier sections
- Completed tasks sections in Today, Area, and Project views
- Earlier and Overdue sections in Today/Upcoming views

### Fixed
- Dark mode colors on area page project list
- Sidebar drop target ring clipping

## [0.4.0] - 2026-01-12

### Added
- High priority task feature with red circle indicator
- Settings page with sound and task count toggles
- Completion sound effect
- Delete buttons for project, area, and tag pages
- Sidebar task count badges for all smart lists
- Unique name enforcement for projects, areas, and tags

### Fixed
- Proxy auth mode returning wrong identity
- Tasks appearing in both overdue and today sections

## [0.3.0] - 2025-12-29

### Added
- Repeating tasks with scheduler support
- PWA support with installability and offline caching
- Command palette with G N shortcut
- Search overlay with G F shortcut and prefix matching
- Sliding active indicator for sidebar navigation
- Trash view with soft delete and empty trash

### Fixed
- Task reappearing after completion or detail panel close

## [0.2.0] - 2025-12-15

### Added
- Natural language date input
- Inline trigger characters (@when, ^deadline, *notes)
- Drag-and-drop: tasks to sidebar targets, tag assignment
- Overdue task count badge in sidebar
- Canceled/wont_do task status support
- Project-area assignment and breadcrumbs

### Fixed
- Deferred view invalidation and departing task animation

## [0.1.0] - 2025-12-01

### Added
- Initial release
- Full-stack task manager with Go backend and React frontend
- SQLite database with WAL and FTS5 search
- Smart lists: Inbox, Today, Upcoming, Anytime, Someday, Completed, Trash
- Projects and areas with hierarchical organization
- Tag support with #tag parsing in task titles
- Quick entry with $project autocomplete
- Task detail panel with notes, dates, checklists, attachments, links
- Keyboard shortcuts (Things 3-inspired)
- Dark mode with system preference detection
- JWT authentication with login/logout
- Docker deployment with single container
- SPA embedded in Go binary
