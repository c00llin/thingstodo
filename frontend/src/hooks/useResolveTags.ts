import { useCallback } from 'react'
import { useTags, useCreateTag } from './queries'
import { parseTitleAndTags } from '../lib/parse-tags'

/**
 * Returns a function that parses #tags from input text,
 * resolves them to IDs (creating new tags as needed),
 * and returns the clean title + tag IDs.
 */
export function useResolveTags() {
  const { data: tagsData } = useTags()
  const createTag = useCreateTag()

  const resolve = useCallback(
    async (input: string): Promise<{ title: string; tagIds: string[] }> => {
      const { title, tagNames } = parseTitleAndTags(input)
      if (tagNames.length === 0) return { title, tagIds: [] }

      const existingTags = tagsData?.tags ?? []
      const ids: string[] = []
      for (const name of tagNames) {
        const existing = existingTags.find(
          (t) => t.title.toLowerCase() === name.toLowerCase(),
        )
        if (existing) {
          ids.push(existing.id)
        } else {
          const created = await createTag.mutateAsync({ title: name })
          ids.push(created.id)
        }
      }
      return { title, tagIds: ids }
    },
    [tagsData, createTag],
  )

  return resolve
}
