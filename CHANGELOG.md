# Changelog

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
