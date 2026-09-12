import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Page not found' }

interface RoastResponse {
  title: string
  subtitle: string
  logs: string[]
  footnote: string
  emoji: string
}

const FALLBACK: RoastResponse = {
  title: 'This page skipped the call.',
  subtitle: "We looked everywhere — it never showed up, not even on mute.",
  logs: ['> searching meeting library...', '> checking transcripts...', '> 404: nothing recorded here.'],
  footnote: 'Error code: MEETING-NOT-FOUND',
  emoji: '🎙️💨',
}

async function getRoast(): Promise<RoastResponse> {
  try {
    const res = await fetch('https://witty-404.zimkk.workers.dev/roast', {
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    })
    if (!res.ok) return FALLBACK
    const data = (await res.json()) as Partial<RoastResponse>
    if (!data.title || !data.subtitle) return FALLBACK
    return { ...FALLBACK, ...data }
  } catch {
    return FALLBACK
  }
}

export default async function NotFound() {
  const roast = await getRoast()

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-lg text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-10">
          <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-semibold text-sm text-foreground">Fathom 8x</span>
        </Link>

        <div className="text-4xl mb-4" aria-hidden="true">{roast.emoji}</div>

        <h1 className="text-xl font-semibold tracking-tight text-foreground mb-2 whitespace-pre-line">
          {roast.title}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">{roast.subtitle}</p>

        <div className="rounded-lg border border-border bg-muted/30 p-4 text-left mb-6 overflow-x-auto">
          <pre className="text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {roast.logs.join('\n')}
          </pre>
        </div>

        <p className="text-[11px] font-mono text-muted-foreground/70 mb-8">{roast.footnote}</p>

        <Link href="/">
          <Button className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Fathom 8x
          </Button>
        </Link>
      </div>
    </div>
  )
}
