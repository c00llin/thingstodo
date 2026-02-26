import { useSyncExternalStore } from 'react'

const query = '(min-width: 768px)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return !window.matchMedia(query).matches
}

function getServerSnapshot() {
  return false
}

/** Returns true when the viewport is below Tailwind's `md` breakpoint (768px). */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
