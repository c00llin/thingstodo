import { Sun, Moon, Monitor } from 'lucide-react'
import { useAppStore, type Theme } from '../stores/app'

const options: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  // Cycle through themes on click
  function handleClick() {
    const idx = options.findIndex((o) => o.value === theme)
    const next = options[(idx + 1) % options.length]
    setTheme(next.value)
  }

  const current = options.find((o) => o.value === theme) ?? options[2]
  const Icon = current.icon

  return (
    <button
      onClick={handleClick}
      className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
      aria-label={`Theme: ${current.label}`}
      title={`Theme: ${current.label}`}
    >
      <Icon size={16} />
    </button>
  )
}
