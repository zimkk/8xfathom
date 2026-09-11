'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Radio, Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MEETING_STATUS_LABELS } from '@fathom/core'

interface StatusResponse {
  id: string
  status: string
  elapsedMs: number
  participantCount: number
  transcriptStatus: string
  canStop: boolean
  canHighlight: boolean
}

interface MeetingStatusBannerProps {
  status: string
  meetingId: string
}

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function MeetingStatusBanner({ status: initialStatus, meetingId }: MeetingStatusBannerProps) {
  const isRecording = initialStatus === 'recording'
  const isNonTerminal = !['ready', 'denied', 'failed', 'cancelled'].includes(initialStatus)

  const { data } = useQuery<StatusResponse>({
    queryKey: ['meeting-status', meetingId],
    queryFn: async () => {
      const res = await fetch(`/api/meetings/${meetingId}/status`)
      if (!res.ok) throw new Error('Failed to fetch status')
      return res.json()
    },
    refetchInterval: isNonTerminal ? 3000 : false,
    enabled: isNonTerminal,
  })

  const currentStatus = data?.status ?? initialStatus
  const label = MEETING_STATUS_LABELS[currentStatus as keyof typeof MEETING_STATUS_LABELS] ?? currentStatus

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 text-sm border-b',
        currentStatus === 'recording'
          ? 'bg-red-50 border-red-100 text-red-800'
          : 'bg-amber-50 border-amber-100 text-amber-800'
      )}
    >
      {currentStatus === 'recording' ? (
        <Radio className="h-4 w-4 recording-dot text-red-600 shrink-0" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      )}

      <span className="font-medium">{label}</span>

      {data?.elapsedMs ? (
        <span className="text-xs opacity-70">· {formatElapsed(data.elapsedMs)}</span>
      ) : null}

      {data?.participantCount ? (
        <span className="text-xs opacity-70">· {data.participantCount} participants</span>
      ) : null}
    </div>
  )
}
