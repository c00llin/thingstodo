import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Auto-update service worker: check every 15 minutes, reload when new version is ready
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) {
      setInterval(() => { registration.update() }, 15 * 60 * 1000)
    }
  },
  onNeedRefresh() {
    // New content available — reload to apply the update
    window.location.reload()
  },
})

// Tell TanStack Query we're always "online" — we manage offline behavior ourselves
// via IndexedDB (Dexie) for data and the sync engine for server communication.
// This prevents TQ from pausing queries/mutations or entering retry loops when offline.
onlineManager.setOnline(true)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: (failureCount, error) => {
        // Don't retry network errors at all — our API client returns neverResolve when offline
        if (error instanceof Error && error.message === 'offline') return false
        if (error instanceof TypeError && error.message.includes('fetch')) return false
        return failureCount < 1
      },
    },
    mutations: {
      networkMode: 'always',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
