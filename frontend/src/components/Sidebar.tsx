import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
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
  PanelLeft,
  Plus,
  Package,
  Blocks,
  CirclePlus,
} from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Popover from '@radix-ui/react-popover'
import { useDraggable } from '@dnd-kit/core'

import { motion, AnimatePresence } from 'framer-motion'
import { useAreas, useProjects, useTags, useCreateProject, useCreateArea, useToday } from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { ThemeToggle } from './ThemeToggle'
import { SidebarDropTarget } from './SidebarDropTarget'

const smartLists = [
  { to: '/inbox', label: 'Inbox', icon: Inbox, dropId: 'sidebar-inbox' },
  { to: '/today', label: 'Today', icon: Sun, dropId: 'sidebar-today' },
  { to: '/upcoming', label: 'Upcoming', icon: Calendar, dropId: null },
  { to: '/anytime', label: 'Anytime', icon: Layers, dropId: 'sidebar-anytime' },
  { to: '/someday', label: 'Someday', icon: Clock, dropId: 'sidebar-someday' },
  { to: '/logbook', label: 'Completed', icon: CircleCheckBig, dropId: 'sidebar-completed' },
  { to: '/trash', label: 'Trash', icon: Trash2, dropId: 'sidebar-trash' },
] as const

function SmartListNav() {
  const { data: todayData } = useToday()
  const overdueCount = todayData?.overdue?.length ?? 0

  return (
    <nav className="space-y-0.5">
      {smartLists.map(({ to, label, icon: Icon, dropId }) => {
        const link = (
          <NavLink
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
            {label === 'Today' && overdueCount > 0 && (
              <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                {overdueCount}
              </span>
            )}
          </NavLink>
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

function DraggableProject({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `drag-project-${projectId}`,
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </div>
  )
}

function AreaList() {
  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()
  const open = useAppStore((s) => s.sidebarAreasOpen)
  const setOpen = useAppStore((s) => s.setSidebarAreasOpen)

  const areas = areasData?.areas ?? []
  const projects = projectsData?.projects ?? []

  if (areas.length === 0 && projects.length === 0) return null

  return (
    <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
        <ChevronRight
          size={14}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        Areas &amp; Projects
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
              {areas.map((area) => {
                const areaProjects = projects.filter((p) => p.area_id === area.id)
                return (
                  <div key={area.id}>
                    <SidebarDropTarget id={`sidebar-area-${area.id}`}>
                      <NavLink
                        to={`/area/${area.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                            isActive
                              ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                          }`
                        }
                      >
                        <Blocks size={16} />
                        <span>{area.title}</span>
                      </NavLink>
                    </SidebarDropTarget>
                    {areaProjects.map((project) => (
                      <SidebarDropTarget key={project.id} id={`sidebar-project-${project.id}`}>
                        <DraggableProject projectId={project.id}>
                          <NavLink
                            to={`/project/${project.id}`}
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm ${
                                isActive
                                  ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                              }`
                            }
                          >
                            <Package size={14} className="text-neutral-400 dark:text-neutral-500" />
                            <span className="truncate">{project.title}</span>
                          </NavLink>
                        </DraggableProject>
                      </SidebarDropTarget>
                    ))}
                  </div>
                )
              })}
              {projects
                .filter((p) => !p.area_id)
                .map((project) => (
                  <SidebarDropTarget key={project.id} id={`sidebar-project-${project.id}`}>
                    <DraggableProject projectId={project.id}>
                      <NavLink
                        to={`/project/${project.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                            isActive
                              ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                          }`
                        }
                      >
                        <Package size={14} className={
                            project.task_count > 0 &&
                            project.completed_task_count === project.task_count
                              ? 'text-green-500'
                              : 'text-neutral-400 dark:text-neutral-500'
                        } />
                        <span className="truncate">{project.title}</span>
                      </NavLink>
                    </DraggableProject>
                  </SidebarDropTarget>
                ))}
            </motion.div>
          </Collapsible.Content>
        )}
      </AnimatePresence>
    </Collapsible.Root>
    </div>
  )
}

function TagList() {
  const { data } = useTags()
  const open = useAppStore((s) => s.sidebarTagsOpen)
  const setOpen = useAppStore((s) => s.setSidebarTagsOpen)
  const tags = data?.tags ?? []

  if (tags.length === 0) return null

  return (
    <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300">
        <ChevronRight
          size={14}
          className={`transition-transform ${open ? 'rotate-90' : ''}`}
        />
        Tags
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
              {tags
                .filter((t) => !t.parent_tag_id)
                .map((tag) => {
                  const children = tags.filter((t) => t.parent_tag_id === tag.id)
                  return (
                    <div key={tag.id}>
                      <SidebarDropTarget id={`sidebar-tag-${tag.id}`}>
                        <NavLink
                          to={`/tag/${tag.id}`}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                              isActive
                                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                            }`
                          }
                        >
                          <Tag size={14} />
                          <span>{tag.title}</span>
                          {tag.task_count > 0 && (
                            <span className="ml-auto text-xs text-neutral-400">
                              {tag.task_count}
                            </span>
                          )}
                        </NavLink>
                      </SidebarDropTarget>
                      {children.map((child) => (
                        <SidebarDropTarget key={child.id} id={`sidebar-tag-${child.id}`}>
                          <NavLink
                            to={`/tag/${child.id}`}
                            className={({ isActive }) =>
                              `flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm ${
                                isActive
                                  ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
                              }`
                            }
                          >
                            <Tag size={12} />
                            <span>{child.title}</span>
                          </NavLink>
                        </SidebarDropTarget>
                      ))}
                    </div>
                  )
                })}
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
  onSubmit: (name: string) => void
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on open
      setValue('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh]"
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
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl dark:bg-neutral-800">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-neutral-400">{icon}</span>
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const trimmed = value.trim()
                  if (trimmed) {
                    onSubmit(trimmed)
                    onClose()
                  }
                }
              }}
              className="flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:text-neutral-500">
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
        onSubmit={(name) => createProject.mutate({ title: name, area_id: currentAreaId })}
      />
      <NameInputDialog
        icon={<Blocks size={18} />}
        label="area"
        placeholder="New area name..."
        open={dialogType === 'area'}
        onClose={() => setDialogType(null)}
        onSubmit={(name) => createArea.mutate({ title: name })}
      />
    </>
  )
}

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const { data: todayData } = useToday()
  const overdueCount = todayData?.overdue?.length ?? 0

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={18} />
        </button>
        <nav className="mt-4 flex flex-col items-center gap-1">
          {smartLists.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group relative rounded-lg p-1.5 transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700'
                }`
              }
            >
              <Icon size={18} />
              {label === 'Today' && overdueCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                  {overdueCount}
                </span>
              )}
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-neutral-700">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <PlusMenu side="right" />
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex w-64 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-3 dark:border-neutral-700">
        <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">ThingsToDo</h1>
        <div className="flex gap-1">
          <ThemeToggle />
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <SmartListNav />
        <AreaList />
        <TagList />
      </div>
      <div className="border-t border-neutral-200 p-3 dark:border-neutral-700">
        <PlusMenu side="top" />
      </div>
    </aside>
  )
}
