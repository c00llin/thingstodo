import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { AppLayout } from './components/AppLayout'

const InboxView = lazy(() => import('./pages/InboxView').then(m => ({ default: m.InboxView })))
const TodayView = lazy(() => import('./pages/TodayView').then(m => ({ default: m.TodayView })))
const UpcomingView = lazy(() => import('./pages/UpcomingView').then(m => ({ default: m.UpcomingView })))
const AnytimeView = lazy(() => import('./pages/AnytimeView').then(m => ({ default: m.AnytimeView })))
const SomedayView = lazy(() => import('./pages/SomedayView').then(m => ({ default: m.SomedayView })))
const LogbookView = lazy(() => import('./pages/LogbookView').then(m => ({ default: m.LogbookView })))
const TrashView = lazy(() => import('./pages/TrashView').then(m => ({ default: m.TrashView })))
const ProjectView = lazy(() => import('./pages/ProjectView').then(m => ({ default: m.ProjectView })))
const AreaView = lazy(() => import('./pages/AreaView').then(m => ({ default: m.AreaView })))
const TagView = lazy(() => import('./pages/TagView').then(m => ({ default: m.TagView })))
const TaskPermalinkView = lazy(() => import('./pages/TaskPermalinkView').then(m => ({ default: m.TaskPermalinkView })))
const SettingsView = lazy(() => import('./pages/SettingsView').then(m => ({ default: m.SettingsView })))
const LoginView = lazy(() => import('./pages/LoginView').then(m => ({ default: m.LoginView })))

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
