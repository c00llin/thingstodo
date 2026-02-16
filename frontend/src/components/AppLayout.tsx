import { lazy, Suspense } from 'react'
import { Outlet, Navigate } from 'react-router'
import { Sidebar } from './Sidebar'
import { ShortcutsHelp } from './ShortcutsHelp'
import { AppDndContext } from './AppDndContext'
import { useGlobalShortcuts, useTaskShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTheme } from '../hooks/useTheme'
import { useSSE } from '../hooks/useSSE'
import { useMe } from '../hooks/queries'

const QuickEntry = lazy(() => import('./QuickEntry').then(m => ({ default: m.QuickEntry })))

export function AppLayout() {
  const { isLoading, error } = useMe()
  useGlobalShortcuts()
  useTaskShortcuts()
  useTheme()
  useSSE()

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
      </div>
    </AppDndContext>
  )
}
