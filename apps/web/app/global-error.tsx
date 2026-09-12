'use client'

import { useEffect } from 'react'

// Last-resort boundary for errors thrown in the root layout itself. It replaces the whole document,
// so it must render its own <html>/<body> and cannot rely on the app's stylesheet — styles are
// inlined so it looks intentional even if CSS never loaded.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: '#fafafa',
          color: '#18181b',
        }}
      >
        <div style={{ maxWidth: 420, textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#71717a', margin: '0 0 20px', lineHeight: 1.5 }}>
            An unexpected error occurred. A browser extension such as an ad blocker can sometimes
            interfere with the page — try again, or reload.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#fff',
                color: '#18181b',
                border: '1px solid #e4e4e7',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
