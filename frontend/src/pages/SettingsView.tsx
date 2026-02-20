import { useState } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/queries'

function SettingsCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-300 accent-red-500 dark:border-neutral-600"
      />
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
    </label>
  )
}

function ReviewSetting({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  const enabled = value !== null
  const [draft, setDraft] = useState(String(value ?? 7))

  return (
    <div className="space-y-2">
      <SettingsCheckbox
        label="Review tasks after X days"
        checked={enabled}
        onChange={(checked) => {
          if (checked) {
            const days = parseInt(draft, 10)
            onChange(days > 0 ? days : 7)
          } else {
            onChange(null)
          }
        }}
      />
      {enabled && (
        <div className="ml-7 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const days = parseInt(draft, 10)
              if (days > 0) {
                onChange(days)
              } else {
                setDraft(String(value ?? 7))
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            className="w-16 rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
          />
          <span className="text-sm text-neutral-500 dark:text-neutral-400">days</span>
        </div>
      )}
    </div>
  )
}

export function SettingsView() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()

  if (!settings) return null

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Settings</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Sound
        </h2>
        <SettingsCheckbox
          label="Play sounds"
          checked={settings.play_complete_sound}
          onChange={(v) => updateSettings.mutate({ play_complete_sound: v })}
        />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Review
        </h2>
        <ReviewSetting
          value={settings.review_after_days}
          onChange={(v) => updateSettings.mutate({ review_after_days: v })}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Show task count for
        </h2>
        <div className="space-y-1">
          <SettingsCheckbox
            label="Main lists"
            checked={settings.show_count_main}
            onChange={(v) => updateSettings.mutate({ show_count_main: v })}
          />
          <SettingsCheckbox
            label="Areas & Projects"
            checked={settings.show_count_projects}
            onChange={(v) => updateSettings.mutate({ show_count_projects: v })}
          />
          <SettingsCheckbox
            label="Tags"
            checked={settings.show_count_tags}
            onChange={(v) => updateSettings.mutate({ show_count_tags: v })}
          />
        </div>
      </section>
    </div>
  )
}
