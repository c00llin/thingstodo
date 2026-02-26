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
  activeFilterId: string | null
  setAreas: (areas: string[]) => void
  setProjects: (projects: string[]) => void
  setTags: (tags: string[]) => void
  setHighPriority: (on: boolean) => void
  setPlannedDate: (filter: DateFilter | null) => void
  setDeadline: (filter: DateFilter | null) => void
  setSearch: (search: string) => void
  clearAll: () => void
  applyFilterConfig: (config: FilterState, filterId: string) => void
  hasActiveFilters: () => boolean
}

export const useFilterStore = create<FilterStore>((set, get) => ({
  ...defaultFilters,
  activeFilterId: null,
  setAreas: (areas) => set({ areas, activeFilterId: null }),
  setProjects: (projects) => set({ projects, activeFilterId: null }),
  setTags: (tags) => set({ tags, activeFilterId: null }),
  setHighPriority: (on) => set({ highPriority: on, activeFilterId: null }),
  setPlannedDate: (filter) => set({ plannedDate: filter, activeFilterId: null }),
  setDeadline: (filter) => set({ deadline: filter, activeFilterId: null }),
  setSearch: (search) => set({ search, activeFilterId: null }),
  clearAll: () => set({ ...defaultFilters, activeFilterId: null }),
  applyFilterConfig: (config, filterId) =>
    set({
      areas: config.areas ?? [],
      projects: config.projects ?? [],
      tags: config.tags ?? [],
      highPriority: config.highPriority ?? false,
      plannedDate: config.plannedDate ?? null,
      deadline: config.deadline ?? null,
      search: config.search ?? '',
      activeFilterId: filterId,
    }),
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
