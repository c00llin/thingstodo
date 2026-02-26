import { create } from 'zustand'

export interface DateFilter {
  type: 'specific' | 'range' | 'preset'
  date?: string
  start?: string
  end?: string
  preset?: 'today' | 'thisWeek' | 'thisMonth' | 'next7' | 'next30' | 'overdue' | 'noDate' | 'noDeadline'
}

export interface FilterState {
  areas: string[]
  projects: string[]
  tags: string[]
  highPriority: boolean
  plannedDate: DateFilter | null
  deadline: DateFilter | null
  search: string
}

const defaultFilters: FilterState = {
  areas: [],
  projects: [],
  tags: [],
  highPriority: false,
  plannedDate: null,
  deadline: null,
  search: '',
}

interface FilterStore extends FilterState {
  setAreas: (areas: string[]) => void
  setProjects: (projects: string[]) => void
  setTags: (tags: string[]) => void
  setHighPriority: (on: boolean) => void
  setPlannedDate: (filter: DateFilter | null) => void
  setDeadline: (filter: DateFilter | null) => void
  setSearch: (search: string) => void
  clearAll: () => void
  hasActiveFilters: () => boolean
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...defaultFilters,
  setAreas: (areas) => set({ areas }),
  setProjects: (projects) => set({ projects }),
  setTags: (tags) => set({ tags }),
  setHighPriority: (on) => set({ highPriority: on }),
  setPlannedDate: (filter) => set({ plannedDate: filter }),
  setDeadline: (filter) => set({ deadline: filter }),
  setSearch: (search) => set({ search }),
  clearAll: () => set(defaultFilters),
  hasActiveFilters: () => {
    const s = get()
    return (
      s.areas.length > 0 ||
      s.projects.length > 0 ||
      s.tags.length > 0 ||
      s.highPriority ||
      s.plannedDate !== null ||
      s.deadline !== null ||
      s.search !== ''
    )
  },
}))
