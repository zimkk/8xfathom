'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CaptureToggleProps {
  meetingId: string
  captureOverride: string
  className?: string
}

export function CaptureToggle({ meetingId, captureOverride, className }: CaptureToggleProps) {
  const [isOn, setIsOn] = useState(captureOverride !== 'disabled')
  const [saving, setSaving] = useState(false)

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (saving) return

    const nextOn = !isOn
    setIsOn(nextOn)
    setSaving(true)
    try {
      await fetch(`/api/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captureOverride: nextOn ? 'enabled' : 'disabled' }),
      })
    } catch {
      setIsOn(!nextOn)
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={saving}
      className={cn('flex items-center gap-1.5 text-xs font-medium shrink-0', className)}
      title={isOn ? 'AI Notetaker will join this meeting' : 'AI Notetaker will not join this meeting'}
    >
      <span
        className={cn(
          'relative inline-flex h-4 w-7 items-center rounded-full transition-colors',
          isOn ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        <span
          className={cn(
            'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
            isOn ? 'translate-x-3.5' : 'translate-x-0.5'
          )}
        />
      </span>
      <span className={isOn ? 'text-foreground' : 'text-muted-foreground'}>
        {isOn ? 'On' : 'Off'}
      </span>
    </button>
  )
}
