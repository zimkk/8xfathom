'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotesFailedBanner({ meetingId }: { meetingId: string }) {
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRetry() {
    setRetrying(true)
    setError(null)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/summary/retry`, { method: 'POST' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Failed to generate notes')
      }
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 text-sm border-b bg-amber-50 border-amber-100 text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="font-medium flex-1">
        {error ?? 'AI notes could not be generated.'}
      </span>
      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300" onClick={handleRetry} disabled={retrying}>
        {retrying ? 'Trying…' : 'Try Again'}
      </Button>
    </div>
  )
}
