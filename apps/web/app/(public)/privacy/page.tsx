import Link from 'next/link'
import { Mic } from 'lucide-react'

export const metadata = { title: 'Privacy Policy — Fathom 8x' }

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Information We Collect</h2>
            <p>We collect information you provide directly, including your name, email address, and meeting recordings when you connect your Google Calendar and grant Fathom access to record meetings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. How We Use Your Information</h2>
            <p>We use the information we collect to provide, improve, and personalize the Fathom 8x service, including generating AI meeting notes, transcripts, and action items from your meeting recordings.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. Data Storage and Security</h2>
            <p>Meeting recordings and transcripts are stored securely using AES-256 encryption. We use industry-standard security practices to protect your data from unauthorized access.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Sharing of Information</h2>
            <p>We do not sell your personal information. We may share information with third-party service providers who help us operate our platform, subject to confidentiality agreements.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Your Rights</h2>
            <p>You can request deletion of your account and all associated data at any time. Contact us at privacy@fathom8x.com to exercise your rights.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Contact</h2>
            <p>For privacy-related questions, email us at <a href="mailto:privacy@fathom8x.com" className="text-primary hover:underline">privacy@fathom8x.com</a>.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
