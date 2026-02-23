import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import {
  Inbox,
  Sun,
  Calendar,
  Layers,
  Clock,
  CircleCheckBig,
  Trash2,
  Tag,
  ChevronRight,
  PanelLeftClose,
  Plus,
  Package,
  Blocks,
  CirclePlus,
  Settings,
  LogOut,
  RotateCcw,
  ArrowDownAZ,
  ArrowDownZA,
  X,
} from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Popover from '@radix-ui/react-popover'

import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { ApiError } from '../api/client'
import { useAreas, useProjects, useTags, useCreateProject, useCreateArea, useViewCounts, useUpdateProject, useUpdateArea, useUpdateTag, useSettings, useReorderAreas, useReorderProjects, useReorderTags, useMe, useLogout } from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { ThemeToggle } from './ThemeToggle'
import { SidebarDropTarget } from './SidebarDropTarget'
import { TAG_COLORS, getTagIconClass, getTagDropClasses } from '../lib/tag-colors'
import { isSiYuanTag } from '../lib/siyuan'
import { SiYuanIcon } from './SiYuanIcon'

const indicatorTransition = { type: 'spring' as const, stiffness: 400, damping: 35 }

function SidebarNavLink({
  to,
  className,
  activeClassName,
  inactiveClassName,
  layoutId,
  children,
}: {
  to: string
  className: string
  activeClassName: string
  inactiveClassName: string
  layoutId: string
  children: React.ReactNode
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative ${className} ${isActive ? activeClassName : inactiveClassName}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-red-100 dark:bg-red-900/50"
              transition={indicatorTransition}
            />
          )}
          {children}
        </>
      )}
    </NavLink>
  )
}

function getDuplicateErrorMessage(err: unknown): string | null {
  if (err instanceof ApiError && err.status === 409) {
    try {
      const body = JSON.parse(err.message)
      return body.error || 'A duplicate already exists'
    } catch {
      return 'A duplicate already exists'
    }
  }
  return null
}

function EditableSidebarItem({
  to,
  className,
  activeClassName,
  inactiveClassName,
  layoutId,
  icon,
  title,
  badge,
  onSave,
  editingId,
  itemId,
  onEditStart,
  onEditEnd,
}: {
  to: string
  className: string
  activeClassName: string
  inactiveClassName: string
  layoutId: string
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  onSave: (newTitle: string) => Promise<void>
  editingId: string | null
  itemId: string
  onEditStart: (id: string) => void
  onEditEnd: () => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurRef = useRef(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isEditing = editingId === itemId
  const isActive = location.pathname === to

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on edit start
      setErrorMsg(null)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isEditing])

  const saveAndExit = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== title) {
      try {
        await onSave(trimmed)
      } catch (err) {
        const dupMsg = getDuplicateErrorMessage(err)
        if (dupMsg) {
          setErrorMsg(dupMsg)
          return
        }
      }
    }
    onEditEnd()
  }, [title, onSave, onEditEnd])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      // Save current editing item if any, then start editing this one
      onEditStart(itemId)
      return
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      navigate(to)
    }, 200)
  }, [navigate, to, onEditStart, itemId])

  if (isEditing) {
    return (
      <div>
        <div className={`relative ${className} ${isActive ? activeClassName : inactiveClassName}`}>
          {isActive && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-red-100 dark:bg-red-900/50"
              transition={indicatorTransition}
            />
          )}
          {icon}
          <input
            ref={inputRef}
            type="text"
            defaultValue={title}
            className="relative z-10 min-w-0 flex-1 bg-transparent outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                skipBlurRef.current = true
                saveAndExit(e.currentTarget.value)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                skipBlurRef.current = true
                setErrorMsg(null)
                onEditEnd()
              }
            }}
            onBlur={(e) => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false
                return
              }
              saveAndExit(e.currentTarget.value)
            }}
          />
        </div>
        {errorMsg && (
          <p className="px-3 pt-0.5 text-xs text-red-500">{errorMsg}</p>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={to}
      onClick={handleClick}
      className={({ isActive: active }) =>
        `group/item relative ${className} ${active ? activeClassName : inactiveClassName}`
      }
    >
      {({ isActive: active }) => (
        <>
          {active && (
            <motion.div
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-red-100 dark:bg-red-900/50"
              transition={indicatorTransition}
            />
          )}
          {icon}
          <span className="relative z-10 truncate" title="Double-click to rename">{title}</span>
          {badge}
        </>
      )}
    </NavLink>
  )
}

