import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

interface AppStore {
  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  sidebarAreasOpen: boolean
  setSidebarAreasOpen: (open: boolean) => void
  sidebarTagsOpen: boolean
  setSidebarTagsOpen: (open: boolean) => void
  collapsedAreaIds: Set<string>
  toggleAreaCollapsed: (areaId: string) => void

  // Task selection & detail panel
  selectedTaskId: string | null
  selectedScheduleEntryId: string | null
  selectTask: (id: string | null, scheduleEntryId?: string | null) => void
  expandedTaskId: string | null
  expandedScheduleEntryId: string | null
  expandTask: (id: string | null, scheduleEntryId?: string | null) => void
  editingTaskId: string | null
  startEditingTask: (id: string | null) => void

  // Quick entry
  quickEntryOpen: boolean
  quickEntryInitialValue: string
  openQuickEntry: (initialValue?: string) => void
  closeQuickEntry: () => void

  // Command palette
  commandPaletteOpen: boolean
  openCommandPalette: () => void
  closeCommandPalette: () => void

  // Search overlay
  searchOpen: boolean
  openSearch: () => void
  closeSearch: () => void

  // Filter bar
  filterBarOpen: boolean
  toggleFilterBar: () => void

  // Shortcuts help
  shortcutsHelpOpen: boolean
  toggleShortcutsHelp: () => void

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Multi-select for DnD
  selectedTaskIds: Set<string>
  toggleTaskSelection: (id: string, multi: boolean) => void
  clearSelection: () => void

  // Deferred view invalidation while detail panel is open
  hasPendingInvalidation: boolean
  setPendingInvalidation: (v: boolean) => void

  // Task departing animation — task ID fading out before view refresh
  departingTaskId: string | null
  setDepartingTaskId: (id: string | null) => void

  // Signal TaskDetail to auto-focus a specific field after expanding
  detailFocusField: 'notes' | 'when' | 'deadline' | null
  setDetailFocusField: (field: 'notes' | 'when' | 'deadline' | null) => void

  // Signal that a detail field interaction completed — title editing should resume
  detailFieldCompleted: boolean
  setDetailFieldCompleted: (v: boolean) => void

  // Mobile sidebar drawer
  mobileSidebarOpen: boolean
  openMobileSidebar: () => void
  closeMobileSidebar: () => void
}

function getInitialCollapsedAreas(): Set<string> {
  try {
    const stored = localStorage.getItem('collapsedAreaIds')
    if (stored) return new Set(JSON.parse(stored) as string[])
  } catch { /* ignore */ }
  return new Set()
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  sidebarAreasOpen: localStorage.getItem('sidebarAreasOpen') !== 'false',
  setSidebarAreasOpen: (open) => {
    localStorage.setItem('sidebarAreasOpen', String(open))
    set({ sidebarAreasOpen: open })
  },
  sidebarTagsOpen: localStorage.getItem('sidebarTagsOpen') !== 'false',
  setSidebarTagsOpen: (open) => {
    localStorage.setItem('sidebarTagsOpen', String(open))
    set({ sidebarTagsOpen: open })
  },
  collapsedAreaIds: getInitialCollapsedAreas(),
  toggleAreaCollapsed: (areaId) =>
    set((s) => {
      const next = new Set(s.collapsedAreaIds)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      localStorage.setItem('collapsedAreaIds', JSON.stringify([...next]))
      return { collapsedAreaIds: next }
    }),

  selectedTaskId: null,
  selectedScheduleEntryId: null,
  selectTask: (id, scheduleEntryId) => set({ selectedTaskId: id, selectedScheduleEntryId: scheduleEntryId ?? null, expandedTaskId: null, editingTaskId: null }),
  expandedTaskId: null,
  expandedScheduleEntryId: null,
  expandTask: (id, scheduleEntryId) => set({ expandedTaskId: id, expandedScheduleEntryId: scheduleEntryId ?? null, selectedTaskId: id, selectedScheduleEntryId: scheduleEntryId ?? null }),
  editingTaskId: null,
  startEditingTask: (id) => set({ editingTaskId: id }),

  quickEntryOpen: false,
  quickEntryInitialValue: '',
  openQuickEntry: (initialValue?: string) => set({ quickEntryOpen: true, quickEntryInitialValue: initialValue ?? '' }),
  closeQuickEntry: () => set({ quickEntryOpen: false }),

  commandPaletteOpen: false,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),

  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),

  filterBarOpen: false,
  toggleFilterBar: () => set((s) => ({ filterBarOpen: !s.filterBarOpen })),

  shortcutsHelpOpen: false,
  toggleShortcutsHelp: () => set((s) => ({ shortcutsHelpOpen: !s.shortcutsHelpOpen })),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },

  hasPendingInvalidation: false,
  setPendingInvalidation: (v) => set({ hasPendingInvalidation: v }),

  departingTaskId: null,
  setDepartingTaskId: (id) => set({ departingTaskId: id }),

  detailFocusField: null,
  setDetailFocusField: (field) => set({ detailFocusField: field }),

  detailFieldCompleted: false,
  setDetailFieldCompleted: (v) => set({ detailFieldCompleted: v }),

  mobileSidebarOpen: false,
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),

  selectedTaskIds: new Set(),
  toggleTaskSelection: (id, multi) =>
    set((s) => {
      if (multi) {
        const next = new Set(s.selectedTaskIds)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return { selectedTaskIds: next }
      }
      return { selectedTaskIds: new Set([id]) }
    }),
  clearSelection: () => set({ selectedTaskIds: new Set() }),
}))
