import { lazy, Suspense, useEffect, useRef } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router'
import { Menu, Plus, RefreshCw } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ShortcutsHelp } from './ShortcutsHelp'
import { AppDndContext } from './AppDndContext'
import { useGlobalShortcuts, useTaskShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTheme } from '../hooks/useTheme'
import { useSSE } from '../hooks/useSSE'
import { useMe, useSettings, useFlushPendingInvalidation } from '../hooks/queries'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useAppStore } from '../stores/app'
import { useFilterStore } from '../stores/filters'

const QuickEntry = lazy(() => import('./QuickEntry').then(m => ({ default: m.QuickEntry })))
const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })))
const SearchOverlay = lazy(() => import('./SearchOverlay').then(m => ({ default: m.SearchOverlay })))
const TaskDetailModal = lazy(() => import('./TaskDetailModal').then(m => ({ default: m.TaskDetailModal })))

export function AppLayout() {
  const { isLoading, error } = useMe()
  const location = useLocation()
  const closeModal = useAppStore((s) => s.closeModal)
  const openMobileSidebar = useAppStore((s) => s.openMobileSidebar)
  const openQuickEntry = useAppStore((s) => s.openQuickEntry)
  const closeMobileSidebar = useAppStore((s) => s.closeMobileSidebar)
  const mainRef = useRef<HTMLElement>(null)
  const { pullDistance, isRefreshing } = usePullToRefresh(mainRef)
  const { data: settings } = useSettings()
  useGlobalShortcuts()
  useTaskShortcuts()
  useTheme()
  useSSE()
  useFlushPendingInvalidation()

  // Apply font size setting to document root
  const fontSize = settings?.font_size
  useEffect(() => {
    if (fontSize != null) {
      document.documentElement.style.fontSize = fontSize + 'px'
    }
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [fontSize])

  // Close task detail modal, clear selection, filter bar, and reset filters when navigating to a different page
  useEffect(() => {
    closeModal()
    useAppStore.setState({ selectedTaskId: null, selectedScheduleEntryId: null, filterBarOpen: false })
    useFilterStore.getState().clearAll()
  }, [location.pathname, closeModal])

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    closeMobileSidebar()
  }, [location.pathname, closeMobileSidebar])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-neutral-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
      </div>
    )
  }

  if (error && 'status' in error && (error as { status: number }).status === 401) {
    return <Navigate to="/login" replace />
  }

  return (
    <AppDndContext>
      <div className="flex h-screen bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <Sidebar />
        <main ref={mainRef} className="relative flex-1 overflow-y-auto overscroll-none">
          {/* Pull-to-refresh indicator (mobile only) */}
          {(pullDistance > 0 || isRefreshing) && (
            <div
              className="pointer-events-none flex items-center justify-center md:hidden"
              style={{ height: isRefreshing ? 48 : pullDistance }}
            >
              <RefreshCw
                size={20}
                className={`text-neutral-400 ${isRefreshing ? 'animate-spin' : ''}`}
                style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)`, opacity: Math.min(1, pullDistance / 60) }}
              />
            </div>
          )}
          <button
            onClick={openMobileSidebar}
            className="fixed left-4 z-30 rounded-lg bg-white/80 p-2 shadow-md backdrop-blur-sm md:hidden dark:bg-neutral-800/80"
            style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <Outlet />
          <button
            onClick={() => openQuickEntry()}
            className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg active:bg-red-600 md:hidden"
            style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
            aria-label="New task"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </main>
        <ShortcutsHelp />
        <Suspense>
          <QuickEntry />
        </Suspense>
        <Suspense>
          <CommandPalette />
        </Suspense>
        <Suspense>
          <SearchOverlay />
        </Suspense>
        <Suspense>
          <TaskDetailModal />
        </Suspense>
      </div>
    </AppDndContext>
  )
}
