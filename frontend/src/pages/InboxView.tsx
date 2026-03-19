import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocalInbox } from '../hooks/localQueries'
import { useSettings } from '../hooks/queries'
import { SortableTaskList } from '../components/SortableTaskList'
import { TaskItem } from '../components/TaskItem'
import { useAppStore } from '../stores/app'

export function InboxView() {
  const { data: settings } = useSettings()
  const data = useLocalInbox(settings?.review_after_days)
  const isLoading = data === undefined
  const hasTasks = (data?.tasks.length ?? 0) > 0
  const hasReview = (data?.review.length ?? 0) > 0
  const selectionSection = useAppStore((s) => s.selectionSection)
  const crossSectionBlocked = useAppStore((s) => s.crossSectionBlocked)
  const setCrossSectionBlocked = useAppStore((s) => s.setCrossSectionBlocked)

  // Auto-clear the blocked indicator after animation
  useEffect(() => {
    if (!crossSectionBlocked) return
    const timer = setTimeout(() => setCrossSectionBlocked(false), 600)
    return () => clearTimeout(timer)
  }, [crossSectionBlocked, setCrossSectionBlocked])

  const shakeKeyframes = [0, -4, 4, -4, 4, 0]

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-48 md:px-6 md:pt-6">
      <h2 className="mb-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Inbox</h2>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-neutral-400">Loading...</p>
      ) : !hasTasks && !hasReview ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Your inbox is empty.
        </p>
      ) : (
        <>
          {hasTasks && (
            <motion.div
              className={hasReview ? 'pr-[36px]' : ''}
              animate={{ x: crossSectionBlocked && selectionSection === 'review' ? shakeKeyframes : 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <SortableTaskList
                tasks={data?.tasks ?? []}
                sortField="sort_order_today"
                showProject={false}
                taskSection="inbox"
              />
            </motion.div>
          )}
          {hasReview && (
            <motion.div
              className="mt-6"
              animate={{ x: crossSectionBlocked && selectionSection === 'inbox' ? shakeKeyframes : 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Review
              </h3>
              <AnimatePresence initial={false}>
                {data!.review.map((task) => (
                  <TaskItem key={task.id} task={task} showProject showReviewCheckbox showDivider taskSection="review" />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
