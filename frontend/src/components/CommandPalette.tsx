import { Command } from 'cmdk'
import { useNavigate } from 'react-router'
import {
  Inbox,
  Sun,
  Calendar,
  Layers,
  Clock,
  CircleCheckBig,
  Trash2,
  Package,
  Blocks,
  Tag,
} from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useProjects, useAreas, useTags } from '../hooks/queries'

const pages = [
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/today', label: 'Today', icon: Sun },
  { path: '/upcoming', label: 'Upcoming', icon: Calendar },
  { path: '/anytime', label: 'Anytime', icon: Layers },
  { path: '/someday', label: 'Someday', icon: Clock },
  { path: '/logbook', label: 'Completed', icon: CircleCheckBig },
  { path: '/trash', label: 'Trash', icon: Trash2 },
] as const

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen)
  const close = useAppStore((s) => s.closeCommandPalette)
  const navigate = useNavigate()

  const { data: projectsData } = useProjects()
  const { data: areasData } = useAreas()
  const { data: tagsData } = useTags()

  const projects = projectsData?.projects
  const areas = areasData?.areas
  const tags = tagsData?.tags

  if (!open) return null

  function select(path: string) {
    navigate(path)
    close()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[8vh] md:pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          close()
        }
      }}
    >
      <Command className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-2xl md:mx-0 dark:bg-neutral-800">
        <Command.Input
          autoFocus
          placeholder="Go to..."
          className="w-full border-b border-neutral-200 bg-transparent px-4 py-3 text-base outline-none placeholder:text-neutral-400 dark:border-neutral-700 dark:placeholder:text-neutral-500"
        />
        <Command.List className="max-h-72 overflow-y-auto p-2">
          <Command.Empty className="px-4 py-6 text-center text-sm text-neutral-500">
            No results found.
          </Command.Empty>

          <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-neutral-500">
            {pages.map(({ path, label, icon: Icon }) => (
              <Command.Item
                key={path}
                value={label}
                onSelect={() => select(path)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 aria-selected:bg-neutral-100 dark:text-neutral-300 dark:aria-selected:bg-neutral-700"
              >
                <Icon size={16} className="shrink-0 text-neutral-400" />
                {label}
              </Command.Item>
            ))}
          </Command.Group>

          {projects && projects.length > 0 && (
            <Command.Group heading="Projects" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-neutral-500">
              {projects.map((p) => (
                <Command.Item
                  key={p.id}
                  value={p.title}
                  onSelect={() => select(`/project/${p.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 aria-selected:bg-neutral-100 dark:text-neutral-300 dark:aria-selected:bg-neutral-700"
                >
                  <Package size={16} className="shrink-0 text-neutral-400" />
                  {p.title}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {areas && areas.length > 0 && (
            <Command.Group heading="Areas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-neutral-500">
              {areas.map((a) => (
                <Command.Item
                  key={a.id}
                  value={a.title}
                  onSelect={() => select(`/area/${a.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 aria-selected:bg-neutral-100 dark:text-neutral-300 dark:aria-selected:bg-neutral-700"
                >
                  <Blocks size={16} className="shrink-0 text-neutral-400" />
                  {a.title}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {tags && tags.length > 0 && (
            <Command.Group heading="Tags" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-neutral-500">
              {tags.map((t) => (
                <Command.Item
                  key={t.id}
                  value={t.title}
                  onSelect={() => select(`/tag/${t.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-700 aria-selected:bg-neutral-100 dark:text-neutral-300 dark:aria-selected:bg-neutral-700"
                >
                  <Tag size={16} className="shrink-0 text-neutral-400" />
                  {t.title}
                </Command.Item>
              ))}
            </Command.Group>
          )}
        </Command.List>
        <div className="hidden items-center justify-between border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 md:flex dark:border-neutral-700 dark:text-neutral-500">
          <span>↑↓ Navigate · Enter Select</span>
          <span>Esc Close</span>
        </div>
      </Command>
    </div>
  )
}
