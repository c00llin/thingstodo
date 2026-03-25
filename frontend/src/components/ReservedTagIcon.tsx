import { SiYuanIcon } from './SiYuanIcon'
import { ObsidianIcon } from './ObsidianIcon'
import { isSiYuanTag, isObsidianTag } from '../lib/reserved-tags'

interface ReservedTagIconProps {
  tagTitle: string
  size?: number
  className?: string
}

export function ReservedTagIcon({ tagTitle, size = 16, className }: ReservedTagIconProps) {
  if (isSiYuanTag(tagTitle)) {
    return <SiYuanIcon size={size} className={className} />
  }
  if (isObsidianTag(tagTitle)) {
    return <ObsidianIcon size={size} className={className} />
  }
  return null
}
