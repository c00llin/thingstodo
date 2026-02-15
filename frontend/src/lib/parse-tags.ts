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

/**
 * Parse #tag tokens and the first $project/area token from a task title.
 * Only the first $token is treated as a project/area reference;
 * subsequent $ are left as literal text.
 *
 * Because project/area names can contain spaces, the caller must provide
 * the list of known names so we can match the longest one after the first $.
 */
export function parseTitleTokens(input: string, knownNames: string[]): {
  title: string
  tagNames: string[]
  projectRef: string | null
} {
  const tagPattern = /#([\w-]+)/g
  const tagNames: string[] = []
  let match: RegExpExecArray | null

  while ((match = tagPattern.exec(input)) !== null) {
    tagNames.push(match[1])
  }

  // Find the first $ and try to match a known name after it (longest match wins)
  let projectRef: string | null = null
  let dollarMatchStart = -1

  const dollarIdx = input.indexOf('$')
  if (dollarIdx !== -1) {
    const afterDollar = input.slice(dollarIdx + 1)
    // Sort by length descending so we match the longest name first
    const sorted = [...knownNames].sort((a, b) => b.length - a.length)
    for (const name of sorted) {
      if (afterDollar.toLowerCase().startsWith(name.toLowerCase())) {
        projectRef = name
        dollarMatchStart = dollarIdx
        break
      }
    }
  }

  // Strip all #tags and the matched $token from the title
  let title = input.replace(tagPattern, '')
  if (dollarMatchStart !== -1) {
    // Recalculate position in tag-stripped string
    const strippedDollarIdx = title.indexOf('$')
    if (strippedDollarIdx !== -1) {
      const afterDollar = title.slice(strippedDollarIdx + 1)
      if (projectRef && afterDollar.toLowerCase().startsWith(projectRef.toLowerCase())) {
        title = title.slice(0, strippedDollarIdx) + title.slice(strippedDollarIdx + 1 + projectRef.length)
      }
    }
  }
  title = title.replace(/\s{2,}/g, ' ').trim()

  return { title, tagNames, projectRef }
}
