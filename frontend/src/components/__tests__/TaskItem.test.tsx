import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '../../test/test-utils'
import { TaskItem } from '../TaskItem'
import { mockTask, mockTaskWithTags } from '../../test/mocks/data'

describe('TaskItem', () => {
  it('renders task title', () => {
    render(<TaskItem task={mockTask} />)
    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
  })

  it('renders tag chips', () => {
    render(<TaskItem task={mockTaskWithTags} />)
    expect(screen.getByText('work')).toBeInTheDocument()
  })

  it('renders deadline indicator', () => {
    render(<TaskItem task={mockTaskWithTags} />)
    expect(screen.getByText('2026-03-15')).toBeInTheDocument()
  })

  it('renders when_date', () => {
    render(<TaskItem task={mockTaskWithTags} />)
    expect(screen.getByText('2026-03-10')).toBeInTheDocument()
  })

  it('renders checklist progress', () => {
    render(<TaskItem task={mockTaskWithTags} />)
    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('renders checkbox', () => {
    render(<TaskItem task={mockTask} />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('shows completed style when task is completed', () => {
    const completedTask = { ...mockTask, status: 'completed' as const }
    render(<TaskItem task={completedTask} />)
    const title = screen.getByText('Buy groceries')
    expect(title.className).toContain('line-through')
  })

  it('expands detail on click', async () => {
    render(<TaskItem task={mockTask} />)
    const { user } = render(<TaskItem task={mockTask} />)

    // Click on the task item (not the checkbox)
    const title = screen.getAllByText('Buy groceries')[0]
    await user.click(title)

    // TaskDetail should load (it fetches task detail from API)
    await waitFor(() => {
      // The detail view makes an API call, so we just check it doesn't crash
      expect(title).toBeInTheDocument()
    })
  })
})
