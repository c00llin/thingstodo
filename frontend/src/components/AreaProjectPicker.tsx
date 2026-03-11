import { useState, useRef, useEffect } from 'react'
import { Command } from 'cmdk'
import { Check, Blocks, Package, X } from 'lucide-react'
import { useAreas, useProjects, useUpdateTask, useSettings, queryKeys } from '../hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import type { TaskDetail } from '../api/types'

interface AreaProjectPickerBaseProps {
  externalOpen?: boolean
  onExternalOpenChange?: (open: boolean) => void
  /** Called after a selection is made (project, area-only, or clear). */
  onSelect?: () => void
  /** Called when the dropdown closes (Escape or outside click). */
  onClose?: () => void
  /** Position the dropdown above or below the trigger. Default: 'down' */
  dropdownPosition?: 'up' | 'down'
  /** Hide the trigger button (useful when embedding in another component). */
  hideTrigger?: boolean
}

interface AreaProjectPickerTaskProps extends AreaProjectPickerBaseProps {
  task: TaskDetail
  controlledAreaId?: never
  controlledProjectId?: never
  onControlledChange?: never
}

interface AreaProjectPickerControlledProps extends AreaProjectPickerBaseProps {
  task?: never
  controlledAreaId: string | null
  controlledProjectId: string | null
  onControlledChange: (areaId: string | null, projectId: string | null) => void
}

type AreaProjectPickerProps = AreaProjectPickerTaskProps | AreaProjectPickerControlledProps

