import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Mic, Calendar, FileText, Search, Share2, ChevronRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Fathom 8x</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/demo">
              <Button variant="ghost" size="sm">
                Explore Demo
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Try with Google</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Google Meet AI Notetaker
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-foreground mb-4 max-w-2xl mx-auto">
          Every meeting, automatically noted
        </h1>

        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          Connect your calendar, and your AI notetaker joins every Google Meet — recording, transcribing, and distilling key insights so you can stay present.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/login">
            <Button size="lg" className="gap-2">
              Try with Google
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/demo">
            <Button variant="outline" size="lg">
              Explore Demo
            </Button>
          </Link>
        </div>

        {/* Product screenshot placeholder */}
        <div className="mt-16 rounded-[14px] border bg-muted/30 aspect-[16/9] max-w-4xl mx-auto flex items-center justify-center overflow-hidden">
          <div className="text-center text-muted-foreground">
            <div className="grid grid-cols-2 gap-4 p-8 text-left max-w-3xl">
              <div className="rounded-[12px] bg-white border p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-medium text-red-600">Recording</span>
                  <span className="text-xs text-muted-foreground ml-auto">24:18</span>
                </div>
                <div className="space-y-2">
                  {['Sarah Chen', 'Ahmed Khan', 'Marcus Webb'].map((name) => (
                    <div key={name} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium text-primary">
                        {name[0]}
                      </div>
                      <span className="text-xs text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[12px] bg-white border p-5 shadow-sm">
                <div className="text-xs font-semibold mb-2">AI Summary</div>
                <div className="space-y-1.5">
                  {['Launch timeline confirmed for Oct 15', 'SSO integration is critical path', '3 action items assigned to Ahmed'].map((item) => (
                    <div key={item} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t bg-muted/20 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {[
              {
                icon: Calendar,
                title: 'Calendar-aware',
                desc: 'Syncs with Google Calendar. Your notetaker joins automatically before meetings start.',
              },
              {
                icon: Mic,
                title: 'Visible notetaker',
                desc: 'A real AI participant joins your Google Meet — transparent to all attendees.',
              },
              {
                icon: FileText,
                title: 'Structured notes',
                desc: 'AI extracts summaries, decisions, action items, and topics with evidence.',
              },
              {
                icon: Search,
                title: 'Search across meetings',
                desc: 'Find any moment across all your meetings. Click to jump to the exact timestamp.',
              },
              {
                icon: Share2,
                title: 'Public sharing',
                desc: 'Share meetings and clips with anyone — no sign-in required.',
              },
              {
                icon: Mic,
                title: 'Multiple templates',
                desc: 'General, sales, 1:1, interview, and project note templates built-in.',
              },
            ].map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border bg-background mb-3">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <p>© 2025 Fathom 8x. Built with Recall.ai for meeting capture.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
