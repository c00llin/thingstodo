import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { ShortcutsHelp } from './ShortcutsHelp'
import { AppDndContext } from './AppDndContext'
import { useGlobalShortcuts, useTaskShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTheme } from '../hooks/useTheme'
import { useSSE } from '../hooks/useSSE'

const QuickEntry = lazy(() => import('./QuickEntry').then(m => ({ default: m.QuickEntry })))

export function AppLayout() {
  useGlobalShortcuts()
  useTaskShortcuts()
  useTheme()
  useSSE()

  return (
    <AppDndContext>
      <div className="flex h-screen bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
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
