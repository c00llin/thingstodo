import { useCallback } from 'react'
import { useCreateTag } from './queries'
import { useLocalTags, useLocalProjects, useLocalAreas } from './localQueries'
import { parseTitleTokens } from '../lib/parse-tags'
import { isReservedTag } from '../lib/reserved-tags'

/**
 * Returns a function that parses #tags and $project/area from input text,
 * resolves them to IDs (creating new tags as needed),
 * and returns the clean title + tag IDs + project/area IDs.
 */
export function useResolveTags() {
  const tagsArr = useLocalTags()
  const projectsArr = useLocalProjects()
  const areasArr = useLocalAreas()
  const createTag = useCreateTag()

  const resolve = useCallback(
    async (input: string): Promise<{
      title: string
      tagIds: string[]
      projectId: string | null
      areaId: string | null
    }> => {
      const projects = projectsArr ?? []
      const areas = areasArr ?? []
      const knownNames = [
        ...projects.map((p) => p.title),
        ...areas.map((a) => a.title),
      ]

      const { title, tagNames, projectRef } = parseTitleTokens(input, knownNames)

      // Resolve tags
      const existingTags = tagsArr ?? []
      const ids: string[] = []
      for (const name of tagNames) {
        if (isReservedTag(name)) continue
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

      // Resolve project/area ref
      let projectId: string | null = null
      let areaId: string | null = null

      if (projectRef) {
        const matchedProject = projects.find(
          (p) => p.title.toLowerCase() === projectRef.toLowerCase(),
        )
        if (matchedProject) {
          projectId = matchedProject.id
          areaId = matchedProject.area_id ?? null
        } else {
          const matchedArea = areas.find(
            (a) => a.title.toLowerCase() === projectRef.toLowerCase(),
          )
          if (matchedArea) {
            areaId = matchedArea.id
          }
          // No else needed — if no match, parseTitleTokens already left the $ as literal
        }
      }

      return { title, tagIds: ids, projectId, areaId }
    },
    [tagsArr, projectsArr, areasArr, createTag],
  )

  return resolve
}