export function AreaProjectPicker(props: AreaProjectPickerProps) {
  const { externalOpen, onExternalOpenChange, onSelect, onClose, dropdownPosition = 'down', hideTrigger = false } = props

  const [internalOpen, setInternalOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const isControlled = 'controlledAreaId' in props && props.controlledAreaId !== undefined
  const task = isControlled ? undefined : props.task
  const controlledAreaId = isControlled ? props.controlledAreaId : undefined
  const controlledProjectId = isControlled ? props.controlledProjectId : undefined
  const onControlledChange = isControlled ? props.onControlledChange : undefined

  const { data: settings } = useSettings()
  const { data: areasData } = useAreas()
  const { data: projectsData } = useProjects()
  const areas = areasData?.areas
  const allProjects = projectsData?.projects
  const updateTask = useUpdateTask()

  const open = externalOpen !== undefined ? (externalOpen || internalOpen) : internalOpen

  function doOpen() {
    setInternalOpen(true)
    onExternalOpenChange?.(true)
  }

  function doClose() {
    setInternalOpen(false)
    onExternalOpenChange?.(false)
    onClose?.()
  }

  // Sync external open → internal
  useEffect(() => {
    if (externalOpen && !internalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInternalOpen(true)
    }
  }, [externalOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Optimistically patch area/project refs on the task detail cache (task mode only)
  function patchRefs(
    areaId: string | null, areaTitle: string | null,
    projectId: string | null, projectTitle: string | null,
  ) {
    if (!task) return
    queryClient.setQueryData(
      queryKeys.tasks.detail(task.id),
      (old: TaskDetail | undefined) =>
        old
          ? {
              ...old,
              area_id: areaId,
              area: areaId && areaTitle ? { id: areaId, title: areaTitle } : null,
              area_name: areaTitle,
              project_id: projectId,
              project: projectId && projectTitle ? { id: projectId, title: projectTitle } : null,
              project_name: projectTitle,
            }
          : old,
    )
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        doClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelectProject(projectId: string, areaId: string) {
    if (isControlled) {
      onControlledChange!(areaId, projectId)
    } else {
      const areaTitle = areas?.find((a) => a.id === areaId)?.title ?? null
      const projectTitle = allProjects?.find((p) => p.id === projectId)?.title ?? null
      patchRefs(areaId, areaTitle, projectId, projectTitle)
      updateTask.mutate({ id: task!.id, data: { project_id: projectId, area_id: areaId } })
    }
    doClose()
    onSelect?.()
  }

  function handleSetAreaOnly(areaId: string) {
    if (isControlled) {
      onControlledChange!(areaId, null)
    } else {
      const areaTitle = areas?.find((a) => a.id === areaId)?.title ?? null
      patchRefs(areaId, areaTitle, null, null)
      updateTask.mutate({ id: task!.id, data: { area_id: areaId, project_id: null } })
    }
    doClose()
    onSelect?.()
  }

  function handleClear() {
    if (isControlled) {
      onControlledChange!(null, null)
    } else {
      patchRefs(null, null, null, null)
      updateTask.mutate({ id: task!.id, data: { area_id: null, project_id: null } })
    }
    doClose()
    onSelect?.()
  }

  // Build the display label
  let label: string
  if (isControlled) {
    const areaTitle = areas?.find((a) => a.id === controlledAreaId)?.title
    const projectTitle = allProjects?.find((p) => p.id === controlledProjectId)?.title
    label = projectTitle
      ? `${areaTitle ?? ''} › ${projectTitle}`
      : areaTitle ?? 'No area'
  } else {
    const areaLabel = task!.area?.title ?? task!.area_name
    const projectLabel = task!.project?.title ?? task!.project_name
    label = projectLabel
      ? `${areaLabel ?? ''} › ${projectLabel}`
      : areaLabel ?? 'No area'
  }

  const currentAreaId = isControlled ? controlledAreaId : task!.area_id
  const currentProjectId = isControlled ? controlledProjectId : task!.project_id

  // Build flat tree list: area, area/project1, area/project2, area2, ...
  // Group projects by area
  const projectsByArea = new Map<string, typeof allProjects>()
  allProjects?.forEach((p) => {
    const list = projectsByArea.get(p.area_id) ?? []
    list.push(p)
    projectsByArea.set(p.area_id, list)
  })

  // Build flat items list
  type FlatItem =
    | { type: 'area'; areaId: string; areaTitle: string }
    | { type: 'project'; areaId: string; areaTitle: string; projectId: string; projectTitle: string }

  const flatItems: FlatItem[] = []
  areas?.forEach((area) => {
    flatItems.push({ type: 'area', areaId: area.id, areaTitle: area.title })
    const areaProjects = projectsByArea.get(area.id) ?? []
    areaProjects.forEach((project) => {
      flatItems.push({
        type: 'project',
        areaId: area.id,
        areaTitle: area.title,
        projectId: project.id,
        projectTitle: project.title,
      })
    })
  })

  return (
    <div ref={ref} className="relative">
      {!hideTrigger && (
        <button
          onClick={() => open ? doClose() : doOpen()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
        >
          {currentProjectId ? <Package size={14} /> : <Blocks size={14} />}
          <span className={`max-w-[200px] truncate ${settings?.privacy_mode ? 'privacy-blur' : ''}`}>{label}</span>
        </button>
      )}

      {open && (
        <div className={`absolute left-0 z-10 w-72 rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-800 ${dropdownPosition === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          <Command className="flex flex-col" onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              doClose()
            }
          }}>
            <Command.Input
              autoFocus
              placeholder="Search areas & projects…"
              className="w-full border-b border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400 dark:border-neutral-700 dark:placeholder:text-neutral-500"
            />
            <Command.List className="max-h-60 overflow-y-auto py-1">
              <Command.Empty className="px-3 py-4 text-center text-sm text-neutral-500">
                No results found.
              </Command.Empty>

              {/* Clear option */}
              <Command.Item
                value="no area project clear"
                onSelect={handleClear}
                className="flex cursor-pointer items-center gap-2 rounded-lg mx-1 px-2 py-1.5 text-sm text-neutral-500 aria-selected:bg-neutral-100 dark:text-neutral-400 dark:aria-selected:bg-neutral-700"
              >
                <X size={14} className="shrink-0" />
                No area / project
                {!currentAreaId && !currentProjectId && (
                  <Check size={14} className="ml-auto shrink-0 text-red-500" />
                )}
              </Command.Item>

              {/* Flat tree: area, area / project1, area / project2, ... */}
              {flatItems.map((item) => {
                if (item.type === 'area') {
                  const isSelected = currentAreaId === item.areaId && !currentProjectId
                  return (
                    <Command.Item
                      key={`area-${item.areaId}`}
                      value={item.areaTitle}
                      onSelect={() => handleSetAreaOnly(item.areaId)}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg mx-1 px-2 py-1.5 text-sm aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-700 ${
                        isSelected
                          ? 'font-medium text-red-600 dark:text-red-400'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <Blocks size={14} className="shrink-0 text-neutral-400" />
                      <span className="truncate">{item.areaTitle}</span>
                      {isSelected && (
                        <Check size={14} className="ml-auto shrink-0 text-red-500" />
                      )}
                    </Command.Item>
                  )
                }

                const isSelected = currentProjectId === item.projectId
                return (
                  <Command.Item
                    key={`project-${item.projectId}`}
                    value={`${item.areaTitle} ${item.projectTitle}`}
                    onSelect={() => handleSelectProject(item.projectId, item.areaId)}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg mx-1 px-2 py-1.5 text-sm aria-selected:bg-neutral-100 dark:aria-selected:bg-neutral-700 ${
                      isSelected
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <Package size={14} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
                    <span className="truncate">
                      <span className="text-neutral-400 dark:text-neutral-500">{item.areaTitle}</span>
                      <span className="mx-1 text-neutral-300 dark:text-neutral-600">/</span>
                      {item.projectTitle}
                    </span>
                    {isSelected && (
                      <Check size={14} className="ml-auto shrink-0 text-red-500" />
                    )}
                  </Command.Item>
                )
              })}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  )
}
