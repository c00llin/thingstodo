import { api } from './client'
import type {
  Attachment,
  CreateLinkAttachmentRequest,
  UpdateAttachmentRequest,
} from './types'

const BASE_URL = '/api'

export function listAttachments(taskId: string) {
  return api.get<{ attachments: Attachment[] }>(`/tasks/${taskId}/attachments`)
}

export async function uploadFile(taskId: string, file: File): Promise<Attachment> {
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(`${BASE_URL}/tasks/${taskId}/attachments`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || res.statusText)
  }

  return res.json()
}

export function addLink(taskId: string, data: CreateLinkAttachmentRequest) {
  return api.post<Attachment>(`/tasks/${taskId}/attachments`, data)
}

export function updateAttachment(id: string, data: UpdateAttachmentRequest) {
  return api.patch<Attachment>(`/attachments/${id}`, data)
}

export function deleteAttachment(id: string) {
  return api.delete<void>(`/attachments/${id}`)
}

export function getFileUrl(id: string) {
  return `${BASE_URL}/attachments/${id}/file`
}
