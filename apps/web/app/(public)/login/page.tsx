import Link from 'next/link'
import Image from 'next/image'
import { SignInButton } from '@/components/auth/sign-in-button'
import { DevSignIn } from '@/components/auth/dev-sign-in'
import { MeetingFlowIllustration } from '@/components/illustrations/meeting-flow-illustration'

export const metadata = { title: 'Sign in' }

const hasGoogleOAuth =
  !!process.env['GOOGLE_CLIENT_ID'] && !!process.env['GOOGLE_CLIENT_SECRET']

const isDevBypass =
  process.env['NODE_ENV'] === 'development' && process.env['DEV_AUTH_BYPASS'] === 'true'

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand / illustration panel */}
      <div className="hidden lg:flex relative flex-col justify-between bg-primary p-10 overflow-hidden">
        <Link href="/" className="relative z-10 flex items-center gap-2">
          <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-semibold text-sm text-primary-foreground">Fathom 8x</span>
        </Link>

        <div className="relative z-10 flex-1 flex items-center justify-center py-10">
          <MeetingFlowIllustration />
        </div>

        <div className="relative z-10 max-w-sm">
          <p className="text-lg font-medium text-primary-foreground leading-snug">
            Every Google Meet call, recorded, transcribed, and distilled — automatically.
          </p>
          <p className="mt-2 text-sm text-primary-foreground/70">
            Connect your calendar once. Never take notes again.
          </p>
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex justify-center mb-6">
            <Image src="/logo.svg" alt="" width={36} height={36} className="h-9 w-9" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight mb-1">Sign in to Fathom 8x</h1>
          <p className="text-sm text-muted-foreground mb-8">
            AI meeting notes for Google Meet
          </p>

          <div className="space-y-3">
            {hasGoogleOAuth && <SignInButton />}

            {isDevBypass && (
              <>
                {hasGoogleOAuth && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    dev
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <DevSignIn />
              </>
            )}

            {!hasGoogleOAuth && !isDevBypass && (
              <p className="text-sm text-muted-foreground py-4">
                Sign-in is temporarily unavailable. Please check back shortly, or explore the demo below.
              </p>
            )}
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Just browsing?{' '}
            <Link href="/demo" className="font-medium text-foreground hover:underline">
              Explore the demo
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