const smartLists = [
  { to: '/inbox', label: 'Inbox', icon: Inbox, dropId: 'sidebar-inbox' },
  { to: '/today', label: 'Today', icon: Sun, dropId: 'sidebar-today' },
  { to: '/upcoming', label: 'Upcoming', icon: Calendar, dropId: null },
  { to: '/anytime', label: 'Anytime', icon: Layers, dropId: 'sidebar-anytime' },
  { to: '/someday', label: 'Someday', icon: Clock, dropId: 'sidebar-someday' },
  { to: '/logbook', label: 'Completed', icon: CircleCheckBig, dropId: 'sidebar-completed' },
  { to: '/trash', label: 'Trash', icon: Trash2, dropId: 'sidebar-trash' },
] as const

const countKeyMap: Record<string, keyof import('../api/types').ViewCounts | null> = {
  Inbox: 'inbox',
  Today: 'today',
  Upcoming: null,
  Anytime: 'anytime',
  Someday: 'someday',
  Completed: 'logbook',
  Trash: 'trash',
}

function SmartListNav() {
  const { data: counts } = useViewCounts()
  const { data: settings } = useSettings()
  const overdueCount = counts?.overdue ?? 0
  const reviewCount = counts?.review ?? 0
  const showCounts = settings?.show_count_main !== false

  return (
    <nav className="space-y-0.5">
      {smartLists.map(({ to, label, icon: Icon, dropId }) => {
        const countKey = countKeyMap[label]
        const count = countKey && counts ? counts[countKey] : 0
        const link = (
          <SidebarNavLink
            to={to}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            activeClassName="text-red-700 dark:text-red-400"
            inactiveClassName="text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
            layoutId="sidebar-active-indicator"
          >
            <Icon size={18} className="relative z-10" />
            <span className="relative z-10">{label}</span>
            {((overdueCount > 0 && label === 'Today') || (reviewCount > 0 && label === 'Inbox') || (showCounts && count > 0)) && (
              <span className="relative z-10 ml-auto flex items-center gap-1.5">
                {label === 'Today' && overdueCount > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {overdueCount}
                  </span>
                )}
                {label === 'Inbox' && reviewCount > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {reviewCount}
                  </span>
                )}
                {showCounts && ((label === 'Inbox' && reviewCount > 0) || (label === 'Today' && overdueCount > 0)
                  ? <span className="flex h-5 w-5 items-center justify-center text-xs text-neutral-400">{count}</span>
                  : count > 0 && (
                    <span className="flex h-5 w-5 items-center justify-center text-xs text-neutral-400">
                      {count}
                    </span>
                  )
                )}
              </span>
            )}
          </SidebarNavLink>
        )
        if (dropId) {
          return (
            <SidebarDropTarget key={to} id={dropId}>
              {link}
            </SidebarDropTarget>
          )
        }
        return <div key={to}>{link}</div>
      })}
    </nav>
  )
}


function SortButtons({ onSort }: { onSort: (direction: 'a-z' | 'z-a') => void }) {
  return (
    <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
      <button
        onClick={(e) => { e.stopPropagation(); onSort('a-z') }}
        className="flex h-5 w-5 items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        title="Sort A-Z"
      >
        <ArrowDownAZ size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onSort('z-a') }}
        className="flex h-5 w-5 items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        title="Sort Z-A"
      >
        <ArrowDownZA size={12} />
      </button>
    </span>
  )
}

function SortableSidebarItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

