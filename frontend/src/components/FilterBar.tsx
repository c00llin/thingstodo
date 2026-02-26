import { useState, useMemo, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  Filter,
  ArrowRightFromLine,
  ArrowLeftFromLine,
  X,
  ChevronDown,
  Search,
  Flag,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { useFilterStore, type DateFilter } from '../stores/filters'
import { useAppStore } from '../stores/app'
import { useAreas, useProjects } from '../hooks/queries'
import { hasFilters } from '../lib/filter-tasks'
import { CalendarPicker } from './CalendarPicker'

export type FilterField = 'area' | 'project' | 'highPriority' | 'plannedDate' | 'deadline'

/** Icon button that toggles the filter bar open/closed. Shows a red dot when filters are active. */
export function FilterToggleButton() {
  const toggleFilterBar = useAppStore((s) => s.toggleFilterBar)
  const filterBarOpen = useAppStore((s) => s.filterBarOpen)
  const filters = useFilterStore()
  const active = hasFilters(filters)

  return (
    <button
      onClick={toggleFilterBar}
      className={`rounded-md p-1.5 transition-colors ${
        filterBarOpen
          ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
          : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-700 dark:hover:text-neutral-300'
      }`}
      aria-label="Toggle filters"
      title="Toggle filters (G X)"
    >
      <span className="relative">
        <Filter size={18} />
        {active && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
        )}
      </span>
    </button>
  )
}

interface FilterBarProps {
  availableFields: FilterField[]
}

const PLANNED_DATE_PRESETS: { label: string; value: DateFilter }[] = [
  { label: 'Today', value: { type: 'preset', preset: 'today' } },
  { label: 'This Week', value: { type: 'preset', preset: 'thisWeek' } },
  { label: 'This Month', value: { type: 'preset', preset: 'thisMonth' } },
  { label: 'Next 7 Days', value: { type: 'preset', preset: 'next7' } },
  { label: 'Next 30 Days', value: { type: 'preset', preset: 'next30' } },
  { label: 'Overdue', value: { type: 'preset', preset: 'overdue' } },
  { label: 'No Date', value: { type: 'preset', preset: 'noDate' } },
]

const DEADLINE_PRESETS: { label: string; value: DateFilter }[] = [
  { label: 'Today', value: { type: 'preset', preset: 'today' } },
  { label: 'This Week', value: { type: 'preset', preset: 'thisWeek' } },
  { label: 'This Month', value: { type: 'preset', preset: 'thisMonth' } },
  { label: 'Overdue', value: { type: 'preset', preset: 'overdue' } },
  { label: 'No Deadline', value: { type: 'preset', preset: 'noDeadline' } },
]

function getDateFilterLabel(f: DateFilter): string {
  if (f.type === 'preset') {
    const labels: Record<string, string> = {
      today: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      next7: 'Next 7 Days',
      next30: 'Next 30 Days',
      overdue: 'Overdue',
      noDate: 'No Date',
      noDeadline: 'No Deadline',
    }
    return labels[f.preset ?? ''] ?? f.preset ?? ''
  }
  if (f.type === 'specific') return f.date ?? ''
  if (f.type === 'range') return `${f.start ?? '?'} – ${f.end ?? '?'}`
  return ''
}

