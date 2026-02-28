import { useState } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/queries'
import { parseTime } from '../lib/time-parser'
import { formatTime } from '../lib/format-time'

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
      <label className="flex cursor-pointer items-center gap-3 py-1.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            if (e.target.checked) {
              const days = parseInt(draft, 10)
              onChange(days > 0 ? days : 7)
            } else {
              onChange(null)
            }
          }}
          className="h-4 w-4 rounded border-neutral-300 accent-red-500 dark:border-neutral-600"
        />
        <span className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
          Review tasks after
          {enabled && (
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
              onClick={(e) => e.stopPropagation()}
              className="w-12 rounded border border-neutral-300 bg-transparent px-1.5 py-0.5 text-center text-sm text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
            />
          )}
          days
        </span>
      </label>
    </div>
  )
}

function EveningTimeSetting({
  value,
  timeFormat,
  onChange,
}: {
  value: string
  timeFormat: '12h' | '24h'
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? formatTime(value, timeFormat)

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">Evening starts at</span>
      <input
        type="text"
        value={display}
        onFocus={(e) => setDraft(e.currentTarget.value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== null) {
            const parsed = parseTime(draft)
            if (parsed) {
              onChange(parsed)
            }
          }
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-20 rounded border border-neutral-300 bg-transparent px-2 py-1 text-center text-sm text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
      />
    </div>
  )
}

function TimeGapSetting({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">Default time duration</span>
      <input
        type="number"
        min={10}
        max={480}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const mins = parseInt(draft, 10)
          if (mins >= 10 && mins <= 480) {
            onChange(mins)
          } else {
            setDraft(String(value))
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-16 rounded border border-neutral-300 bg-transparent px-2 py-1 text-center text-sm text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
      />
      <span className="text-sm text-neutral-400">min</span>
    </div>
  )
}

export function SettingsView() {
  const { data: settings } = useSettings()
  const updateSettings = useUpdateSettings()

  if (!settings) return null

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-4 md:p-6">
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

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Scheduling
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 py-1.5">
            <span className="text-sm text-neutral-700 dark:text-neutral-300">Time format</span>
            <select
              value={settings.time_format}
              onChange={(e) => updateSettings.mutate({ time_format: e.target.value as '12h' | '24h' })}
              className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
            >
              <option value="12h">12-hour</option>
              <option value="24h">24-hour</option>
            </select>
          </div>
          <EveningTimeSetting
            value={settings.evening_starts_at}
            timeFormat={settings.time_format}
            onChange={(v) => updateSettings.mutate({ evening_starts_at: v })}
          />
          <TimeGapSetting
            value={settings.default_time_gap}
            onChange={(v) => updateSettings.mutate({ default_time_gap: v })}
          />
          <SettingsCheckbox
            label="Show time in task lists"
            checked={settings.show_time_badge}
            onChange={(v) => updateSettings.mutate({ show_time_badge: v })}
          />
        </div>
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

      <p className="mt-12 text-center text-xs text-neutral-400 dark:text-neutral-500">
        ThingsToDo v{__APP_VERSION__}{__BUILD_SHA__ !== 'dev' ? ` (${__BUILD_SHA__})` : ''}
      </p>
    </div>
  )
}
