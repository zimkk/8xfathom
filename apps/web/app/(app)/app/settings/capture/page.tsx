'use client'

import { useEffect, useState } from 'react'

type CaptureMode = 'all' | 'external_only' | 'internal_only' | 'none'

interface Preferences {
  defaultMode: CaptureMode
  botDisplayName: string
}

const OPTIONS: Array<{ value: CaptureMode; label: string; description: string }> = [
  { value: 'all', label: 'Record all meetings', description: 'Automatically join every Google Meet meeting on your calendar' },
  { value: 'external_only', label: 'Record external meetings only', description: 'Only join meetings with attendees outside your organization' },
  { value: 'internal_only', label: 'Record internal meetings only', description: 'Only join meetings where every attendee is in your organization' },
  { value: 'none', label: 'Do not automatically record meetings', description: 'Add the notetaker manually for each meeting instead' },
]

export default function CaptureSettingsPage() {
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings/capture')
      .then((res) => res.json())
      .then((data) => setPrefs(data.preferences))
      .catch(() => setPrefs({ defaultMode: 'all', botDisplayName: 'AI Notetaker' }))
  }, [])

  async function handleSave() {
    if (!prefs) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/settings/capture', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (res.ok) setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (!prefs) {
    return <div className="text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Recording</h1>
      <p className="text-sm text-muted-foreground mb-8">Configure how Fathom 8x records your meetings.</p>

      <div className="space-y-4">
        <div className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Default capture behavior</h2>
          <div className="space-y-3">
            {OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="captureMode"
                  value={opt.value}
                  checked={prefs.defaultMode === opt.value}
                  onChange={() => setPrefs({ ...prefs, defaultMode: opt.value })}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium group-hover:text-primary">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
            You can still turn recording on or off for an individual meeting from the dashboard or calendar view.
          </p>
        </div>

        <div className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">AI Notetaker display name</h2>
          <input
            type="text"
            value={prefs.botDisplayName}
            onChange={(e) => setPrefs({ ...prefs, botDisplayName: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground mt-2">
            This name appears in the meeting participant list.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-green-600">Saved</span>}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