export function FilterBar({ availableFields }: FilterBarProps) {
  const {
    areas: selectedAreas,
    projects: selectedProjects,
    highPriority,
    plannedDate,
    deadline,
    search,
    setAreas,
    setProjects,
    setHighPriority,
    setPlannedDate,
    setDeadline,
    setSearch,
    clearAll,
  } = useFilterStore()

  const [expanded, setExpanded] = useState(false)

  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()

  const allAreas = useMemo(() => areasData?.areas ?? [], [areasData?.areas])
  const allProjects = useMemo(() => {
    const projects = projectsData?.projects ?? []
    // Cascade: when areas are selected, scope projects to those areas
    if (selectedAreas.length > 0) {
      return projects.filter((p) => selectedAreas.includes(p.area_id))
    }
    return projects
  }, [projectsData?.projects, selectedAreas])

  // Auto-remove orphaned project selections when areas change
  useEffect(() => {
    if (selectedAreas.length > 0 && selectedProjects.length > 0) {
      const validProjectIds = new Set(allProjects.map((p) => p.id))
      const filtered = selectedProjects.filter((id) => validProjectIds.has(id))
      if (filtered.length !== selectedProjects.length) {
        setProjects(filtered)
      }
    }
  }, [allProjects, selectedAreas, selectedProjects, setProjects])

  const primaryFields = availableFields.filter((f) =>
    f === 'area' || f === 'project' || f === 'highPriority',
  )
  const secondaryFields = availableFields.filter((f) =>
    f === 'plannedDate' || f === 'deadline',
  )
  const hasSecondary = secondaryFields.length > 0

  const hasActive =
    selectedAreas.length > 0 ||
    selectedProjects.length > 0 ||
    highPriority ||
    plannedDate !== null ||
    deadline !== null ||
    search !== ''

  // Chips for active filters
  const chips: { key: string; label: string; field: string; onRemove: () => void }[] = []
  if (selectedAreas.length > 0) {
    const names = allAreas
      .filter((a) => selectedAreas.includes(a.id))
      .map((a) => a.title)
    chips.push({
      key: 'areas',
      label: names.join(', '),
      field: 'Area',
      onRemove: () => setAreas([]),
    })
  }
  if (selectedProjects.length > 0) {
    const names = (projectsData?.projects ?? [])
      .filter((p) => selectedProjects.includes(p.id))
      .map((p) => p.title)
    chips.push({
      key: 'projects',
      label: names.join(', '),
      field: 'Project',
      onRemove: () => setProjects([]),
    })
  }
  if (highPriority) {
    chips.push({
      key: 'priority',
      label: 'On',
      field: 'Priority',
      onRemove: () => setHighPriority(false),
    })
  }
  if (plannedDate) {
    chips.push({
      key: 'planned',
      label: getDateFilterLabel(plannedDate),
      field: 'Planned',
      onRemove: () => setPlannedDate(null),
    })
  }
  if (deadline) {
    chips.push({
      key: 'deadline',
      label: getDateFilterLabel(deadline),
      field: 'Deadline',
      onRemove: () => setDeadline(null),
    })
  }
  if (search) {
    chips.push({
      key: 'search',
      label: `"${search}"`,
      field: 'Search',
      onRemove: () => setSearch(''),
    })
  }

  return (
    <div className="mb-4">
      {/* Filter bar */}
      <div className="flex items-center gap-1 border-b border-neutral-100 pb-2 dark:border-neutral-800">
        {/* Search */}
        <div className="relative mr-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearch('')
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            placeholder="Filter..."
            className="h-7 w-32 rounded bg-transparent pl-7 pr-2 text-xs text-neutral-700 placeholder-neutral-400 outline-none transition-colors focus:bg-neutral-50 dark:text-neutral-300 dark:placeholder-neutral-500 dark:focus:bg-neutral-800/50"
          />
        </div>

        {/* Primary filters */}
        {primaryFields.includes('area') && (
          <MultiSelectFilter
            label="Area"
            options={allAreas.map((a) => ({ id: a.id, label: a.title }))}
            selected={selectedAreas}
            onChange={setAreas}
          />
        )}
        {primaryFields.includes('project') && (
          <MultiSelectFilter
            label="Project"
            options={allProjects.map((p) => ({ id: p.id, label: p.title }))}
            selected={selectedProjects}
            onChange={setProjects}
          />
        )}
        {primaryFields.includes('highPriority') && (
          <button
            onClick={() => setHighPriority(!highPriority)}
            className={`flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors ${
              highPriority
                ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
            }`}
          >
            <Flag size={12} />
            Priority
          </button>
        )}

        {/* Secondary filters (progressive disclosure) */}
        {hasSecondary && expanded && (
          <>
            {secondaryFields.includes('plannedDate') && (
              <DateFilterButton
                label="Planned"
                icon={<Calendar size={12} />}
                value={plannedDate}
                onChange={setPlannedDate}
                presets={PLANNED_DATE_PRESETS}
              />
            )}
            {secondaryFields.includes('deadline') && (
              <DateFilterButton
                label="Deadline"
                icon={<AlertTriangle size={12} />}
                value={deadline}
                onChange={setDeadline}
                presets={DEADLINE_PRESETS}
              />
            )}
          </>
        )}

        {/* More filters toggle */}
        {hasSecondary && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex h-7 items-center gap-1 rounded px-2 text-xs text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            {expanded ? <ArrowLeftFromLine size={12} /> : <ArrowRightFromLine size={12} />}
            {expanded ? 'Less' : 'More'}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Clear all */}
        {hasActive && (
          <button
            onClick={clearAll}
            className="flex h-7 items-center gap-1 rounded px-2 text-xs text-neutral-400 transition-colors hover:text-red-500"
          >
            <X size={12} />
            Clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs dark:bg-red-900/20"
            >
              <span className="text-neutral-500 dark:text-neutral-400">{chip.field}:</span>
              <span className="max-w-[150px] truncate text-red-600 dark:text-red-400">{chip.label}</span>
              <button
                onClick={chip.onRemove}
                className="ml-0.5 text-neutral-400 hover:text-red-500"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Multi-select dropdown ──────────────────────────────────────── */

interface MultiSelectFilterProps {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}

function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const showSearch = options.length > 5

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch('') }}>
      <Popover.Trigger asChild>
        <button
          className={`flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors ${
            selected.length > 0
              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          {label}
          {selected.length > 0 && (
            <span className="rounded bg-red-500 px-1 text-[10px] font-medium text-white">
              {selected.length}
            </span>
          )}
          <ChevronDown size={10} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          {showSearch && (
            <div className="relative mb-1 px-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="h-7 w-full rounded bg-neutral-50 pl-7 pr-2 text-xs text-neutral-700 outline-none dark:bg-neutral-800 dark:text-neutral-300"
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-neutral-400">No options</p>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggle(opt.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                        : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                        isSelected
                          ? 'border-red-500 bg-red-500 text-white'
                          : 'border-neutral-300 dark:border-neutral-600'
                      }`}
                    >
                      {isSelected && '✓'}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                )
              })
            )}
          </div>
          {selected.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="mt-1 w-full border-t border-neutral-100 pt-1 text-center text-xs text-neutral-400 hover:text-red-500 dark:border-neutral-800"
            >
              Clear selection
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

/* ─── Date filter dropdown ───────────────────────────────────────── */

interface DateFilterButtonProps {
  label: string
  icon: React.ReactNode
  value: DateFilter | null
  onChange: (filter: DateFilter | null) => void
  presets: { label: string; value: DateFilter }[]
}

function DateFilterButton({ label, icon, value, onChange, presets }: DateFilterButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors ${
            value
              ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300'
          }`}
        >
          {icon}
          {label}
          <ChevronDown size={10} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
        >
          <CalendarPicker value={value} onChange={onChange} presets={presets} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
