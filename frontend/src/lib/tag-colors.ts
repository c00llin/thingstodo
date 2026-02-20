export const TAG_COLORS = [
  { name: 'red', value: 'red', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', icon: 'text-red-500', dot: 'bg-red-500', drop: '[&_a]:!bg-red-100 [&_a]:!text-red-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-red-300 [&_a_svg]:!text-red-500 dark:[&_a]:!bg-red-900/40 dark:[&_a]:!text-red-400 dark:[&_a]:!ring-red-700 dark:[&_a_svg]:!text-red-400' },
  { name: 'orange', value: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', icon: 'text-orange-500', dot: 'bg-orange-500', drop: '[&_a]:!bg-orange-100 [&_a]:!text-orange-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-orange-300 [&_a_svg]:!text-orange-500 dark:[&_a]:!bg-orange-900/40 dark:[&_a]:!text-orange-400 dark:[&_a]:!ring-orange-700 dark:[&_a_svg]:!text-orange-400' },
  { name: 'yellow', value: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', icon: 'text-yellow-500', dot: 'bg-yellow-500', drop: '[&_a]:!bg-yellow-100 [&_a]:!text-yellow-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-yellow-300 [&_a_svg]:!text-yellow-500 dark:[&_a]:!bg-yellow-900/40 dark:[&_a]:!text-yellow-400 dark:[&_a]:!ring-yellow-700 dark:[&_a_svg]:!text-yellow-400' },
  { name: 'green', value: 'green', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', icon: 'text-green-500', dot: 'bg-green-500', drop: '[&_a]:!bg-green-100 [&_a]:!text-green-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-green-300 [&_a_svg]:!text-green-500 dark:[&_a]:!bg-green-900/40 dark:[&_a]:!text-green-400 dark:[&_a]:!ring-green-700 dark:[&_a_svg]:!text-green-400' },
  { name: 'teal', value: 'teal', bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300', icon: 'text-teal-500', dot: 'bg-teal-500', drop: '[&_a]:!bg-teal-100 [&_a]:!text-teal-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-teal-300 [&_a_svg]:!text-teal-500 dark:[&_a]:!bg-teal-900/40 dark:[&_a]:!text-teal-400 dark:[&_a]:!ring-teal-700 dark:[&_a_svg]:!text-teal-400' },
  { name: 'blue', value: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-500', dot: 'bg-blue-500', drop: '[&_a]:!bg-blue-100 [&_a]:!text-blue-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-blue-300 [&_a_svg]:!text-blue-500 dark:[&_a]:!bg-blue-900/40 dark:[&_a]:!text-blue-400 dark:[&_a]:!ring-blue-700 dark:[&_a_svg]:!text-blue-400' },
  { name: 'purple', value: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', icon: 'text-purple-500', dot: 'bg-purple-500', drop: '[&_a]:!bg-purple-100 [&_a]:!text-purple-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-purple-300 [&_a_svg]:!text-purple-500 dark:[&_a]:!bg-purple-900/40 dark:[&_a]:!text-purple-400 dark:[&_a]:!ring-purple-700 dark:[&_a_svg]:!text-purple-400' },
  { name: 'pink', value: 'pink', bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', icon: 'text-pink-500', dot: 'bg-pink-500', drop: '[&_a]:!bg-pink-100 [&_a]:!text-pink-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-pink-300 [&_a_svg]:!text-pink-500 dark:[&_a]:!bg-pink-900/40 dark:[&_a]:!text-pink-400 dark:[&_a]:!ring-pink-700 dark:[&_a_svg]:!text-pink-400' },
] as const

export const DEFAULT_DROP_CLASSES = '[&_a]:!bg-red-100 [&_a]:!text-red-700 [&_a]:!ring-2 [&_a]:!ring-inset [&_a]:!ring-red-300 [&_a_svg]:!text-red-500 dark:[&_a]:!bg-red-900/40 dark:[&_a]:!text-red-400 dark:[&_a]:!ring-red-700 dark:[&_a_svg]:!text-red-400'

const colorMap = new Map<string, typeof TAG_COLORS[number]>(TAG_COLORS.map((c) => [c.value, c]))

export function getTagColor(color: string | null | undefined) {
  if (!color) return null
  return colorMap.get(color) ?? null
}

export function getTagPillClasses(color: string | null | undefined) {
  const c = getTagColor(color)
  if (!c) return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
  return `${c.bg} ${c.text}`
}

export function getTagIconClass(color: string | null | undefined) {
  const c = getTagColor(color)
  if (!c) return ''
  return c.icon
}

export function getTagDropClasses(color: string | null | undefined) {
  const c = getTagColor(color)
  if (!c) return DEFAULT_DROP_CLASSES
  return c.drop
}
