# Changelog

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
