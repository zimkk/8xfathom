import Link from 'next/link'
import { Mic } from 'lucide-react'
import { SignInButton } from '@/components/auth/sign-in-button'

export const metadata = { title: 'Sign in' }

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

          <SignInButton />

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
