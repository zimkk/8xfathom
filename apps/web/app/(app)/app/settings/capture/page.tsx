import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function CaptureSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Capture Settings</h1>
      <p className="text-sm text-muted-foreground mb-8">Configure how Fathom records your meetings.</p>

      <div className="space-y-4">
        <div className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Default capture behavior</h2>
          <div className="space-y-3">
            {[
              { value: 'all', label: 'All meetings', description: 'Automatically join all Google Meet meetings' },
              { value: 'internal', label: 'Internal only', description: 'Only meetings with your organization' },
              { value: 'manual', label: 'Manual only', description: 'Only join when you click "Record"' },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="captureMode"
                  value={opt.value}
                  defaultChecked={opt.value === 'all'}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium group-hover:text-primary">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Bot display name</h2>
          <input
            type="text"
            defaultValue="Fathom Notetaker"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-xs text-muted-foreground mt-2">
            This name appears in the meeting participant list.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  )
}
