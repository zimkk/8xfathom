'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'

interface SyncButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg'
  label?: string
  className?: string
}

// One-click calendar sync usable anywhere the calendar is connected. It calls the sync API in
// place, shows progress, then refreshes server data — no bouncing to the settings page first.
export function SyncButton({ variant = 'default', size = 'sm', label = 'Sync calendar', className }: SyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })

      if (res.status === 401 || res.status === 422) {
        const body = await res.json().catch(() => ({}))
        if (body?.needsReauth || body?.needsConnect) {
          // Connection is gone or expired without a refresh token — send them through consent.
          window.location.href = '/api/calendar/connect'
          return
        }
      }

      if (!res.ok) {
        toast({ title: 'Sync failed', description: 'Could not sync your calendar. Please try again.', variant: 'destructive' })
        return
      }

      const { created = 0, updated = 0 } = await res.json().catch(() => ({}))
      const changed = created + updated
      toast({
        title: 'Calendar synced',
        description: changed > 0 ? `${changed} meeting${changed === 1 ? '' : 's'} added or updated.` : 'You’re all caught up.',
      })
      router.refresh()
    } catch {
      toast({ title: 'Sync failed', description: 'Network error. Please try again.', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleSync} disabled={syncing} className={cn('gap-2', className)}>
      <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
      {syncing ? 'Syncing…' : label}
    </Button>
  )
}