function AreaProjectsBadge({
  area,
  hasProjects,
  isCollapsed,
  showCounts,
  onToggle,
}: {
  area: { standalone_task_count: number }
  hasProjects: boolean
  isCollapsed: boolean
  showCounts: boolean
  onToggle: () => void
}) {
  const showCount = showCounts && area.standalone_task_count > 0

  if (!hasProjects) {
    if (!showCount) return null
    return (
      <span className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center text-xs text-neutral-400">
        {area.standalone_task_count}
      </span>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
    >
      {showCount && (
        <span className="text-xs group-hover/item:hidden">{area.standalone_task_count}</span>
      )}
      <ChevronRight
        size={14}
        className={`transition-transform ${showCount ? 'hidden' : 'opacity-0'} group-hover/item:inline-block group-hover/item:opacity-100 ${!isCollapsed ? 'rotate-90' : ''}`}
      />
    </button>
  )
}

function sortAlpha<T extends { title: string }>(items: T[], direction: 'a-z' | 'z-a'): T[] {
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title))
  return direction === 'z-a' ? sorted.reverse() : sorted
}

function AreaList() {
  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()
  const { data: settings } = useSettings()
  const reorderAreasMut = useReorderAreas()
  const reorderProjectsMut = useReorderProjects()
  const open = useAppStore((s) => s.sidebarAreasOpen)
  const setOpen = useAppStore((s) => s.setSidebarAreasOpen)
  const collapsedAreaIds = useAppStore((s) => s.collapsedAreaIds)
  const toggleAreaCollapsed = useAppStore((s) => s.toggleAreaCollapsed)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const updateProject = useUpdateProject()
  const updateArea = useUpdateArea()
  const showCounts = settings?.show_count_projects !== false

  const areasArr = areasData?.areas
  const projectsArr = projectsData?.projects

  const areas = useMemo(() => areasArr ?? [], [areasArr])
  const projects = useMemo(() => projectsArr ?? [], [projectsArr])

  const clearEditing = useCallback(() => setEditingItemId(null), [])

  const areaIds = useMemo(() => areas.map((a) => `sort-area-${a.id}`), [areas])
  const standaloneProjectIds = useMemo(
    () => projects.filter((p) => !p.area_id).map((p) => `sort-project-${p.id}`),
    [projects],
  )

  const handleSort = useCallback((direction: 'a-z' | 'z-a') => {
    const rawA = areasArr ?? []
    const rawP = projectsArr ?? []
    const sortedAreas = sortAlpha(rawA, direction)
    const areaItems = sortedAreas.map((a, i) => ({ id: a.id, sort_order: (i + 1) * 1024 }))
    reorderAreasMut.mutate(areaItems)
    const allProjectItems: { id: string; sort_order: number }[] = []
    let counter = 1
    for (const area of sortedAreas) {
      const ap = sortAlpha(rawP.filter((p) => p.area_id === area.id), direction)
      ap.forEach((p) => allProjectItems.push({ id: p.id, sort_order: counter++ * 1024 }))
    }
    const standalone = sortAlpha(rawP.filter((p) => !p.area_id), direction)
    standalone.forEach((p) => allProjectItems.push({ id: p.id, sort_order: counter++ * 1024 }))
    if (allProjectItems.length > 0) reorderProjectsMut.mutate(allProjectItems)
  }, [areasArr, projectsArr, reorderAreasMut, reorderProjectsMut])

  if (areas.length === 0 && projects.length === 0) return null

  return (
    <div className="group/section border-t border-neutral-200 pt-3 dark:border-neutral-700">
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
        Areas &amp; Projects
        <span className="ml-auto flex items-center gap-1">
          <SortButtons onSort={handleSort} />
          <span className="flex h-5 w-5 items-center justify-center">
            <ChevronRight
              size={14}
              className={`transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </span>
        </span>
      </Collapsible.Trigger>
      <AnimatePresence initial={false}>
        {open && (
          <Collapsible.Content forceMount asChild>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="space-y-1 overflow-hidden"
            >
              <SortableContext items={areaIds} strategy={verticalListSortingStrategy}>
              {areas.map((area) => {
                const areaProjects = projects.filter((p) => p.area_id === area.id)
                const areaProjectIds = areaProjects.map((p) => `sort-project-${p.id}`)
                const isCollapsed = collapsedAreaIds.has(area.id)
                return (
                  <SortableSidebarItem key={area.id} id={`sort-area-${area.id}`}>
                    <SidebarDropTarget id={`sidebar-area-${area.id}`}>
                      <EditableSidebarItem
                        to={`/area/${area.id}`}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
                        activeClassName="text-red-700 dark:text-red-400"
                        inactiveClassName="text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
                        layoutId="sidebar-active-indicator"
                        icon={<Blocks size={16} className="relative z-10" />}
                        title={area.title}
                        badge={
                          <AreaProjectsBadge
                            area={area}
                            hasProjects={areaProjects.length > 0}
                            isCollapsed={isCollapsed}
                            showCounts={showCounts}
                            onToggle={() => toggleAreaCollapsed(area.id)}
                          />
                        }
                        onSave={async (t) => { await updateArea.mutateAsync({ id: area.id, data: { title: t } }) }}
                        editingId={editingItemId}
                        itemId={area.id}
                        onEditStart={setEditingItemId}
                        onEditEnd={clearEditing}
                      />
                    </SidebarDropTarget>
                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          key={`area-projects-${area.id}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                          className="overflow-hidden"
                        >
                          <SortableContext items={areaProjectIds} strategy={verticalListSortingStrategy}>
                          {areaProjects.map((project) => {
                            const openCount = project.task_count - project.completed_task_count
                            return (
                            <SortableSidebarItem key={project.id} id={`sort-project-${project.id}`}>
                              <SidebarDropTarget id={`sidebar-project-${project.id}`}>
                                  <EditableSidebarItem
                                    to={`/project/${project.id}`}
                                    className="flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm"
                                    activeClassName="text-red-700 dark:text-red-400"
                                    inactiveClassName="text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
                                    layoutId="sidebar-active-indicator"
                                    icon={<Package size={14} className="relative z-10 text-neutral-400 dark:text-neutral-500" />}
                                    title={project.title}
                                    badge={showCounts && openCount > 0 ? (
                                      <span className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center text-xs text-neutral-400">
                                        {openCount}
                                      </span>
                                    ) : undefined}
                                    onSave={async (t) => { await updateProject.mutateAsync({ id: project.id, data: { title: t } }) }}
                                    editingId={editingItemId}
                                    itemId={project.id}
                                    onEditStart={setEditingItemId}
                                    onEditEnd={clearEditing}
                                  />
                              </SidebarDropTarget>
                            </SortableSidebarItem>
                            )
                          })}
                          </SortableContext>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </SortableSidebarItem>
                )
              })}
              </SortableContext>
              <SortableContext items={standaloneProjectIds} strategy={verticalListSortingStrategy}>
              {projects
                .filter((p) => !p.area_id)
                .map((project) => {
                  const openCount = project.task_count - project.completed_task_count
                  return (
                  <SortableSidebarItem key={project.id} id={`sort-project-${project.id}`}>
                    <SidebarDropTarget id={`sidebar-project-${project.id}`}>
                        <EditableSidebarItem
                          to={`/project/${project.id}`}
                          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
                          activeClassName="text-red-700 dark:text-red-400"
                          inactiveClassName="text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
                          layoutId="sidebar-active-indicator"
                          icon={<Package size={14} className={`relative z-10 ${
                              project.task_count > 0 &&
                              project.completed_task_count === project.task_count
                                ? 'text-green-500'
                                : 'text-neutral-400 dark:text-neutral-500'
                          }`} />}
                          title={project.title}
                          badge={showCounts && openCount > 0 ? (
                            <span className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center text-xs text-neutral-400">
                              {openCount}
                            </span>
                          ) : undefined}
                          onSave={async (t) => { await updateProject.mutateAsync({ id: project.id, data: { title: t } }) }}
                          editingId={editingItemId}
                          itemId={project.id}
                          onEditStart={setEditingItemId}
                          onEditEnd={clearEditing}
                        />
                    </SidebarDropTarget>
                  </SortableSidebarItem>
                  )
                })}
              </SortableContext>
            </motion.div>
          </Collapsible.Content>
        )}
      </AnimatePresence>
    </Collapsible.Root>
    </div>
  )
}

