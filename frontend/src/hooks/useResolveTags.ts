import { useCallback } from 'react'
import { useTags, useCreateTag, useProjects, useAreas } from './queries'
import { parseTitleTokens } from '../lib/parse-tags'
import { isSiYuanTag } from '../lib/siyuan'

/**
 * Returns a function that parses #tags and $project/area from input text,
 * resolves them to IDs (creating new tags as needed),
 * and returns the clean title + tag IDs + project/area IDs.
 */
export function useResolveTags() {
  const { data: tagsData } = useTags()
  const { data: projectsData } = useProjects()
  const { data: areasData } = useAreas()
  const createTag = useCreateTag()

  const resolve = useCallback(
    async (input: string): Promise<{
      title: string
      tagIds: string[]
      projectId: string | null
      areaId: string | null
    }> => {
      const projects = projectsData?.projects ?? []
      const areas = areasData?.areas ?? []
      const knownNames = [
        ...projects.map((p) => p.title),
        ...areas.map((a) => a.title),
      ]

      const { title, tagNames, projectRef } = parseTitleTokens(input, knownNames)

      // Resolve tags
      const existingTags = tagsData?.tags ?? []
      const ids: string[] = []
      for (const name of tagNames) {
        if (isSiYuanTag(name)) continue
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
    [tagsData, projectsData, areasData, createTag],
  )

  return resolve
}
