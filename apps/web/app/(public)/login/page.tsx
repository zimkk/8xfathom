import Link from 'next/link'
import { Mic } from 'lucide-react'
import { SignInButton } from '@/components/auth/sign-in-button'
import { DevSignIn } from '@/components/auth/dev-sign-in'

export const metadata = { title: 'Sign in' }

const hasGoogleOAuth =
  !!process.env['GOOGLE_CLIENT_ID'] && !!process.env['GOOGLE_CLIENT_SECRET']

const isDevBypass =
  process.env['NODE_ENV'] === 'development' && process.env['DEV_AUTH_BYPASS'] === 'true'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-[14px] border shadow-sm p-8 text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
                <Mic className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>

          <h1 className="text-xl font-semibold mb-1">Sign in to Fathom 8x</h1>
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
                Authentication is not configured. Set{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code>{' '}
                and{' '}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code>
                {' '}in your environment variables.
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
        </div>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Just browsing?{' '}
          <Link href="/demo" className="font-medium text-foreground hover:underline">
            Explore the demo
          </Link>
        </p>
      </div>
    </div>
  )
}
