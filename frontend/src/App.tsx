import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppLayout } from './components/AppLayout'
import { InboxView } from './pages/InboxView'
import { TodayView } from './pages/TodayView'
import { UpcomingView } from './pages/UpcomingView'
import { AnytimeView } from './pages/AnytimeView'
import { SomedayView } from './pages/SomedayView'
import { LogbookView } from './pages/LogbookView'
import { TrashView } from './pages/TrashView'
import { ProjectView } from './pages/ProjectView'
import { AreaView } from './pages/AreaView'
import { TagView } from './pages/TagView'
import { TaskPermalinkView } from './pages/TaskPermalinkView'
import { SettingsView } from './pages/SettingsView'
import { LoginView } from './pages/LoginView'

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-red-500 border-t-transparent" /></div>}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/inbox" replace />} />
            <Route path="inbox" element={<InboxView />} />
            <Route path="today" element={<TodayView />} />
            <Route path="upcoming" element={<UpcomingView />} />
            <Route path="anytime" element={<AnytimeView />} />
            <Route path="someday" element={<SomedayView />} />
            <Route path="logbook" element={<LogbookView />} />
            <Route path="trash" element={<TrashView />} />
            <Route path="project/:id" element={<ProjectView />} />
            <Route path="area/:id" element={<AreaView />} />
            <Route path="tag/:id" element={<TagView />} />
            <Route path="task/:slug" element={<TaskPermalinkView />} />
            <Route path="settings" element={<SettingsView />} />
          </Route>
          <Route path="login" element={<LoginView />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
