'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ShareDialogProps {
  meetingId: string
}

export function ShareDialog({ meetingId }: ShareDialogProps) {
  const [isPublic, setIsPublic] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleTogglePublic(next: boolean) {
    setIsPublic(next)
    if (!next) {
      setShareUrl(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/meetings/${meetingId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'meeting', allowTranscript: true, allowSummary: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setShareUrl(data.url)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Share this meeting</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium">
                {isPublic ? 'Anyone with the link' : 'Private'}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPublic
                  ? 'Anyone with the link can view this meeting'
                  : 'Only you can see this meeting'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => handleTogglePublic(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>

          {isPublic && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={loading ? 'Generating link…' : shareUrl ?? ''}
                className="flex-1 border rounded-lg px-3 py-2 text-xs bg-muted/30 truncate"
              />
              <Button size="sm" variant="outline" onClick={handleCopy} disabled={!shareUrl}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
