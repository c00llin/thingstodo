/**
 * Parse #tag tokens from a task title input string.
 * Supports alphanumeric tags with hyphens: #shopping, #to-do
 */
export function parseTitleAndTags(input: string): { title: string; tagNames: string[] } {
  const tagPattern = /#([\w-]+)/g
  const tagNames: string[] = []
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(input)) !== null) {
    tagNames.push(match[1])
  }

  const title = input.replace(tagPattern, '').replace(/\s{2,}/g, ' ').trim()

  return { title, tagNames }
}
