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

  // Task selection & detail panel
  selectedTaskId: string | null
  selectTask: (id: string | null) => void
  expandedTaskId: string | null
  expandTask: (id: string | null) => void
  editingTaskId: string | null
  startEditingTask: (id: string | null) => void

  // Quick entry
  quickEntryOpen: boolean
  quickEntryInitialValue: string
  openQuickEntry: (initialValue?: string) => void
  closeQuickEntry: () => void

  // Shortcuts help
  shortcutsHelpOpen: boolean
  toggleShortcutsHelp: () => void

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void

  // Visible task list for keyboard navigation
  visibleTaskIds: string[]
  setVisibleTaskIds: (ids: string[]) => void

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

  selectedTaskId: null,
  selectTask: (id) => set({ selectedTaskId: id, expandedTaskId: null, editingTaskId: null }),
  expandedTaskId: null,
  expandTask: (id) => set({ expandedTaskId: id, selectedTaskId: id }),
  editingTaskId: null,
  startEditingTask: (id) => set({ editingTaskId: id }),

  quickEntryOpen: false,
  quickEntryInitialValue: '',
  openQuickEntry: (initialValue?: string) => set({ quickEntryOpen: true, quickEntryInitialValue: initialValue ?? '' }),
  closeQuickEntry: () => set({ quickEntryOpen: false }),

  shortcutsHelpOpen: false,
  toggleShortcutsHelp: () => set((s) => ({ shortcutsHelpOpen: !s.shortcutsHelpOpen })),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },

  visibleTaskIds: [],
  setVisibleTaskIds: (ids) => set({ visibleTaskIds: ids }),

  hasPendingInvalidation: false,
  setPendingInvalidation: (v) => set({ hasPendingInvalidation: v }),

  departingTaskId: null,
  setDepartingTaskId: (id) => set({ departingTaskId: id }),

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
