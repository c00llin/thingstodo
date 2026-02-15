import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'

interface AppStore {
  // Sidebar
  sidebarCollapsed: boolean
  toggleSidebar: () => void

  // Task detail panel
  selectedTaskId: string | null
  selectTask: (id: string | null) => void

  // Quick entry
  quickEntryOpen: boolean
  openQuickEntry: () => void
  closeQuickEntry: () => void

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

  selectedTaskId: null,
  selectTask: (id) => set({ selectedTaskId: id }),

  quickEntryOpen: false,
  openQuickEntry: () => set({ quickEntryOpen: true }),
  closeQuickEntry: () => set({ quickEntryOpen: false }),

  shortcutsHelpOpen: false,
  toggleShortcutsHelp: () => set((s) => ({ shortcutsHelpOpen: !s.shortcutsHelpOpen })),

  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },

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
