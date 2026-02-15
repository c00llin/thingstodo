import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import { ThemeToggle } from '../ThemeToggle'
import { useAppStore } from '../../stores/app'

describe('ThemeToggle', () => {
  it('renders with current theme label', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    // Default theme is "system"
    expect(button.getAttribute('aria-label')).toMatch(/Theme:/)
  })

  it('cycles through themes on click', async () => {
    const { user } = render(<ThemeToggle />)
    const button = screen.getByRole('button')

    // Get initial theme from store
    const initial = useAppStore.getState().theme

    // Click to cycle
    await user.click(button)
    const after1 = useAppStore.getState().theme
    expect(after1).not.toBe(initial)

    await user.click(button)
    const after2 = useAppStore.getState().theme
    expect(after2).not.toBe(after1)

    await user.click(button)
    const after3 = useAppStore.getState().theme
    // After 3 clicks, should be back to initial
    expect(after3).toBe(initial)
  })
})
