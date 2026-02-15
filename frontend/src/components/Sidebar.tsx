import { NavLink } from 'react-router'
import {
  Inbox,
  Sun,
  Calendar,
  Layers,
  Clock,
  BookOpen,
  FolderOpen,
  Tag,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Plus,
} from 'lucide-react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAreas, useProjects, useTags, useCreateProject } from '../hooks/queries'
import { useAppStore } from '../stores/app'
import { ThemeToggle } from './ThemeToggle'
import { SidebarDropTarget } from './SidebarDropTarget'

const smartLists = [
  { to: '/inbox', label: 'Inbox', icon: Inbox, dropId: 'sidebar-inbox' },
  { to: '/today', label: 'Today', icon: Sun, dropId: 'sidebar-today' },
  { to: '/upcoming', label: 'Upcoming', icon: Calendar, dropId: null },
  { to: '/anytime', label: 'Anytime', icon: Layers, dropId: null },
  { to: '/someday', label: 'Someday', icon: Clock, dropId: 'sidebar-someday' },
  { to: '/logbook', label: 'Logbook', icon: BookOpen, dropId: null },
] as const

function SmartListNav() {
  return (
    <nav className="space-y-0.5">
      {smartLists.map(({ to, label, icon: Icon, dropId }) => {
        const link = (
          <NavLink
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
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

function AreaList() {
  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()
  const [open, setOpen] = useState(true)

  const areas = areasData?.areas ?? []
  const projects = projectsData?.projects ?? []

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
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
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                          }`
                        }
                      >
                        <FolderOpen size={16} />
                        <span>{area.title}</span>
                      </NavLink>
                    </SidebarDropTarget>
                    {areaProjects.map((project) => (
                      <SidebarDropTarget key={project.id} id={`sidebar-project-${project.id}`}>
                        <NavLink
                          to={`/project/${project.id}`}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm ${
                              isActive
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`
                          }
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full border-2 ${
                              project.task_count > 0 &&
                              project.completed_task_count === project.task_count
                                ? 'border-green-500 bg-green-500'
                                : 'border-gray-400 dark:border-gray-500'
                            }`}
                          />
                          <span className="truncate">{project.title}</span>
                        </NavLink>
                      </SidebarDropTarget>
                    ))}
                  </div>
                )
              })}
              {projects
                .filter((p) => !p.area_id)
                .map((project) => (
                  <SidebarDropTarget key={project.id} id={`sidebar-project-${project.id}`}>
                    <NavLink
                      to={`/project/${project.id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                        }`
                      }
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full border-2 ${
                          project.task_count > 0 &&
                          project.completed_task_count === project.task_count
                            ? 'border-green-500 bg-green-500'
                            : 'border-gray-400 dark:border-gray-500'
                        }`}
                      />
                      <span className="truncate">{project.title}</span>
                    </NavLink>
                  </SidebarDropTarget>
                ))}
            </motion.div>
          </Collapsible.Content>
        )}
      </AnimatePresence>
    </Collapsible.Root>
  )
}

function TagList() {
  const { data } = useTags()
  const [open, setOpen] = useState(false)
  const tags = data?.tags ?? []

  if (tags.length === 0) return null

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
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
                      <NavLink
                        to={`/tag/${tag.id}`}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                          }`
                        }
                      >
                        <Tag size={14} />
                        <span>{tag.title}</span>
                        {tag.task_count > 0 && (
                          <span className="ml-auto text-xs text-gray-400">
                            {tag.task_count}
                          </span>
                        )}
                      </NavLink>
                      {children.map((child) => (
                        <NavLink
                          key={child.id}
                          to={`/tag/${child.id}`}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-lg py-1.5 pl-8 pr-3 text-sm ${
                              isActive
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                            }`
                          }
                        >
                          <Tag size={12} />
                          <span>{child.title}</span>
                        </NavLink>
                      ))}
                    </div>
                  )
                })}
            </motion.div>
          </Collapsible.Content>
        )}
      </AnimatePresence>
    </Collapsible.Root>
  )
}

export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const createProject = useCreateProject()

  if (collapsed) {
    return (
      <aside className="flex w-12 flex-col items-center border-r border-gray-200 bg-gray-50 py-3 dark:border-gray-700 dark:bg-gray-800">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Expand sidebar"
        >
          <PanelLeft size={18} />
        </button>
      </aside>
    )
  }

  return (
    <aside className="flex w-64 flex-col border-r border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-3 dark:border-gray-700">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">ThingsToDo</h1>
        <div className="flex gap-1">
          <ThemeToggle />
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <SmartListNav />
        <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
          <AreaList />
        </div>
        <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
          <TagList />
        </div>
      </div>
      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <button
          onClick={() => {
            const title = prompt('Project name:')
            if (title?.trim()) {
              createProject.mutate({ title: title.trim() })
            }
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Plus size={16} />
          <span>New Project</span>
        </button>
      </div>
    </aside>
  )
}
