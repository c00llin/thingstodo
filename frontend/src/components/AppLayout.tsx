import { lazy, Suspense, useEffect } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router'
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
  useGlobalShortcuts()
  useTaskShortcuts()
  useTheme()
  useSSE()
  useFlushPendingInvalidation()

  // Close task detail panel when navigating to a different page
  useEffect(() => {
    expandTask(null)
  }, [location.pathname, expandTask])

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
        <main className="flex-1 overflow-y-auto">
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
