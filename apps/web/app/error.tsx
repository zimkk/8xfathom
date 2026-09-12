'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Route-segment error boundary. Catches render/runtime errors so the app degrades to a friendly
// recovery screen instead of a blank page — including errors a browser extension (ad blocker,
// Grammarly, password managers, etc.) can trigger by mutating the DOM or injecting scripts.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold mb-1">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-5">
          An unexpected error occurred. If you use a browser extension such as an ad blocker, it may
          have interfered with the page — try again, or reload.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  )
}
