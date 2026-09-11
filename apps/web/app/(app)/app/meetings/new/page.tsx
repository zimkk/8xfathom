'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { validateGoogleMeetUrl } from '@fathom/core'
import { ArrowLeft, Mic } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  title: z.string().min(1),
  meetingUrl: z.string().refine(validateGoogleMeetUrl, 'Must be a valid Google Meet URL'),
  startsAt: z.string().optional(),
})

export default function NewMeetingPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)

  function validateUrl(url: string) {
    if (url && !validateGoogleMeetUrl(url)) {
      setUrlError('Must be a valid Google Meet URL (e.g. meet.google.com/abc-def-ghi)')
    } else {
      setUrlError(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const parsed = schema.safeParse({ title, meetingUrl, startsAt: startsAt || undefined })
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Invalid form')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          meetingUrl,
          startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
          immediate: !startsAt,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create meeting')
        return
      }

      const data = await res.json()
      router.push(`/app/meetings/${data.meeting.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Link
        href="/app/calendar"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Calendar
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Add Notetaker</h1>
          <p className="text-xs text-muted-foreground">Send Fathom to take notes in a Google Meet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">Meeting name</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly Team Sync"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meetingUrl">Google Meet URL</Label>
          <Input
            id="meetingUrl"
            value={meetingUrl}
            onChange={(e) => { setMeetingUrl(e.target.value); validateUrl(e.target.value) }}
            placeholder="https://meet.google.com/abc-def-ghi"
            required
          />
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startsAt">
            Scheduled time <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to send the notetaker immediately.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !!urlError}
          className="w-full bg-primary text-white font-medium py-2.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Adding…' : startsAt ? 'Schedule Notetaker' : 'Add Notetaker Now'}
        </button>
      </form>
    </div>
  )
}
