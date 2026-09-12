import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import '@/styles/globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  title: {
    default: 'Fathom 8x — AI Meeting Notetaker',
    template: '%s | Fathom 8x',
  },
  description:
    'AI-powered Google Meet notetaker. Automatic recording, transcription, summaries, and action items.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env['APP_URL'] || 'https://fathom8x.app',
    siteName: 'Fathom 8x',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* suppressHydrationWarning: extensions (Grammarly, password managers, Dark Reader, etc.)
          mutate <body> attributes before React hydrates; without this that becomes a hydration
          error that can blank the page. */}
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