function TagSidebarItem({
  tag,
  editingId,
  onEditStart,
  onEditEnd,
  onSave,
  indent,
  showCounts,
}: {
  tag: import('../api/types').Tag
  editingId: string | null
  onEditStart: (id: string) => void
  onEditEnd: () => void
  onSave: (newTitle: string) => Promise<void>
  indent?: boolean
  showCounts: boolean
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const updateTag = useUpdateTag()
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iconClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipBlurRef = useRef(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const iconRef = useRef<HTMLButtonElement>(null)
  const isEditing = editingId === tag.id
  const to = `/tag/${tag.id}`
  const isActive = location.pathname === to
  const iconSize = indent ? 12 : 14
  const iconColorClass = getTagIconClass(tag.color)

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      if (iconClickTimerRef.current) clearTimeout(iconClickTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (isEditing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on edit start
      setErrorMsg(null)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [isEditing])

  const saveAndExit = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== tag.title) {
      try {
        await onSave(trimmed)
      } catch (err) {
        const dupMsg = getDuplicateErrorMessage(err)
        if (dupMsg) {
          setErrorMsg(dupMsg)
          return
        }
      }
    }
    onEditEnd()
  }, [tag.title, onSave, onEditEnd])

  // Title click: single = navigate, double = edit name
  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      onEditStart(tag.id)
      return
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      navigate(to)
    }, 200)
  }, [navigate, to, onEditStart, tag.id])

  // Icon click: single = navigate, double = color picker
  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (iconClickTimerRef.current) {
      clearTimeout(iconClickTimerRef.current)
      iconClickTimerRef.current = null
      setColorPickerOpen(true)
      return
    }
    iconClickTimerRef.current = setTimeout(() => {
      iconClickTimerRef.current = null
      navigate(to)
    }, 200)
  }, [navigate, to])

  const className = indent
    ? 'flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm'
    : 'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm'

  if (isEditing) {
    return (
      <div>
        <div className={`relative ${className} ${isActive ? 'text-red-700 dark:text-red-400' : 'text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700'}`}>
          {isActive && (
            <motion.div
              layoutId="sidebar-active-indicator"
              className="absolute inset-0 rounded-lg bg-red-100 dark:bg-red-900/50"
              transition={indicatorTransition}
            />
          )}
          {isSiYuanTag(tag.title) ? (
            <SiYuanIcon size={iconSize} className={`relative z-10 ${iconColorClass || 'text-neutral-400'}`} />
          ) : (
            <Tag size={iconSize} className={`relative z-10 ${iconColorClass}`} />
          )}
          <input
            ref={inputRef}
            type="text"
            defaultValue={tag.title}
            className="relative z-10 min-w-0 flex-1 bg-transparent outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                skipBlurRef.current = true
                saveAndExit(e.currentTarget.value)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                skipBlurRef.current = true
                setErrorMsg(null)
                onEditEnd()
              }
            }}
            onBlur={(e) => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false
                return
              }
              saveAndExit(e.currentTarget.value)
            }}
          />
        </div>
        {errorMsg && (
          <p className="px-3 pt-0.5 text-xs text-red-500">{errorMsg}</p>
        )}
      </div>
    )
  }

  return (
    <Popover.Root open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
      <NavLink
        to={to}
        onClick={(e) => { e.preventDefault(); navigate(to) }}
        className={({ isActive: active }) =>
          `relative ${className} ${active ? 'text-red-700 dark:text-red-400' : indent ? 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700' : 'text-neutral-600 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700'}`
        }
      >
        {({ isActive: active }) => (
          <>
            {active && (
              <motion.div
                layoutId="sidebar-active-indicator"
                className="absolute inset-0 rounded-lg bg-red-100 dark:bg-red-900/50"
                transition={indicatorTransition}
              />
            )}
            <Popover.Anchor asChild>
              <button
                ref={iconRef}
                onClick={handleIconClick}
                className={`relative z-10 ${iconColorClass || (isSiYuanTag(tag.title) ? 'text-neutral-400' : '')}`}
                title="Double-click to set color"
              >
                {isSiYuanTag(tag.title) ? <SiYuanIcon size={iconSize} /> : <Tag size={iconSize} />}
              </button>
            </Popover.Anchor>
            <span
              className="relative z-10 truncate"
              onClick={handleTitleClick}
              title="Double-click to rename"
            >
              {tag.title}
            </span>
            {showCounts && tag.task_count > 0 && (
              <span className="relative z-10 ml-auto flex h-5 w-5 items-center justify-center text-xs text-neutral-400">
                {tag.task_count}
              </span>
            )}
          </>
        )}
      </NavLink>
      <Popover.Portal>
        <Popover.Content
          side="right"
          sideOffset={8}
          className="z-50 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-1.5">
            {TAG_COLORS.map((c) => (
              <button
                key={c.value}
                className={`h-5 w-5 rounded-full ${c.dot} transition-transform hover:scale-125 ${
                  tag.color === c.value ? 'ring-2 ring-offset-1 ring-neutral-400 dark:ring-offset-neutral-800' : ''
                }`}
                onClick={() => {
                  updateTag.mutate({ id: tag.id, data: { color: c.value } })
                  setColorPickerOpen(false)
                }}
                aria-label={c.name}
              />
            ))}
            <button
              className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 transition-transform hover:scale-125 hover:text-neutral-600 dark:hover:text-neutral-300"
              onClick={() => {
                updateTag.mutate({ id: tag.id, data: { color: null } })
                setColorPickerOpen(false)
              }}
              aria-label="Reset color"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

function TagList() {
  const { data } = useTags()
  const { data: settings } = useSettings()
  const reorderTagsMut = useReorderTags()
  const open = useAppStore((s) => s.sidebarTagsOpen)
  const setOpen = useAppStore((s) => s.setSidebarTagsOpen)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const updateTag = useUpdateTag()
  const showCounts = settings?.show_count_tags !== false
  const tagsArr = data?.tags

  const tags = useMemo(() => tagsArr ?? [], [tagsArr])

  const clearEditing = useCallback(() => setEditingItemId(null), [])

  const rootTags = useMemo(() => tags.filter((t) => !t.parent_tag_id), [tags])
  const tagIds = useMemo(() => rootTags.map((t) => `sort-tag-${t.id}`), [rootTags])

  const handleSort = useCallback((direction: 'a-z' | 'z-a') => {
    const raw = (tagsArr ?? []).filter((t) => !t.parent_tag_id)
    const sorted = sortAlpha(raw, direction)
    const items = sorted.map((t, i) => ({ id: t.id, sort_order: (i + 1) * 1024 }))
    reorderTagsMut.mutate(items)
  }, [tagsArr, reorderTagsMut])

  if (tags.length === 0) return null

  return (
    <div className="group/section border-t border-neutral-200 pt-3 dark:border-neutral-700">
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
        Tags
        <span className="ml-auto flex items-center gap-1">
          <SortButtons onSort={handleSort} />
          <span className="flex h-5 w-5 items-center justify-center">
            <ChevronRight
              size={14}
              className={`transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </span>
        </span>
      </Collapsible.Trigger>
      <AnimatePresence initial={false}>
        {open && (
          <Collapsible.Content forceMount asChild>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="space-y-0.5 overflow-hidden"
            >
              <SortableContext items={tagIds} strategy={verticalListSortingStrategy}>
              {rootTags.map((tag) => {
                  const children = tags.filter((t) => t.parent_tag_id === tag.id)
                  const isSiyuan = isSiYuanTag(tag.title)
                  const tagItem = (
                    <TagSidebarItem
                      tag={tag}
                      editingId={editingItemId}
                      onEditStart={setEditingItemId}
                      onEditEnd={clearEditing}
                      onSave={async (t) => { await updateTag.mutateAsync({ id: tag.id, data: { title: t } }) }}
                      showCounts={showCounts}
                    />
                  )
                  return (
                    <SortableSidebarItem key={tag.id} id={`sort-tag-${tag.id}`}>
                      {isSiyuan ? (
                        <div>{tagItem}</div>
                      ) : (
                        <SidebarDropTarget id={`sidebar-tag-${tag.id}`} dropClasses={getTagDropClasses(tag.color)}>
                          {tagItem}
                        </SidebarDropTarget>
                      )}
                      {children.map((child) => {
                        const isChildSiyuan = isSiYuanTag(child.title)
                        const childItem = (
                          <TagSidebarItem
                            tag={child}
                            editingId={editingItemId}
                            onEditStart={setEditingItemId}
                            onEditEnd={clearEditing}
                            onSave={async (t) => { await updateTag.mutateAsync({ id: child.id, data: { title: t } }) }}
                            indent
                            showCounts={showCounts}
                          />
                        )
                        return isChildSiyuan ? (
                          <div key={child.id}>{childItem}</div>
                        ) : (
                          <SidebarDropTarget key={child.id} id={`sidebar-tag-${child.id}`} dropClasses={getTagDropClasses(child.color)}>
                            {childItem}
                          </SidebarDropTarget>
                        )
                      })}
                    </SortableSidebarItem>
                  )
                })}
              </SortableContext>
            </motion.div>
          </Collapsible.Content>
        )}
      </AnimatePresence>
    </Collapsible.Root>
    </div>
  )
}

function NameInputDialog({
  icon,
  label,
  placeholder,
  open,
  onClose,
  onSubmit,
}: {
  icon: React.ReactNode
  label: string
  placeholder: string
  open: boolean
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  const [value, setValue] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open
      setValue('')
      setErrorMsg(null)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim()
    if (!trimmed) return
    try {
      await onSubmit(trimmed)
      onClose()
    } catch (err) {
      const dupMsg = getDuplicateErrorMessage(err)
      if (dupMsg) {
        setErrorMsg(dupMsg)
      } else {
        onClose()
      }
    }
  }, [value, onSubmit, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[8vh] md:pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl md:mx-0 dark:bg-neutral-800">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-neutral-400">{icon}</span>
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (errorMsg) setErrorMsg(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </div>
          {errorMsg && (
            <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
          )}
        </div>
        <div className="hidden items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 md:flex dark:border-neutral-700 dark:text-neutral-500">
          <span>Enter to create {label}</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  )
}

function PlusMenu({ side }: { side: 'top' | 'right' }) {
  const openQuickEntry = useAppStore((s) => s.openQuickEntry)
  const createProject = useCreateProject()
  const createArea = useCreateArea()
  const location = useLocation()
  const [dialogType, setDialogType] = useState<'project' | 'area' | null>(null)

  // Detect if an area page is currently selected
  const areaMatch = location.pathname.match(/^\/area\/(.+)$/)
  const currentAreaId = areaMatch ? areaMatch[1] : null

  const itemClass =
    'flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'

  return (
    <>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
            aria-label="New item"
          >
            <Plus size={18} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side={side}
            sideOffset={8}
            className="z-50 w-44 rounded-lg border border-neutral-200 bg-neutral-50 p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
          >
            <button className={itemClass} onClick={() => openQuickEntry()}>
              <CirclePlus size={16} />
              New Task
            </button>
            <button className={itemClass} onClick={() => setDialogType('project')}>
              <Package size={16} />
              New Project
            </button>
            <button className={itemClass} onClick={() => setDialogType('area')}>
              <Blocks size={16} />
              New Area
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <NameInputDialog
        icon={<Package size={18} />}
        label="project"
        placeholder="New project name..."
        open={dialogType === 'project'}
        onClose={() => setDialogType(null)}
        onSubmit={async (name) => { await createProject.mutateAsync({ title: name, area_id: currentAreaId }) }}
      />
      <NameInputDialog
        icon={<Blocks size={18} />}
        label="area"
        placeholder="New area name..."
        open={dialogType === 'area'}
        onClose={() => setDialogType(null)}
        onSubmit={async (name) => { await createArea.mutateAsync({ title: name }) }}
      />
    </>
  )
}

function LogoutButton({ size = 16 }: { size?: number }) {
  const { data } = useMe()
  const logout = useLogout()

  if (data?.auth_mode !== 'builtin' && data?.auth_mode !== 'oidc') return null

  return (
    <button
      onClick={() => logout.mutate()}
      className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
      aria-label="Log out"
      title="Log out"
    >
      <LogOut size={size} />
    </button>
  )
}

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen)
  const closeMobileSidebar = useAppStore((s) => s.closeMobileSidebar)
  const navigate = useNavigate()
  const { data: counts } = useViewCounts()
  const overdueCount = counts?.overdue ?? 0
  const reviewCount = counts?.review ?? 0

  const expandedContent = (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <LayoutGroup id="sidebar-expanded">
          <SmartListNav />
          <AreaList />
          <TagList />
        </LayoutGroup>
      </div>
      <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 dark:border-neutral-700">
        <PlusMenu side="top" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LogoutButton />
          <button
            onClick={() => navigate('/settings')}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      {collapsed ? (
        <aside className="hidden w-12 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-3 md:flex dark:border-neutral-700 dark:bg-neutral-800">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
            aria-label="Expand sidebar"
          >
            <img src="/thingstodo.svg" alt="ThingsToDo" className="h-[18px] w-[18px]" />
          </button>
          <LayoutGroup id="sidebar-collapsed">
          <nav className="mt-4 flex flex-col items-center gap-1">
            {smartLists.map(({ to, label, icon: Icon }) => (
              <SidebarNavLink
                key={to}
                to={to}
                className="group rounded-lg p-1.5 transition-colors"
                activeClassName="text-red-700 dark:text-red-400"
                inactiveClassName="text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
                layoutId="sidebar-active-indicator-collapsed"
              >
                <Icon size={18} className="relative z-10" />
                {label === 'Today' && overdueCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 z-20 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                    {overdueCount}
                  </span>
                )}
                {label === 'Inbox' && reviewCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 z-20 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                    {reviewCount}
                  </span>
                )}
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-neutral-700">
                  {label}
                </span>
              </SidebarNavLink>
            ))}
          </nav>
          </LayoutGroup>
          <div className="mt-auto flex flex-col items-center gap-1">
            <PlusMenu side="right" />
          </div>
        </aside>
      ) : (
        <aside className="hidden w-72 flex-col border-r border-neutral-200 bg-neutral-50 md:flex dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-3 dark:border-neutral-700">
            <div className="flex items-center gap-3 px-3">
              <div className="flex w-[18px] items-center justify-center">
                <img src="/thingstodo.svg" alt="" className="h-6 w-6" />
              </div>
              <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">ThingsToDo</h1>
            </div>
            <button
              onClick={toggleSidebar}
              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          {expandedContent}
        </aside>
      )}

      {/* Mobile drawer */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMobileSidebar()
          }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={closeMobileSidebar} />
          <aside
            className="relative flex h-full w-72 flex-col bg-neutral-50 dark:bg-neutral-800"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-3 dark:border-neutral-700">
              <div className="flex items-center gap-3 px-3">
                <div className="flex w-[18px] items-center justify-center">
                  <img src="/thingstodo.svg" alt="" className="h-6 w-6" />
                </div>
                <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">ThingsToDo</h1>
              </div>
              <button
                onClick={closeMobileSidebar}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
                aria-label="Close sidebar"
              >
                <X size={16} />
              </button>
            </div>
            {expandedContent}
          </aside>
        </div>
      )}
    </>
  )
}
