import type { Attachment } from '../api/types'

const SIYUAN_ANCHOR = 'siyuan'

export const SIYUAN_TAG = 'siyuan'

export function isSiYuanTag(title: string): boolean {
  return title.toLowerCase() === SIYUAN_TAG
}

export function isSiYuanLink(att: Attachment): boolean {
  return att.type === 'link' && att.title.toLowerCase() === SIYUAN_ANCHOR
}

export function hasSiYuanLink(attachments: Attachment[]): boolean {
  return attachments.some(isSiYuanLink)
}

export function isReservedAnchor(title: string): boolean {
  return title.toLowerCase() === SIYUAN_ANCHOR
}
