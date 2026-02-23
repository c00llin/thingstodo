import { lazy, Suspense, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { ShortcutsHelp } from './ShortcutsHelp'
import { AppDndContext } from './AppDndContext'
import { useGlobalShortcuts, useTaskShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTheme } from '../hooks/useTheme'
import { useSSE } from '../hooks/useSSE'
import { useMe, useFlushPendingInvalidation } from '../hooks/queries'
import { useAppStore } from '../stores/app'

const QuickEntry = lazy(() => import('./QuickEntry').then(m => ({ default: m.QuickEntry })))
const CommandPalette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })))
const SearchOverlay = lazy(() => import('./SearchOverlay').then(m => ({ default: m.SearchOverlay })))

export function AppLayout() {
  const { isLoading, error } = useMe()
  const location = useLocation()
  const expandTask = useAppStore((s) => s.expandTask)
  const openMobileSidebar = useAppStore((s) => s.openMobileSidebar)
  const closeMobileSidebar = useAppStore((s) => s.closeMobileSidebar)
  useGlobalShortcuts()
  useTaskShortcuts()
  useTheme()
  useSSE()
  useFlushPendingInvalidation()

  // Close task detail panel when navigating to a different page
  useEffect(() => {
    expandTask(null)
  }, [location.pathname, expandTask])

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
        <main className="relative flex-1 overflow-y-auto">
          <button
            onClick={openMobileSidebar}
            className="fixed left-4 z-30 rounded-lg bg-white/80 p-2 shadow-md backdrop-blur-sm md:hidden dark:bg-neutral-800/80"
            style={{ top: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
            aria-label="Open sidebar"
          >
            <Menu size={20} />
          </button>
          <Outlet />
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
      </div>
    </AppDndContext>
  )
}
