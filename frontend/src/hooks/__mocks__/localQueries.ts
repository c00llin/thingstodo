/**
 * Auto-mock for localQueries — returns empty/default data for all hooks.
 * Individual tests can override specific hooks via vi.fn().mockReturnValue().
 */
import { vi } from 'vitest'

export const useLocalInbox = vi.fn().mockReturnValue(undefined)
export const useLocalToday = vi.fn().mockReturnValue(undefined)
export const useLocalUpcoming = vi.fn().mockReturnValue(undefined)
export const useLocalAnytime = vi.fn().mockReturnValue(undefined)
export const useLocalSomeday = vi.fn().mockReturnValue(undefined)
export const useLocalLogbook = vi.fn().mockReturnValue(undefined)
export const useLocalTrash = vi.fn().mockReturnValue(undefined)
export const useLocalTask = vi.fn().mockReturnValue(undefined)
export const useLocalProjects = vi.fn().mockReturnValue([])
export const useLocalAreas = vi.fn().mockReturnValue([])
export const useLocalTags = vi.fn().mockReturnValue([])
export const useLocalViewCounts = vi.fn().mockReturnValue(undefined)
export const useLocalProjectTasks = vi.fn().mockReturnValue([])
export const useLocalAreaTasks = vi.fn().mockReturnValue([])
export const useLocalTagTasks = vi.fn().mockReturnValue([])
export const useLocalProjectDetail = vi.fn().mockReturnValue(undefined)
export const useLocalAreaDetail = vi.fn().mockReturnValue(undefined)
