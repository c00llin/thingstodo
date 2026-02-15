import { useEffect } from 'react'
import { useAppStore } from '../stores/app'

export function useTheme() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement

    function apply(isDark: boolean) {
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    apply(theme === 'dark')
  }, [theme])
}
