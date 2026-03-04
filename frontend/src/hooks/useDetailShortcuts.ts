import { useHotkeys } from 'react-hotkeys-hook'

export interface DetailShortcutConfig {
  onFocusTitle?: () => void          // Alt+E — modal only
  onToggleTags?: () => void          // Alt+T
  onToggleArea?: () => void          // Alt+A
  onToggleWhen?: () => void          // Alt+W
  onToggleDeadline?: () => void      // Alt+D
  onToggleNotes?: () => void         // Alt+N
  onToggleChecklist?: () => void     // Alt+C — modal only
  onToggleReminder?: () => void      // Alt+R — modal only
  onToggleLink?: () => void          // Alt+U — modal only
  onToggleFile?: () => void          // Alt+F — modal only
  onTogglePriority?: () => void      // Alt+H
  enabled?: boolean
}

const FORM_TAGS = ['INPUT', 'TEXTAREA'] as const

/**
 * On macOS, Alt+key combos produce dead-key characters (e.g. Alt+N → ~,
 * Alt+D → ∂) that `e.preventDefault()` on `keydown` does NOT suppress.
 *
 * This helper listens for the next `input` event on the focused element,
 * and immediately restores the original value before React or the browser
 * can paint the dead-key character.
 */
function suppressNextDeadKey() {
  const el = document.activeElement
  if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
  const input = el as HTMLInputElement | HTMLTextAreaElement
  const savedValue = input.value
  const savedStart = input.selectionStart
  const savedEnd = input.selectionEnd

  const tag = el.tagName // capture for closure
  function onInput() {
    // Immediately restore value via native setter so the dead-key char
    // is undone before the browser paints
    const nativeSet = Object.getOwnPropertyDescriptor(
      tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set
    nativeSet?.call(input, savedValue)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.setSelectionRange(savedStart, savedEnd)
  }

  // Listen for the dead-key input event synchronously
  input.addEventListener('input', onInput, { once: true, capture: true })

  // Safety: remove listener if no input event fires within one frame
  // (e.g. non-macOS where no dead-key char is produced)
  requestAnimationFrame(() => {
    input.removeEventListener('input', onInput, true)
  })
}

/**
 * Shared Alt+key shortcuts for task detail fields.
 * Used by both TaskDetailModal and QuickEntry.
 */
export function useDetailShortcuts(config: DetailShortcutConfig) {
  const enabled = config.enabled ?? true

  useHotkeys('alt+e', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onFocusTitle?.()
  }, { enabled: enabled && !!config.onFocusTitle, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+t', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleTags?.()
  }, { enabled: enabled && !!config.onToggleTags, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+a', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleArea?.()
  }, { enabled: enabled && !!config.onToggleArea, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+w', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleWhen?.()
  }, { enabled: enabled && !!config.onToggleWhen, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+d', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleDeadline?.()
  }, { enabled: enabled && !!config.onToggleDeadline, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+n', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleNotes?.()
  }, { enabled: enabled && !!config.onToggleNotes, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+c', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleChecklist?.()
  }, { enabled: enabled && !!config.onToggleChecklist, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+r', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleReminder?.()
  }, { enabled: enabled && !!config.onToggleReminder, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+u', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleLink?.()
  }, { enabled: enabled && !!config.onToggleLink, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+f', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onToggleFile?.()
  }, { enabled: enabled && !!config.onToggleFile, enableOnFormTags: [...FORM_TAGS] })

  useHotkeys('alt+h', (e) => {
    e.preventDefault()
    suppressNextDeadKey()
    config.onTogglePriority?.()
  }, { enabled: enabled && !!config.onTogglePriority, enableOnFormTags: [...FORM_TAGS] })
}

/**
 * Detects `#` typed at end of input or after whitespace and triggers tag picker.
 * Call from onChange handler of a title input. Returns true if `#` was consumed.
 */
export function detectHashTrigger(
  value: string,
  cursorPos: number,
  onToggleTags: () => void,
  setTitle: (v: string) => void,
): boolean {
  const charAtCursor = value[cursorPos - 1]
  if (charAtCursor !== '#') return false

  // Strip the `#` and open tags
  const withoutHash = value.slice(0, cursorPos - 1) + value.slice(cursorPos)
  setTitle(withoutHash)
  onToggleTags()
  return true
}
