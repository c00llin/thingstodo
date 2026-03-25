import type { Attachment } from '../api/types'

const RESERVED_TAGS = ['siyuan', 'obsidian'] as const
const RESERVED_ANCHORS = ['siyuan', 'obsidian'] as const

export type ReservedTagName = (typeof RESERVED_TAGS)[number]

// --- Tag helpers ---

export function isReservedTag(title: string): boolean {
  return RESERVED_TAGS.includes(title.toLowerCase() as ReservedTagName)
}

export function isSiYuanTag(title: string): boolean {
  return title.toLowerCase() === 'siyuan'
}

export function isObsidianTag(title: string): boolean {
  return title.toLowerCase() === 'obsidian'
}

// --- Link/anchor helpers ---

export function isReservedAnchor(title: string): boolean {
  return RESERVED_ANCHORS.includes(title.toLowerCase() as ReservedTagName)
}

export function isReservedLink(att: Attachment): boolean {
  return att.type === 'link' && isReservedAnchor(att.title)
}

export function hasReservedLink(attachments: Attachment[]): boolean {
  return attachments.some(isReservedLink)
}

// Legacy re-exports for backwards compat during migration
export const SIYUAN_TAG = 'siyuan' as const
export function isSiYuanLink(att: Attachment): boolean {
  return att.type === 'link' && att.title.toLowerCase() === 'siyuan'
}
export function hasSiYuanLink(attachments: Attachment[]): boolean {
  return attachments.some(isSiYuanLink)
}
