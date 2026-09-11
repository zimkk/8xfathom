import Link from 'next/link'
import { Mic } from 'lucide-react'

export const metadata = { title: 'Terms of Service — Fathom 8x' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Fathom 8x</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using Fathom 8x, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
            <p>Fathom 8x is an AI meeting notetaker that joins Google Meet calls to record, transcribe, and generate summaries of your meetings. You are responsible for obtaining consent from all meeting participants before using the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. User Responsibilities</h2>
            <p>You must comply with all applicable laws regarding recording of conversations, including notifying participants when a meeting is being recorded. You are solely responsible for ensuring compliance with consent laws in your jurisdiction.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Intellectual Property</h2>
            <p>You retain ownership of your meeting content. You grant Fathom 8x a limited license to process and store your meeting data to provide the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Limitation of Liability</h2>
            <p>Fathom 8x is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Termination</h2>
            <p>Either party may terminate this agreement at any time. Upon termination, your access to the service will cease and your data may be deleted after 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Contact</h2>
            <p>For questions about these terms, email <a href="mailto:legal@fathom8x.com" className="text-primary hover:underline">legal@fathom8x.com</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
