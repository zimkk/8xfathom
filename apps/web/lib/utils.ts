import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatTimestamp(ms: number): string {
  return formatDuration(ms)
}

export function parseTimeQueryParam(t: string | null | undefined): number | null {
  if (!t) return null
  const seconds = parseFloat(t)
  if (isNaN(seconds) || seconds < 0) return null
  return seconds
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index] ?? 'bg-gray-500'
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

// Single source of truth for how a meeting status maps to a Badge variant, so every surface
// (dashboard, calendar, meeting detail) renders the same colour for the same state.
export type MeetingBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'purple'

export function meetingStatusVariant(status: string): MeetingBadgeVariant {
  if (status === 'recording') return 'destructive'
  if (status === 'ready') return 'success'
  if (status === 'processing') return 'purple'
  if (status === 'denied' || status === 'failed') return 'warning'
  if (['bot_queued', 'bot_starting', 'waiting_for_admission'].includes(status)) return 'warning'
  return 'secondary'
}
