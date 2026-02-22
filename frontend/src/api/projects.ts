import { api } from './client'
import type {
  Project,
  ProjectDetail,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectStatus,
  SimpleReorderItem,
} from './types'

export function listProjects(params?: { area_id?: string; status?: ProjectStatus }) {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, value)
    }
  }
  const qs = search.toString()
  return api.get<{ projects: Project[] }>(`/projects${qs ? `?${qs}` : ''}`)
}

export function getProject(id: string) {
  return api.get<ProjectDetail>(`/projects/${id}`)
}

export function createProject(data: CreateProjectRequest) {
  return api.post<Project>('/projects', data)
}

export function updateProject(id: string, data: UpdateProjectRequest) {
  return api.patch<Project>(`/projects/${id}`, data)
}

export function deleteProject(id: string) {
  return api.delete<void>(`/projects/${id}`)
}

export function completeProject(id: string) {
  return api.patch<Project>(`/projects/${id}/complete`, {})
}

export function reorderProjects(items: SimpleReorderItem[]) {
  return api.patch<{ ok: boolean }>('/projects/reorder', { items })
}
