import { useState, useEffect } from 'react'
import { useSettings, useUpdateSettings } from '../hooks/queries'
import { parseTime } from '../lib/time-parser'
import { formatTime } from '../lib/format-time'
import { registerPushSubscription, unregisterPushSubscription, isPushSubscribed } from '../lib/push-registration'
import { testNotification } from '../api/push'
import type { UserSettings } from '../api/types'

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
  const [tab, setTab] = useState<'general' | 'notifications'>('general')

  if (!settings) return null

  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      active
        ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100'
        : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300'
    }`

  return (
    <div className="mx-auto max-w-3xl px-4 pt-14 pb-48 md:px-6 md:pt-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900 dark:text-neutral-100">Settings</h1>

      <div className="mb-6 flex gap-1">
        <button type="button" className={tabClass(tab === 'general')} onClick={() => setTab('general')}>General</button>
        <button type="button" className={tabClass(tab === 'notifications')} onClick={() => setTab('notifications')}>Notifications</button>
      </div>

      {tab === 'general' && (
        <GeneralSettings settings={settings} updateSettings={updateSettings} />
      )}

      {tab === 'notifications' && (
        <NotificationSettings settings={settings} updateSettings={updateSettings} />
      )}

      <p className="mt-12 text-center text-xs text-neutral-400 dark:text-neutral-500">
        ThingsToDo v{__APP_VERSION__}{__BUILD_SHA__ !== 'dev' ? ` (${__BUILD_SHA__})` : ''}
      </p>
    </div>
  )
}

function GeneralSettings({ settings, updateSettings }: { settings: UserSettings; updateSettings: ReturnType<typeof useUpdateSettings> }) {
  return (
    <>
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

      <div className="mb-8 border-b border-neutral-200 dark:border-neutral-700" />
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Review
        </h2>
        <ReviewSetting
          value={settings.review_after_days}
          onChange={(v) => updateSettings.mutate({ review_after_days: v })}
        />
      </section>

      <div className="mb-8 border-b border-neutral-200 dark:border-neutral-700" />
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

      <div className="mb-8 border-b border-neutral-200 dark:border-neutral-700" />
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Appearance
        </h2>
        <div className="flex items-center gap-3 py-1.5">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">Font size</span>
          <input
            type="range"
            min={14}
            max={18}
            step={1}
            defaultValue={settings.font_size}
            onMouseUp={(e) => updateSettings.mutate({ font_size: Number(e.currentTarget.value) })}
            onTouchEnd={(e) => updateSettings.mutate({ font_size: Number(e.currentTarget.value) })}
            className="w-32 accent-red-500"
          />
          <span className="w-10 text-sm text-neutral-500 dark:text-neutral-400">{settings.font_size}px</span>
        </div>
      </section>

      <div className="mb-8 border-b border-neutral-200 dark:border-neutral-700" />
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
    </>
  )
}

function NotificationSettings({ settings, updateSettings }: { settings: UserSettings; updateSettings: ReturnType<typeof useUpdateSettings> }) {
  const [subscribed, setSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const webPushSupported = 'PushManager' in window && 'serviceWorker' in navigator
  const provider = settings.notification_provider ?? 'webpush'

  useEffect(() => {
    isPushSubscribed().then((v) => { setSubscribed(v); setPushLoading(false) })
  }, [])

  async function handleProviderChange(value: 'webpush' | 'ntfy' | 'none') {
    setError(null)
    if (provider === 'webpush' && value !== 'webpush' && subscribed) {
      await unregisterPushSubscription()
      setSubscribed(false)
    }
    updateSettings.mutate({ notification_provider: value })
  }

  async function handleWebPushToggle(enable: boolean) {
    setPushLoading(true)
    setError(null)
    if (enable) {
      const result = await registerPushSubscription()
      setSubscribed(result.ok)
      if (!result.ok && result.error) setError(result.error)
    } else {
      await unregisterPushSubscription()
      setSubscribed(false)
    }
    setPushLoading(false)
  }

  async function handleTest() {
    setTestStatus('sending')
    try {
      await testNotification()
      setTestStatus('ok')
      setTimeout(() => setTestStatus('idle'), 3000)
    } catch {
      setTestStatus('error')
      setTimeout(() => setTestStatus('idle'), 3000)
    }
  }

  const radioClass = "h-4 w-4 accent-red-500"
  const labelClass = "flex cursor-pointer items-center gap-3 py-1.5 text-sm text-neutral-700 dark:text-neutral-300"
  const inputClass = "w-full rounded border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Reminders
        </h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-neutral-700 dark:text-neutral-300">Default reminder for new tasks</label>
            <div className="flex items-center gap-2">
              <select
                value={settings.default_reminder_type ?? ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    updateSettings.mutate({ default_reminder_type: null, default_reminder_value: 0 })
                  } else {
                    updateSettings.mutate({ default_reminder_type: val as UserSettings['default_reminder_type'], default_reminder_value: settings.default_reminder_value || 15 })
                  }
                }}
                className="rounded border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <option value="">None</option>
                <option value="at_start">At start of time block</option>
                <option value="on_day">On day of time block</option>
                <option value="minutes_before">Minutes before</option>
                <option value="hours_before">Hours before</option>
                <option value="days_before">Days before</option>
              </select>
              {(settings.default_reminder_type === 'minutes_before' || settings.default_reminder_type === 'hours_before' || settings.default_reminder_type === 'days_before') && (
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={settings.default_reminder_value}
                  onChange={(e) => updateSettings.mutate({ default_reminder_value: Math.min(99, Math.max(0, Number(e.target.value))) })}
                  className="w-16 rounded border border-neutral-200 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200"
                />
              )}
            </div>
          </div>
          <SettingsCheckbox
            label="Copy reminders to recurring task instances"
            checked={settings.copy_reminders_to_recurring}
            onChange={(v) => updateSettings.mutate({ copy_reminders_to_recurring: v })}
          />
        </div>
      </section>

      <div className="border-b border-neutral-200 dark:border-neutral-700" />
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          Delivery
        </h2>
        <div className="space-y-3">
      <div className="space-y-1">
        <label className={labelClass}>
          <input type="radio" name="notif-provider" className={radioClass} checked={provider === 'webpush'} onChange={() => handleProviderChange('webpush')} />
          Browser Push
        </label>
        <label className={labelClass}>
          <input type="radio" name="notif-provider" className={radioClass} checked={provider === 'ntfy'} onChange={() => handleProviderChange('ntfy')} />
          ntfy
        </label>
        <label className={labelClass}>
          <input type="radio" name="notif-provider" className={radioClass} checked={provider === 'none'} onChange={() => handleProviderChange('none')} />
          Disabled
        </label>
      </div>

      {provider === 'webpush' && (
        <div className="pl-7">
          {webPushSupported ? (
            <label className="flex cursor-pointer items-center gap-3 py-1.5">
              <input
                type="checkbox"
                checked={subscribed}
                disabled={pushLoading}
                onChange={(e) => handleWebPushToggle(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 accent-red-500 dark:border-neutral-600"
              />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">
                Subscribe this browser{pushLoading ? '...' : ''}
              </span>
            </label>
          ) : (
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              Push notifications not supported in this browser
            </p>
          )}
        </div>
      )}

      {provider === 'ntfy' && (
        <div className="space-y-2 pl-7">
          <div>
            <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Server URL</label>
            <input
              type="text"
              className={inputClass}
              defaultValue={settings.ntfy_server_url}
              placeholder="https://ntfy.sh"
              onBlur={(e) => updateSettings.mutate({ ntfy_server_url: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Topic</label>
            <input
              type="text"
              className={inputClass}
              defaultValue={settings.ntfy_topic}
              placeholder="thingstodo"
              onBlur={(e) => updateSettings.mutate({ ntfy_topic: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Access Token (optional)</label>
            <input
              type="password"
              className={inputClass}
              defaultValue={settings.ntfy_access_token}
              placeholder="tk_..."
              onBlur={(e) => updateSettings.mutate({ ntfy_access_token: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Base URL (for click-through links)</label>
            <input
              type="text"
              className={inputClass}
              defaultValue={settings.base_url}
              placeholder="https://tasks.example.com"
              onBlur={(e) => updateSettings.mutate({ base_url: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={testStatus === 'sending' || !settings.ntfy_topic}
            className="mt-1 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600 disabled:opacity-50"
          >
            {testStatus === 'sending' ? 'Sending...' : testStatus === 'ok' ? 'Sent!' : testStatus === 'error' ? 'Failed' : 'Send Test'}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}
        </div>
      </section>
    </div>
  )
}
